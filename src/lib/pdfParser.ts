import { pdfjsLib } from './pdfjsSetup';
import { parseSwissNumber } from './numberFormat';
import { needsOcr, ocrPages, type OcrProgress } from './ocr';
import type { PositionRow } from './types';

const UNIT_WORDS = [
  'stk', 'st', 'stück', 'psch', 'pau', 'pauschal', 'lfm', 'lm', 'le', 'gl', 'm2', 'm3', 'dm2', 'dm3',
  'kg', 't', 'to', 'h', 'std', 'l', 'ha', 'a', 'm',
];
// Längste zuerst, damit z.B. "m2" vor "m" matcht.
const UNIT_PATTERN = UNIT_WORDS.slice().sort((a, b) => b.length - a.length).join('|');
const UNIT_REGEX = new RegExp(`(?:^|\\s)(${UNIT_PATTERN})(?:\\.|\\s|$)`, 'i');
const UNIT_REGEX_GLOBAL = new RegExp(UNIT_REGEX.source, 'gi');

/**
 * Letztes (nicht erstes!) Vorkommen eines Einheitswortes im Text. Beschreibungen
 * enthalten oft beiläufig ein Wort wie "m" (z.B. "Weglänge über m 50,0."), bevor die
 * eigentliche Mengen-/Preisspalte kommt - die ist immer die zuletzt im Text stehende.
 */
function findUnitMatch(text: string): RegExpExecArray | null {
  UNIT_REGEX_GLOBAL.lastIndex = 0;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = UNIT_REGEX_GLOBAL.exec(text))) {
    last = m;
    if (m.index === UNIT_REGEX_GLOBAL.lastIndex) UNIT_REGEX_GLOBAL.lastIndex++;
  }
  return last;
}

// Positionsnummer am Zeilenanfang: entweder ein zusammengesetzter Code wie "211.100"
// (klassisches Format, alles inkl. Preis auf einer Zeile), oder eine einzelne "nackte"
// Nummer wie "111"/"10102" (typisches NPK-Ausdruck-Format, bei dem sich Kapitel/Titel/
// Ausführungsart über mehrere, unterschiedlich weit eingerückte Zeilen verschachteln).
// Optionales "R"/"R " davor kennzeichnet Regie-Positionen.
const LEADING_CODE_REGEX = /^(?:R\s?)?([A-ZÄÖÜ]{0,3}\d{1,6}(?:[.\s]\d{2,6}){0,4})\.?\s+(\S.*)$/;

// Erst Zahlen mit Tausendertrennzeichen (1'234 / 1 234), sonst eine einfache Ziffernfolge -
// so bleibt z.B. "2940.00" (ohne Trennzeichen) am Stück, statt bei 3 Ziffern abgeschnitten zu werden.
const NUMBER_TOKEN = /-?(?:\d{1,3}(?:[’'\s]\d{3})+|\d+)(?:[.,]\d{1,2})?/g;

interface TextRow {
  page: number;
  y: number;
  x: number;
  text: string;
}

async function extractTextRows(
  data: ArrayBuffer,
  onProgress?: OcrProgress,
): Promise<{ rows: TextRow[]; pageCount: number; ocrUsed: boolean }> {
  // .slice(0) kopiert den Buffer: pdf.js "transferred" das Original sonst an den Worker,
  // wodurch es beim Original-Offer-Objekt nicht mehr lesbar wäre.
  const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
  // Pro Seite gesammelt statt direkt in eine flache Liste geschrieben, damit gescannte
  // Seiten (OCR) unten gebündelt und parallel verarbeitet werden können, ohne die
  // Seitenreihenfolge im Endergebnis durcheinanderzubringen.
  const pageRows: TextRow[][] = new Array(doc.numPages + 1);
  const ocrPageNums: number[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    type Item = { x: number; y: number; str: string };
    const items: Item[] = [];
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[] };
      if (!it.str || !it.str.trim() || !it.transform) continue;
      items.push({ x: it.transform[4], y: it.transform[5], str: it.str });
    }

    if (needsOcr(items.length)) {
      // Keine Textebene -> die Seite ist ein eingescanntes Bild. Wird weiter unten
      // gebündelt per OCR gelesen (parallel über mehrere Seiten hinweg statt einzeln).
      ocrPageNums.push(pageNum);
      continue;
    }

    // Nach Zeilen gruppieren (Textfragmente mit ähnlichem y).
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lineGroups: Item[][] = [];
    const Y_TOLERANCE = 2.5;
    for (const item of items) {
      const last = lineGroups[lineGroups.length - 1];
      if (last && Math.abs(last[0].y - item.y) <= Y_TOLERANCE) {
        last.push(item);
      } else {
        lineGroups.push([item]);
      }
    }

    const rowsForPage: TextRow[] = [];
    for (const group of lineGroups) {
      group.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEndX: number | null = null;
      for (const item of group) {
        if (prevEndX !== null && item.x - prevEndX > 8) text += '  ';
        else if (text) text += ' ';
        text += item.str.trim();
        prevEndX = item.x;
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (text) rowsForPage.push({ page: pageNum, y: group[0].y, x: group[0].x, text });
    }
    pageRows[pageNum] = rowsForPage;
  }

  const ocrUsed = ocrPageNums.length > 0;
  if (ocrPageNums.length > 0) {
    onProgress?.({ page: ocrPageNums[0], pageCount: doc.numPages, status: 'Texterkennung (OCR) läuft', progress: 0 });
    const ocrResults = await ocrPages(doc, ocrPageNums, doc.numPages, onProgress);
    for (const pageNum of ocrPageNums) pageRows[pageNum] = ocrResults.get(pageNum) ?? [];
  }

  const rows: TextRow[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) rows.push(...(pageRows[pageNum] ?? []));

  return { rows, pageCount: doc.numPages, ocrUsed };
}

const BOILERPLATE_PATTERNS = [
  /^NPK-Bau\b/i,
  /^NPK\b.*\(V\d{4}\)/i,
  /^Seite:?\s*\d+/i,
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,
  /^Gliederungen:/i,
  /^Zusammenstellung:?$/i,
  /^Brutto-Betrag/i,
];

/** Entfernt Kopf-/Fusszeilen: alles, was auf sehr vielen Seiten identisch wiederkehrt. */
function filterBoilerplate(rows: TextRow[], pageCount: number): TextRow[] {
  if (pageCount < 3) return rows.filter((r) => !BOILERPLATE_PATTERNS.some((p) => p.test(r.text)));

  const pagesByText = new Map<string, Set<number>>();
  for (const row of rows) {
    let set = pagesByText.get(row.text);
    if (!set) pagesByText.set(row.text, (set = new Set()));
    set.add(row.page);
  }
  const threshold = Math.max(3, Math.ceil(pageCount * 0.5));

  return rows.filter((r) => {
    if (BOILERPLATE_PATTERNS.some((p) => p.test(r.text))) return false;
    const set = pagesByText.get(r.text);
    if (set && set.size >= threshold) return false;
    return true;
  });
}

interface PriceInfo {
  description: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
}

/**
 * Sucht in einem Textstück nach Menge/Einheit/Einheitspreis/Total. null, wenn nichts
 * Verwertbares gefunden wird.
 *
 * Übliches Spaltenformat in NPK-Ausdrucken ist "Einheit Menge Einheitspreis Total"
 * (z.B. "St 10.000 150.00 1'500.00" - die Einheit steht VOR der Menge). Zur
 * Absicherung wird trotzdem geprüft, ob stattdessen eine Zahl VOR der Einheit steht
 * (klassisches "Menge Einheit ..."-Format); das hat Vorrang, wenn zusätzlich nach der
 * Einheit nur noch genau 2 Zahlen (EP/Total) folgen.
 *
 * Ohne erkennbare Einheit wird nichts als Preis akzeptiert (siehe unten) - Fliesstext
 * enthält sonst zu leicht zufällige Zahlenpaare, die keine echte Preiszeile sind
 * (Verweise wie "Pos. 110.100" oder Bereichsangaben wie "Abschnitten 200 bis 500").
 */
function extractPricing(text: string): PriceInfo | null {
  const unitMatch = findUnitMatch(text);

  if (unitMatch && unitMatch.index !== undefined) {
    const unit = unitMatch[1];
    const before = text.slice(0, unitMatch.index);
    const after = text.slice(unitMatch.index + unitMatch[0].length);

    const beforeNumbers = before.match(NUMBER_TOKEN) ?? [];
    const afterNumbers = after.match(NUMBER_TOKEN) ?? [];

    let quantity: number | null = null;
    let unitPrice: number | null = null;
    let totalPrice: number | null = null;
    let description: string;

    if (afterNumbers.length >= 3) {
      // Einheit Menge EP Total (Standardfall in dieser Art von Ausdruck).
      quantity = parseSwissNumber(afterNumbers[0] ?? '');
      unitPrice = parseSwissNumber(afterNumbers[afterNumbers.length - 2]);
      totalPrice = parseSwissNumber(afterNumbers[afterNumbers.length - 1]);
      description = before.trim();
    } else if (afterNumbers.length === 2 && beforeNumbers.length > 0) {
      // Menge Einheit EP Total (klassisches Format).
      quantity = parseSwissNumber(beforeNumbers[beforeNumbers.length - 1]);
      const lastNumIdx = before.lastIndexOf(beforeNumbers[beforeNumbers.length - 1]);
      description = before.slice(0, lastNumIdx).trim();
      unitPrice = parseSwissNumber(afterNumbers[0]);
      totalPrice = parseSwissNumber(afterNumbers[1]);
    } else if (afterNumbers.length === 2) {
      // Zwei Zahlen direkt nach der Einheit ohne Menge davor sind mehrdeutig: das kann
      // EP+Total sein, aber genauso gut eine Bereichsangabe wie "m 3,01 bis 4,00"
      // (Stützhöhe). Das Wort "bis" dazwischen verrät den Unterschied zuverlässig.
      const between = after.slice(after.indexOf(afterNumbers[0]) + afterNumbers[0].length, after.indexOf(afterNumbers[1]));
      if (/\bbis\b/i.test(between)) return null;
      unitPrice = parseSwissNumber(afterNumbers[0]);
      totalPrice = parseSwissNumber(afterNumbers[1]);
      description = before.trim();
    } else {
      // Nur 1 (oder 0) Zahl(en) nach der Einheit ist zu unsicher (oft nur ein
      // Mass-/Grenzwert in der Beschreibung, kein Preis) - lieber nichts erkennen.
      return null;
    }

    if (quantity !== null && unitPrice !== null && totalPrice === null) {
      totalPrice = Math.round(quantity * unitPrice * 100) / 100;
    }
    return { description: description.replace(/\s+/g, ' ').trim(), quantity, unit, unitPrice, totalPrice };
  }

  // Ohne erkannte Einheit keine Preiszeile annehmen: Fliesstext enthält oft zufällig
  // 2-3 Zahlen (Querverweise wie "Zu Pos. 224.301", Bereichsangaben wie "200 bis 500"),
  // die sonst fälschlich als Menge/Preis interpretiert würden.
  return null;
}

interface StackFrame {
  x: number;
  num: string;
  textParts: string[];
}

function isChildOf(newX: number, newNum: string, top: StackFrame): boolean {
  if (newX > top.x + 1) return true; // physisch weiter eingerückt -> tiefer verschachtelt
  if (Math.abs(newX - top.x) <= 1 && newNum.length > top.num.length && newNum.startsWith(top.num)) {
    return true; // gleiche Einrückung, aber Nummer verfeinert die vorherige (z.B. "101" -> "10101")
  }
  return false;
}

export async function parseOfferPdf(
  data: ArrayBuffer,
  idPrefix: string,
  onProgress?: OcrProgress,
): Promise<{ rows: PositionRow[]; pageCount: number; ocrUsed: boolean }> {
  const { rows: allRawRows, pageCount, ocrUsed } = await extractTextRows(data, onProgress);

  // Deckblatt/Anschreiben (vor dem eigentlichen NPK-Ausdruck) und die abschliessende
  // Zusammenfassung ("Zusammenstellung: 100 Vorarbeiten 9'184.00 ...") ausklammern:
  // Erstens enthält Fliesstext dort zu viele zufällige Zahlen für die Heuristik, und
  // zweitens würde die Zusammenfassung dieselben Positionen nochmals (als grobe
  // Kapitel-Summen) erzeugen und so alles duplizieren.
  const startIdx = allRawRows.findIndex((r) => /^NPK-Bau\b/i.test(r.text) || /^NPK\b.*\(V\d{4}\)/i.test(r.text));
  const searchFrom = startIdx >= 0 ? startIdx : 0;
  const summaryIdx = allRawRows.findIndex(
    (r, i) => i > searchFrom && /^Zusammenstellung:?$/i.test(r.text),
  );
  const rawRows = allRawRows.slice(searchFrom, summaryIdx >= 0 ? summaryIdx : undefined);

  const rows = filterBoilerplate(rawRows, pageCount);
  const positions: PositionRow[] = [];
  let index = 0;

  const stack: StackFrame[] = [];

  function makePosition(page: number, rawText: string, priced: PriceInfo, leafText: string): PositionRow {
    const code = stack.map((f) => f.num).join('.');
    const parts = stack.flatMap((f, i) => (i === stack.length - 1 ? [...f.textParts, leafText] : f.textParts));
    const description = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    index++;
    return {
      id: `${idPrefix}-${index}`,
      code: code || `pos-${index}`,
      description,
      quantity: priced.quantity,
      unit: priced.unit,
      unitPrice: priced.unitPrice,
      totalPrice: priced.totalPrice,
      page,
      rawText,
      autoDetected: true,
    };
  }

  // Regie-Positionen ("R619", "R 100", "R 101", ...) werden in diesem Format oft OHNE
  // die sonst übliche zusätzliche Einrückungsstufe gedruckt - rein nach x-Position sähen
  // sie wie flache Geschwister aus statt wie Titel + Unterpositionen. regieRootIndex
  // merkt sich den Stack-Index der zuletzt geöffneten Regie-Titelzeile, solange
  // ununterbrochen weitere "R"-Zeilen folgen, und verhindert, dass diese darüber hinaus
  // abgebaut wird.
  let regieRootIndex: number | null = null;

  for (const row of rows) {
    const leadMatch = row.text.match(LEADING_CODE_REGEX);

    if (leadMatch) {
      const num = leadMatch[1].trim();
      const rest = leadMatch[2];
      const isRegie = /^R\s?\d/.test(row.text);

      if (isRegie && regieRootIndex !== null) {
        while (stack.length > regieRootIndex + 1) stack.pop();
      } else {
        while (stack.length && !isChildOf(row.x, num, stack[stack.length - 1])) stack.pop();
        regieRootIndex = isRegie ? stack.length : null;
      }

      const priced = extractPricing(rest);
      if (priced) {
        stack.push({ x: row.x, num, textParts: [] });
        positions.push(makePosition(row.page, row.text, priced, priced.description));
      } else {
        stack.push({ x: row.x, num, textParts: [rest.replace(/\s+/g, ' ').trim()] });
      }
      continue;
    }

    // Keine führende Nummer: entweder reine Fortsetzungszeile der Beschreibung, oder die
    // Zeile, in der Menge/Einheit/Preis der zuletzt geöffneten Position stehen.
    if (stack.length === 0) continue;
    const top = stack[stack.length - 1];
    const priced = extractPricing(row.text);
    if (priced) {
      positions.push(makePosition(row.page, row.text, priced, priced.description));
    } else if (row.text.length <= 200) {
      top.textParts.push(row.text);
    }
  }

  return { rows: positions, pageCount, ocrUsed };
}
