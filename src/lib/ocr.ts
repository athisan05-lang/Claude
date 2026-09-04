import { createWorker, PSM, type Worker } from 'tesseract.js';
import { pdfjsLib } from './pdfjsSetup';

export interface OcrRow {
  page: number;
  y: number;
  x: number;
  text: string;
}

export type OcrProgress = (info: { page: number; pageCount: number; status: string; progress: number }) => void;

type PdfDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>;

// Mehrere Tesseract-Worker parallel laufen lassen, statt Seite für Seite nacheinander -
// das ist der grösste Hebel gegen lange Wartezeiten bei mehrseitigen Scans. Richtet sich
// nach den verfügbaren CPU-Kernen (jeder Worker lädt eigenes WASM + Sprachdaten, kostet
// also RAM), zwischen 2 und 4, damit auch mehrseitige Dokumente (10+ Seiten) nicht
// gefühlt "einfrieren".
const MAX_WORKERS = Math.max(2, Math.min(navigator.hardwareConcurrency || 4, 4));
const pool: Promise<Worker>[] = [];

async function createConfiguredWorker(): Promise<Worker> {
  // Worker, WASM-Engine und deutsche Sprachdaten liegen als statische Dateien im eigenen
  // public/-Ordner (aus den npm-Paketen tesseract.js-core und @tesseract.js-data/deu
  // kopiert), statt sie von einem externen CDN nachzuladen - läuft dadurch auch ohne
  // Zugriff auf Drittanbieter-CDNs und bleibt näher am "alles lokal"-Prinzip der App.
  // BASE_URL berücksichtigt einen evtl. Unterpfad (z.B. "/Claude/" auf GitHub Pages).
  const base = import.meta.env.BASE_URL;
  const worker = await createWorker('deu', 1, {
    workerPath: `${base}tesseract/worker.min.js`,
    corePath: `${base}tesseract/tesseract-core-simd.wasm.js`,
    langPath: `${base}tesseract`,
  });
  // NPK-Ausdrucke sind pro Seite eine einzelne Spalte (Titel + Tabellenzeilen) - die
  // aufwendige automatische Layout-/Spaltenerkennung (Standardmodus) wird nicht
  // gebraucht und nur explizit ausgeschaltet, was spürbar Zeit spart.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
  return worker;
}

function ensureWorkers(count: number): Promise<Worker>[] {
  while (pool.length < count) pool.push(createConfiguredWorker());
  return pool.slice(0, count);
}

/** Beendet alle (bei Bedarf einmalig erzeugten) OCR-Worker und gibt deren Ressourcen frei. */
export async function terminateOcrWorker(): Promise<void> {
  const existing = pool.splice(0, pool.length);
  await Promise.all(existing.map(async (p) => (await p).terminate()));
}

// Harte Obergrenze für die längere Kante des gerenderten Bilds. Mit dem Handy gescannte
// PDFs (z.B. Scanner-Apps) betten oft riesige Fotos ein - ohne Deckel würde eine Seite
// bei scale 2 auf mehrere tausend Pixel Kantenlänge aufgeblasen, was die Texterkennung
// pro Seite auf mehrere Minuten hochtreiben kann (wirkt dann wie eingefroren). Der Deckel
// sorgt dafür, dass jede Seite unabhängig von der Quellauflösung in einer beschränkten,
// vorhersagbaren Zeit erkannt wird.
const MAX_RENDER_DIMENSION = 2200;

async function renderPageToCanvas(page: PdfPage) {
  // Auflösung ist ein Kompromiss zwischen Erkennungsqualität und Geschwindigkeit -
  // scale 2 statt 3 spart ca. die Hälfte der Rechenzeit pro Seite, bei kaum schlechterer
  // Texterkennung (Zahlenspalten waren bei feiner gescannten Vorlagen auch mit scale 3
  // schon an der Grenze der Lesbarkeit). Zusätzlich nach oben gedeckelt (siehe
  // MAX_RENDER_DIMENSION), falls die Seite selbst schon sehr hochauflösend ist.
  const naturalViewport = page.getViewport({ scale: 1 });
  const longestEdge = Math.max(naturalViewport.width, naturalViewport.height);
  const scale = Math.min(2, MAX_RENDER_DIMENSION / longestEdge);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** True, wenn die Seite (praktisch) keine Textebene hat und daher OCR benötigt. */
export function needsOcr(itemCount: number): boolean {
  return itemCount === 0;
}

function toRows(data: Awaited<ReturnType<Worker['recognize']>>['data'], pageNum: number): OcrRow[] {
  const rows: OcrRow[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const text = line.text.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        rows.push({ page: pageNum, y: line.bbox.y0, x: line.bbox.x0, text });
      }
    }
  }
  // Bild-Koordinaten: y wächst nach unten -> von oben nach unten sortieren.
  rows.sort((a, b) => a.y - b.y || a.x - b.x);
  return rows;
}

// Obergrenze pro Seite, damit ein einzelnes problematisches Bild (z.B. beschädigt oder
// untypisch gross) niemals den gesamten Upload unbegrenzt blockieren kann. Grosszügig
// bemessen (deutlich über der normalen Erkennungszeit einer Seite), aber endlich - die
// betroffene Seite wird dann ohne erkannten Text übernommen, statt für immer zu "hängen".
const PAGE_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Zeitüberschreitung bei ${label}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Erkennt den Text mehrerer gescannter (textloser) PDF-Seiten per OCR, verteilt auf
 * einen kleinen Pool paralleler Worker statt sie nacheinander abzuarbeiten. Liefert die
 * Zeilen je Seite in derselben Form wie die reguläre Textextraktion (Seite/x/y/Text).
 */
export async function ocrPages(
  doc: PdfDocument,
  pageNumbers: number[],
  pageCount: number,
  onProgress?: OcrProgress,
): Promise<Map<number, OcrRow[]>> {
  const workers = ensureWorkers(Math.min(MAX_WORKERS, pageNumbers.length));
  const queue = [...pageNumbers];
  const results = new Map<number, OcrRow[]>();
  let done = 0;

  async function run(workerPromise: Promise<Worker>) {
    const worker = await workerPromise;
    for (;;) {
      const pageNum = queue.shift();
      if (pageNum === undefined) return;
      try {
        const { data } = await withTimeout(
          (async () => {
            const page = await doc.getPage(pageNum);
            const canvas = await renderPageToCanvas(page);
            return worker.recognize(canvas, {}, { blocks: true, text: false, hocr: false, tsv: false });
          })(),
          PAGE_TIMEOUT_MS,
          `Seite ${pageNum}`,
        );
        results.set(pageNum, toRows(data, pageNum));
      } catch (err) {
        console.error(`OCR für Seite ${pageNum} fehlgeschlagen/zu langsam, wird übersprungen:`, err);
        results.set(pageNum, []);
      }
      done++;
      onProgress?.({ page: pageNum, pageCount, status: 'Texterkennung (OCR) läuft', progress: done / pageNumbers.length });
    }
  }

  await Promise.all(workers.map(run));
  return results;
}
