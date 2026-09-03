import { useState } from 'react';
import type { Offer, PositionRow } from '../lib/types';
import { formatCHF } from '../lib/numberFormat';
import PdfViewerModal from './PdfViewerModal';

interface Props {
  offer: Offer;
  onRename: (name: string) => void;
  onUpdateRow: (rowId: string, patch: Partial<PositionRow>) => void;
  onDeleteRow: (rowId: string) => void;
  onAddRow: () => void;
  onDeleteOffer: () => void;
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function OfferEditor({ offer, onRename, onUpdateRow, onDeleteRow, onAddRow, onDeleteOffer }: Props) {
  const [viewerPage, setViewerPage] = useState<{ page: number; rawText: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function patchAndRecalc(row: PositionRow, patch: Partial<PositionRow>) {
    const merged = { ...row, ...patch, autoDetected: false };
    if (('quantity' in patch || 'unitPrice' in patch) && merged.quantity != null && merged.unitPrice != null) {
      merged.totalPrice = Math.round(merged.quantity * merged.unitPrice * 100) / 100;
    }
    onUpdateRow(row.id, merged);
  }

  const sum = offer.rows.reduce((s, r) => s + (r.totalPrice ?? 0), 0);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        <input
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-base font-semibold text-neutral-800 hover:border-neutral-300 focus:border-blue-400 focus:outline-none dark:text-neutral-100"
          value={offer.name}
          onChange={(e) => onRename(e.target.value)}
        />
        <span className="text-xs text-neutral-500">{offer.fileName}</span>
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Summe: CHF {formatCHF(sum)}
        </span>
        {confirmDelete ? (
          <span className="flex items-center gap-1 text-xs">
            Offerte löschen?
            <button className="rounded bg-red-600 px-2 py-1 text-white" onClick={onDeleteOffer}>
              Ja
            </button>
            <button className="rounded border border-neutral-300 px-2 py-1" onClick={() => setConfirmDelete(false)}>
              Nein
            </button>
          </span>
        ) : (
          <button
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
            onClick={() => setConfirmDelete(true)}
          >
            Offerte entfernen
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500 dark:border-neutral-700">
              <th className="px-2 py-2">NPK-Nr.</th>
              <th className="px-2 py-2">Bezeichnung</th>
              <th className="px-2 py-2 text-right">Menge</th>
              <th className="px-2 py-2">Einheit</th>
              <th className="px-2 py-2 text-right">Einheitspreis</th>
              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {offer.rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-neutral-100 dark:border-neutral-800 ${
                  row.autoDetected ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                }`}
              >
                <td className="px-1 py-1">
                  <input
                    className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                    value={row.code}
                    onChange={(e) => patchAndRecalc(row, { code: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-full min-w-[220px] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                    value={row.description}
                    onChange={(e) => patchAndRecalc(row, { description: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                    value={row.quantity ?? ''}
                    onChange={(e) => patchAndRecalc(row, { quantity: numOrNull(e.target.value) })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                    value={row.unit}
                    onChange={(e) => patchAndRecalc(row, { unit: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                    value={row.unitPrice ?? ''}
                    onChange={(e) => patchAndRecalc(row, { unitPrice: numOrNull(e.target.value) })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-medium hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                    value={row.totalPrice ?? ''}
                    onChange={(e) => patchAndRecalc(row, { totalPrice: numOrNull(e.target.value) })}
                  />
                </td>
                <td className="whitespace-nowrap px-1 py-1 text-right">
                  <button
                    title="Original-PDF anzeigen"
                    className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => setViewerPage({ page: row.page, rawText: row.rawText })}
                  >
                    PDF
                  </button>
                  <button
                    title="Zeile löschen"
                    className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    onClick={() => onDeleteRow(row.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-neutral-200 px-4 py-2 dark:border-neutral-700">
        <button className="text-sm text-blue-600 hover:underline" onClick={onAddRow}>
          + Position manuell hinzufügen
        </button>
        {offer.rows.some((r) => r.autoDetected) && (
          <span className="ml-4 text-xs text-amber-700 dark:text-amber-400">
            gelb = automatisch erkannt, bitte prüfen
          </span>
        )}
      </div>

      {viewerPage && (
        <PdfViewerModal
          fileName={offer.fileName}
          fileData={offer.fileData}
          page={viewerPage.page}
          rawText={viewerPage.rawText}
          onClose={() => setViewerPage(null)}
        />
      )}
    </div>
  );
}
