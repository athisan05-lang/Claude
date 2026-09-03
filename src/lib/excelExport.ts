import * as XLSX from 'xlsx';
import type { MatchGroup, Offer } from './types';
import { findRow } from './matchEngine';

interface DownloadsCapability {
  save: (req: { filename: string; data: Blob }) => Promise<unknown>;
}

/**
 * Läuft die App in einer Umgebung, die Downloads nicht direkt per <a download> erlaubt
 * (z.B. eine veröffentlichte Claude-Artifact-Vorschau), wird die Datei über die dortige
 * "downloads"-Fähigkeit angeboten. Sonst ganz normaler Browser-Download.
 */
async function saveBlob(fileName: string, blob: Blob) {
  const claude = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (claude?.use) {
    try {
      const downloads = (await claude.use('downloads')) as DownloadsCapability | null;
      if (downloads) {
        await downloads.save({ filename: fileName, data: blob });
        return;
      }
    } catch {
      // Nutzer hat abgelehnt, oder Speichern ist hier nicht möglich - normalen Download versuchen.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportComparisonToExcel(projectName: string, offers: Offer[], groups: MatchGroup[]) {
  const header = ['NPK-Nr.', 'Bezeichnung'];
  for (const offer of offers) {
    header.push(`${offer.name} - Menge`, `${offer.name} - Einheit`, `${offer.name} - EP`, `${offer.name} - Total`);
  }
  header.push('Günstigster Anbieter', 'Günstigster Preis');

  const rows: (string | number)[][] = [header];
  let grandTotalBest = 0;
  const offerTotals = new Map<string, number>();

  for (const group of groups) {
    const line: (string | number)[] = [group.code, group.description];
    let best: { offerName: string; total: number } | null = null;

    for (const offer of offers) {
      const rowId = group.assignments[offer.id];
      const row = rowId ? findRow(offers, offer.id, rowId) : undefined;
      line.push(row?.quantity ?? '', row?.unit ?? '', row?.unitPrice ?? '', row?.totalPrice ?? '');
      if (row?.totalPrice != null) {
        offerTotals.set(offer.id, (offerTotals.get(offer.id) ?? 0) + row.totalPrice);
        if (!best || row.totalPrice < best.total) {
          best = { offerName: offer.name, total: row.totalPrice };
        }
      }
    }

    if (best) {
      line.push(best.offerName, best.total);
      grandTotalBest += best.total;
    } else {
      line.push('', '');
    }
    rows.push(line);
  }

  rows.push([]);
  const totalsLine: (string | number)[] = ['', 'Summe'];
  for (const offer of offers) {
    totalsLine.push('', '', '', offerTotals.get(offer.id) ?? '');
  }
  totalsLine.push('Günstigste Kombination', grandTotalBest);
  rows.push(totalsLine);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vergleich');
  const fileName = `${projectName || 'Offertenvergleich'}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveBlob(fileName, blob);
}
