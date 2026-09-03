import { useMemo, useState } from 'react';
import type { MatchGroup, Offer } from '../lib/types';
import { findRow } from '../lib/matchEngine';
import { formatCHF } from '../lib/numberFormat';
import { exportComparisonToExcel } from '../lib/excelExport';
import { minPairwiseSimilarity } from '../lib/similarity';
import PdfViewerModal from './PdfViewerModal';

interface Props {
  projectName: string;
  offers: Offer[];
  groups: MatchGroup[];
  onReassign: (groupId: string, offerId: string, rowId: string | null) => void;
  onUpdateGroup: (groupId: string, patch: Partial<Pick<MatchGroup, 'code' | 'description'>>) => void;
}

// Bewusst tief angesetzt: Subunternehmer formulieren dieselbe Position oft sehr unterschiedlich.
// Der Hinweis soll nur bei wirklich kaum überlappenden Texten aufblinken, nicht bei jeder Umformulierung.
const MISMATCH_THRESHOLD = 0.12;

interface GroupComputed {
  group: MatchGroup;
  cells: { offer: Offer; row: ReturnType<typeof findRow> }[];
  min: number | null;
  mismatch: boolean;
}

export default function ComparisonView({ projectName, offers, groups, onReassign, onUpdateGroup }: Props) {
  const [viewer, setViewer] = useState<{ offer: Offer; page: number; rawText: string } | null>(null);

  const computed = useMemo(() => {
    const offerTotals = new Map<string, number>();

    const rows: GroupComputed[] = groups.map((group) => {
      const cells = offers.map((offer) => {
        const rowId = group.assignments[offer.id];
        const row = rowId ? findRow(offers, offer.id, rowId) : undefined;
        return { offer, row };
      });
      const pricedCells = cells.filter((c) => c.row?.totalPrice != null);
      const min = pricedCells.length ? Math.min(...pricedCells.map((c) => c.row!.totalPrice as number)) : null;
      for (const c of cells) {
        if (c.row?.totalPrice != null) {
          offerTotals.set(c.offer.id, (offerTotals.get(c.offer.id) ?? 0) + c.row.totalPrice);
        }
      }
      const similarity = minPairwiseSimilarity(cells.map((c) => c.row?.description ?? ''));
      const mismatch = similarity !== null && similarity < MISMATCH_THRESHOLD;

      return { group, cells, min, mismatch };
    });

    const bestCombinationTotal = rows.reduce((sum, r) => sum + (r.min ?? 0), 0);

    const ranking = offers
      .map((o) => ({ offer: o, total: offerTotals.get(o.id) ?? 0 }))
      .sort((a, b) => a.total - b.total);
    const cheapestTotal = ranking[0]?.total ?? 0;

    return { rows, offerTotals, bestCombinationTotal, ranking, cheapestTotal };
  }, [offers, groups]);

  if (offers.length === 0) {
    return <p className="text-sm text-neutral-500">Lade zuerst mindestens eine Offerte hoch.</p>;
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {computed.ranking.map(({ offer, total }, i) => (
          <div
            key={offer.id}
            className={`rounded-lg border p-3 ${
              i === 0
                ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                : 'border-neutral-200 dark:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-neutral-800 dark:text-neutral-100">{offer.name}</span>
              {i === 0 && (
                <span className="whitespace-nowrap rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                  günstigster
                </span>
              )}
            </div>
            <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              CHF {formatCHF(total)}
            </div>
            {i > 0 && (
              <div className="text-xs text-neutral-500">
                + CHF {formatCHF(total - computed.cheapestTotal)}
                {computed.cheapestTotal > 0
                  ? ` (${(((total - computed.cheapestTotal) / computed.cheapestTotal) * 100).toFixed(1)}%)`
                  : ''}{' '}
                mehr
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Günstigster Preis pro Position ist grün hervorgehoben. ⚠ markiert Positionen, deren Bezeichnungen
          zwischen den Offerten stark abweichen – dort lohnt sich ein Blick, ob die Zuordnung stimmt.
        </p>
        <button
          className="whitespace-nowrap rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800"
          onClick={() => exportComparisonToExcel(projectName, offers, groups)}
        >
          Als Excel exportieren
        </button>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10">
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
            {computed.rows.map(({ group, cells, min, mismatch }) => (
              <tr key={group.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                <td className="px-1 py-1">
                  <div className="flex items-center gap-1">
                    {mismatch && (
                      <span title="Bezeichnungen weichen stark voneinander ab – Zuordnung prüfen" className="text-amber-500">
                        ⚠
                      </span>
                    )}
                    <input
                      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
                      value={group.code}
                      onChange={(e) => onUpdateGroup(group.id, { code: e.target.value })}
                    />
                  </div>
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
                      className={`min-w-[180px] px-2 py-1 ${isBest ? 'bg-green-100 dark:bg-green-900/30' : ''}`}
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
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-300 bg-white font-medium dark:border-neutral-600 dark:bg-neutral-900">
              <td className="px-2 py-2" colSpan={2}>
                Summe
              </td>
              {offers.map((o) => (
                <td key={o.id} className="px-2 py-2">
                  CHF {formatCHF(computed.offerTotals.get(o.id) ?? 0)}
                </td>
              ))}
            </tr>
            <tr className="bg-white text-green-700 dark:bg-neutral-900 dark:text-green-400">
              <td className="px-2 py-2" colSpan={2}>
                Günstigste Kombination
              </td>
              <td className="px-2 py-2 font-semibold" colSpan={offers.length}>
                CHF {formatCHF(computed.bestCombinationTotal)}
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
