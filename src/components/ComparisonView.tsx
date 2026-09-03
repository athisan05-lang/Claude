import { useState } from 'react';
import type { MatchGroup, Offer } from '../lib/types';
import { findRow } from '../lib/matchEngine';
import { formatCHF } from '../lib/numberFormat';
import { exportComparisonToExcel } from '../lib/excelExport';
import PdfViewerModal from './PdfViewerModal';

interface Props {
  projectName: string;
  offers: Offer[];
  groups: MatchGroup[];
  onReassign: (groupId: string, offerId: string, rowId: string | null) => void;
  onUpdateGroup: (groupId: string, patch: Partial<Pick<MatchGroup, 'code' | 'description'>>) => void;
}

export default function ComparisonView({ projectName, offers, groups, onReassign, onUpdateGroup }: Props) {
  const [viewer, setViewer] = useState<{ offer: Offer; page: number; rawText: string } | null>(null);

  if (offers.length === 0) {
    return <p className="text-sm text-neutral-500">Lade zuerst mindestens eine Offerte hoch.</p>;
  }

  const offerTotals = new Map<string, number>();
  let bestCombinationTotal = 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Günstigster Preis pro Position ist grün hervorgehoben. Mit dem Auswahlfeld kannst du eine falsch
          zugeordnete Zeile korrigieren.
        </p>
        <button
          className="whitespace-nowrap rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800"
          onClick={() => exportComparisonToExcel(projectName, offers, groups)}
        >
          Als Excel exportieren
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800">
              <th className="px-2 py-2">NPK-Nr.</th>
              <th className="px-2 py-2">Bezeichnung</th>
              {offers.map((o) => (
                <th key={o.id} className="px-2 py-2">
                  {o.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const cells = offers.map((offer) => {
                const rowId = group.assignments[offer.id];
                const row = rowId ? findRow(offers, offer.id, rowId) : undefined;
                return { offer, row };
              });
              const pricedCells = cells.filter((c) => c.row?.totalPrice != null);
              const min = pricedCells.length
                ? Math.min(...pricedCells.map((c) => c.row!.totalPrice as number))
                : null;
              if (min != null) bestCombinationTotal += min;
              for (const c of cells) {
                if (c.row?.totalPrice != null) {
                  offerTotals.set(c.offer.id, (offerTotals.get(c.offer.id) ?? 0) + c.row.totalPrice);
                }
              }

              return (
                <tr key={group.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                  <td className="px-1 py-1">
                    <input
                      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                      value={group.code}
                      onChange={(e) => onUpdateGroup(group.id, { code: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      className="w-full min-w-[200px] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                      value={group.description}
                      onChange={(e) => onUpdateGroup(group.id, { description: e.target.value })}
                    />
                  </td>
                  {cells.map(({ offer, row }) => {
                    const isBest = min != null && row?.totalPrice === min;
                    return (
                      <td
                        key={offer.id}
                        className={`min-w-[180px] px-2 py-1 ${
                          isBest ? 'bg-green-100 dark:bg-green-900/30' : ''
                        }`}
                      >
                        {row ? (
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="font-medium">CHF {formatCHF(row.totalPrice)}</div>
                              <div className="text-xs text-neutral-500">
                                {row.quantity ?? '–'} {row.unit} × {formatCHF(row.unitPrice)}
                              </div>
                            </div>
                            <button
                              title="Original-PDF anzeigen"
                              className="shrink-0 rounded px-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                              onClick={() => setViewer({ offer, page: row.page, rawText: row.rawText })}
                            >
                              PDF
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">keine Position</span>
                        )}
                        <select
                          className="mt-1 w-full rounded border border-neutral-200 bg-white text-xs dark:border-neutral-700 dark:bg-neutral-900"
                          value={row?.id ?? ''}
                          onChange={(e) => onReassign(group.id, offer.id, e.target.value || null)}
                        >
                          <option value="">— keine —</option>
                          {offer.rows.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.code} – {r.description.slice(0, 30)}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-300 font-medium dark:border-neutral-600">
              <td className="px-2 py-2" colSpan={2}>
                Summe
              </td>
              {offers.map((o) => (
                <td key={o.id} className="px-2 py-2">
                  CHF {formatCHF(offerTotals.get(o.id) ?? 0)}
                </td>
              ))}
            </tr>
            <tr className="text-green-700 dark:text-green-400">
              <td className="px-2 py-2" colSpan={2}>
                Günstigste Kombination
              </td>
              <td className="px-2 py-2 font-semibold" colSpan={offers.length}>
                CHF {formatCHF(bestCombinationTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {viewer && (
        <PdfViewerModal
          fileName={viewer.offer.fileName}
          fileData={viewer.offer.fileData}
          page={viewer.page}
          rawText={viewer.rawText}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
