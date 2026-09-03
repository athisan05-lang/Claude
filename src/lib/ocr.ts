import { createWorker, type Worker } from 'tesseract.js';
import { pdfjsLib } from './pdfjsSetup';

export interface OcrRow {
  page: number;
  y: number;
  x: number;
  text: string;
}

export type OcrProgress = (info: { page: number; pageCount: number; status: string; progress: number }) => void;

let sharedWorker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!sharedWorker) {
    // Worker, WASM-Engine und deutsche Sprachdaten liegen als statische Dateien im eigenen
    // public/-Ordner (aus den npm-Paketen tesseract.js-core und @tesseract.js-data/deu
    // kopiert), statt sie von einem externen CDN nachzuladen - läuft dadurch auch ohne
    // Zugriff auf Drittanbieter-CDNs und bleibt näher am "alles lokal"-Prinzip der App.
    // BASE_URL berücksichtigt einen evtl. Unterpfad (z.B. "/Claude/" auf GitHub Pages).
    const base = import.meta.env.BASE_URL;
    sharedWorker = createWorker('deu', 1, {
      workerPath: `${base}tesseract/worker.min.js`,
      corePath: `${base}tesseract/tesseract-core-simd.wasm.js`,
      langPath: `${base}tesseract`,
    });
  }
  return sharedWorker;
}

/** Beendet den (bei Bedarf einmalig erzeugten) OCR-Worker und gibt dessen Ressourcen frei. */
export async function terminateOcrWorker(): Promise<void> {
  if (!sharedWorker) return;
  const worker = await sharedWorker;
  sharedWorker = null;
  await worker.terminate();
}

async function renderPageToCanvas(page: Awaited<ReturnType<Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>['getPage']>>) {
  // Höhere Auflösung = bessere Erkennungsrate bei kleiner Schrift in Tabellen.
  const viewport = page.getViewport({ scale: 3 });
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

/**
 * Erkennt den Text einer gescannten (textlosen) PDF-Seite per OCR und liefert ihn in
 * derselben Zeilen-Form wie die reguläre Textextraktion (Seite/x/y/Text), damit er
 * anschliessend von derselben Positions-Erkennung weiterverarbeitet werden kann.
 */
export async function ocrPage(
  doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>,
  pageNum: number,
  pageCount: number,
  onProgress?: OcrProgress,
): Promise<OcrRow[]> {
  const page = await doc.getPage(pageNum);
  const canvas = await renderPageToCanvas(page);
  const worker = await getWorker();

  const { data } = await worker.recognize(
    canvas,
    {},
    { blocks: true, text: false, hocr: false, tsv: false },
  );

  onProgress?.({ page: pageNum, pageCount, status: 'erkannt', progress: 1 });

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
