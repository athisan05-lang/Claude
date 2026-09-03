import { pdfjsLib } from './pdfjsSetup';
import { parseSwissNumber } from './numberFormat';
import type { PositionRow } from './types';

const UNIT_WORDS = [
  'stk', 'st', 'stück', 'psch', 'pau', 'pauschal', 'lfm', 'lm', 'm2', 'm3', 'dm2', 'dm3',
  'kg', 't', 'to', 'h', 'std', 'l', 'ha', 'a', 'm',
];
// Längste zuerst, damit z.B. "m2" vor "m" matcht.
const UNIT_PATTERN = UNIT_WORDS.slice().sort((a, b) => b.length - a.length).join('|');
const UNIT_REGEX = new RegExp(`(?:^|\\s)(${UNIT_PATTERN})(?:\\.|\\s|$)`, 'i');

const CODE_REGEX = /^([A-ZÄÖÜ]{0,3}\s?\d{1,4}(?:[.\s]\d{2,4}){1,4}\.?)\s+(?=\S)/;

// Erst Zahlen mit Tausendertrennzeichen (1'234 / 1 234), sonst eine einfache Ziffernfolge -
// so bleibt z.B. "2940.00" (ohne Trennzeichen) am Stück, statt bei 3 Ziffern abgeschnitten zu werden.
const NUMBER_TOKEN = /-?(?:\d{1,3}(?:[’'\s]\d{3})+|\d+)(?:[.,]\d{1,2})?/g;

interface TextRow {
  page: number;
  y: number;
  text: string;
}

async function extractTextRows(data: ArrayBuffer): Promise<{ rows: TextRow[]; pageCount: number }> {
  // .slice(0) kopiert den Buffer: pdf.js "transferred" das Original sonst an den Worker,
  // wodurch es beim Original-Offer-Objekt nicht mehr lesbar wäre.
  const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
  const rows: TextRow[] = [];

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

    for (const group of lineGroups) {
      group.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEndX: number | null = null;
      for (const item of group) {
        if (prevEndX !== null && item.x - prevEndX > 8) text += '  ';
        else if (text) text += ' ';
        text += item.str.trim();
        // grobe Schätzung des Endes (Zeichenbreite unbekannt, daher nur x-Start als Referenz)
        prevEndX = item.x;
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (text) rows.push({ page: pageNum, y: group[0].y, text });
    }
  }

  return { rows, pageCount: doc.numPages };
}

function tryParseRow(row: TextRow, idPrefix: string, index: number): PositionRow | null {
  const codeMatch = row.text.match(CODE_REGEX);
  if (!codeMatch) return null;

  const code = codeMatch[1].trim().replace(/\s+/g, '.').replace(/\.+$/, '');
  const rest = row.text.slice(codeMatch[0].length);

  const unitMatch = rest.match(UNIT_REGEX);

  let description = rest;
  let quantity: number | null = null;
  let unit = '';
  let unitPrice: number | null = null;
  let totalPrice: number | null = null;

  if (unitMatch && unitMatch.index !== undefined) {
    unit = unitMatch[1];
    const before = rest.slice(0, unitMatch.index);
    const after = rest.slice(unitMatch.index + unitMatch[0].length);

    const beforeNumbers = before.match(NUMBER_TOKEN) ?? [];
    const afterNumbers = after.match(NUMBER_TOKEN) ?? [];

    if (beforeNumbers.length > 0) {
      quantity = parseSwissNumber(beforeNumbers[beforeNumbers.length - 1]);
      const lastNumIdx = before.lastIndexOf(beforeNumbers[beforeNumbers.length - 1]);
      description = before.slice(0, lastNumIdx).trim();
    } else {
      description = before.trim();
    }

    if (afterNumbers.length >= 2) {
      unitPrice = parseSwissNumber(afterNumbers[afterNumbers.length - 2]);
      totalPrice = parseSwissNumber(afterNumbers[afterNumbers.length - 1]);
    } else if (afterNumbers.length === 1) {
      unitPrice = parseSwissNumber(afterNumbers[0]);
    }
  } else {
    const numbers = rest.match(NUMBER_TOKEN) ?? [];
    if (numbers.length >= 3) {
      quantity = parseSwissNumber(numbers[numbers.length - 3]);
      unitPrice = parseSwissNumber(numbers[numbers.length - 2]);
      totalPrice = parseSwissNumber(numbers[numbers.length - 1]);
      const cut = rest.lastIndexOf(numbers[numbers.length - 3]);
      description = rest.slice(0, cut).trim();
    } else if (numbers.length === 2) {
      unitPrice = parseSwissNumber(numbers[0]);
      totalPrice = parseSwissNumber(numbers[1]);
      const cut = rest.lastIndexOf(numbers[0]);
      description = rest.slice(0, cut).trim();
    } else if (numbers.length === 1) {
      totalPrice = parseSwissNumber(numbers[0]);
      const cut = rest.lastIndexOf(numbers[0]);
      description = rest.slice(0, cut).trim();
    }
  }

  if (quantity !== null && unitPrice !== null && totalPrice === null) {
    totalPrice = Math.round(quantity * unitPrice * 100) / 100;
  }

  // Zeilen ohne jegliche Preisangabe sind meist Kapitel-/Titelzeilen, keine Positionen.
  if (unitPrice === null && totalPrice === null) return null;

  description = description.replace(/\s+/g, ' ').trim();

  return {
    id: `${idPrefix}-${index}`,
    code,
    description,
    quantity,
    unit,
    unitPrice,
    totalPrice,
    page: row.page,
    rawText: row.text,
    autoDetected: true,
  };
}

export async function parseOfferPdf(
  data: ArrayBuffer,
  idPrefix: string,
): Promise<{ rows: PositionRow[]; pageCount: number }> {
  const { rows: textRows, pageCount } = await extractTextRows(data);
  const positions: PositionRow[] = [];
  let index = 0;
  for (const row of textRows) {
    const parsed = tryParseRow(row, idPrefix, index);
    if (parsed) {
      positions.push(parsed);
      index++;
    }
  }
  return { rows: positions, pageCount };
}
