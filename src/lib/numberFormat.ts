/**
 * Parst eine im PDF gefundene Zahl (CH: 1'234.50, DE: 1.234,50, oder einfach 1234.5)
 * in eine JS-Zahl. Gibt null zurück, wenn nichts Sinnvolles erkannt wird.
 */
export function parseSwissNumber(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/['’\s]/g, '');

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    // Das letzte Trennzeichen ist der Dezimalpunkt, alles davor Tausendertrennung.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Nur Komma: als Dezimaltrennzeichen interpretieren, wenn genau 1-2 Nachkommastellen.
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0] + '.' + parts[1];
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatCHF(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return value.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
