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
const DESCRIPTION_MISMATCH_THRESHOLD = 0.12;
// Bei gleicher Position sollte die Menge zwischen den Offerten übereinstimmen (gleiche Ausmasse).
// Kleine Rundungsdifferenzen tolerieren, ab ca. 3% Abweichung ist es meist ein echter Fehler.
const QUANTITY_MISMATCH_THRESHOLD = 0.03;

type SortMode = 'code' | 'delta';

interface GroupComputed {
  group: MatchGroup;
  cells: { offer: Offer; row: ReturnType<typeof findRow> }[];
  min: number | null;
  delta: number;
  descriptionMismatch: boolean;
  quantityMismatch: boolean;
  allSame: boolean;
}

function quantitiesMismatch(cells: GroupComputed['cells']): boolean {
  const qtys = cells.map((c) => c.row?.quantity).filter((q): q is number => q != null && q > 0);
  if (qtys.length < 2) return false;
  const min = Math.min(...qtys);
  const max = Math.max(...qtys);
  return (max - min) / min > QUANTITY_MISMATCH_THRESHOLD;
}

export default function ComparisonView({ projectName, offers, groups, onReassign, onUpdateGroup }: Props) {
  const [viewer, setViewer] = useState<{ offer: Offer; page: number; rawText: string } | null>(null);
  const [search, setSearch] = useState('');
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('code');

  const computed = useMemo(() => {
    const offerTotals = new Map<string, number>();

    const rows: GroupComputed[] = groups.map((group) => {
      const cells = offers.map((offer) => {
        const rowId = group.assignments[offer.id];
        const row = rowId ? findRow(offers, offer.id, rowId) : undefined;
        return { offer, row };
      });
      const pricedTotals = cells.map((c) => c.row?.totalPrice).filter((v): v is number => v != null);
      const min = pricedTotals.length ? Math.min(...pricedTotals) : null;
      const delta = pricedTotals.length ? Math.max(...pricedTotals) - Math.min(...pricedTotals) : 0;
      const allSame = cells.every((c) => c.row) && pricedTotals.length === cells.length && delta === 0;
      for (const c of cells) {
        if (c.row?.totalPrice != null) {
          offerTotals.set(c.offer.id, (offerTotals.get(c.offer.id) ?? 0) + c.row.totalPrice);
        }
      }
      const similarity = minPairwiseSimilarity(cells.map((c) => c.row?.description ?? ''));
      const descriptionMismatch = similarity !== null && similarity < DESCRIPTION_MISMATCH_THRESHOLD;

      return { group, cells, min, delta, descriptionMismatch, quantityMismatch: quantitiesMismatch(cells), allSame };
    });

    const bestCombinationTotal = rows.reduce((sum, r) => sum + (r.min ?? 0), 0);

    const ranking = offers
      .map((o) => ({ offer: o, total: offerTotals.get(o.id) ?? 0 }))
      .sort((a, b) => a.total - b.total);
    const cheapestTotal = ranking[0]?.total ?? 0;

    return { rows, offerTotals, bestCombinationTotal, ranking, cheapestTotal };
  }, [offers, groups]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = computed.rows;
    if (q) {
      list = list.filter(
        (r) => r.group.code.toLowerCase().includes(q) || r.group.description.toLowerCase().includes(q),
      );
    }
    if (onlyDifferences) {
      list = list.filter((r) => !r.allSame);
    }
    if (sortMode === 'delta') {
      list = [...list].sort((a, b) => b.delta - a.delta);
    }
    return list;
  }, [computed.rows, search, onlyDifferences, sortMode]);

  if (offers.length === 0) {
    return <p className="text-sm text-neutral-500">Lade zuerst mindestens eine Offerte hoch.</p>;
  }

  const mismatchCount = computed.rows.filter((r) => r.descriptionMismatch || r.quantityMismatch).length;

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {computed.ranking.map(({ offer, total }, i) => (
          <div
            key={offer.id}
            className={`rounded-2xl border p-4 shadow-sm transition ${
              i === 0
                ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-neutral-800 dark:text-neutral-100">{offer.name}</span>
              {i === 0 && (
                <span className="whitespace-nowrap rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
                  🏆 günstigster
                </span>
              )}
            </div>
            <div className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Position suchen (NPK-Nr. oder Bezeichnung)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="code">Sortiert nach NPK-Nr.</option>
          <option value="delta">Grösste Preisspanne zuerst</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={onlyDifferences}
            onChange={(e) => setOnlyDifferences(e.target.checked)}
            className="rounded"
          />
          Nur Positionen mit Preisunterschied
        </label>
        <button
          className="ml-auto whitespace-nowrap rounded-lg bg-gradient-to-b from-green-600 to-green-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-green-700/20 transition hover:from-green-700 hover:to-green-800"
          onClick={() => exportComparisonToExcel(projectName, offers, groups)}
        >
          ⇩ Als Excel exportieren
        </button>
      </div>

      <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">
        {visibleRows.length} von {computed.rows.length} Positionen angezeigt. Günstigster Preis pro Position ist
        grün hervorgehoben.{' '}
        {mismatchCount > 0 && (
          <span className="font-medium text-amber-700 dark:text-amber-400">
            ⚠ {mismatchCount} Position{mismatchCount === 1 ? '' : 'en'} mit auffälliger Bezeichnung oder Menge –
            bitte prüfen.
          </span>
        )}
      </p>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-neutral-200 shadow-sm dark:border-neutral-700">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800">
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
            {visibleRows.map(({ group, cells, min, descriptionMismatch, quantityMismatch }) => (
              <tr
                key={group.id}
                className="border-b border-neutral-100 align-top transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40"
              >
                <td className="px-1 py-1">
                  <div className="flex items-center gap-1">
                    {descriptionMismatch && (
                      <span
                        title="Bezeichnungen weichen stark voneinander ab – Zuordnung prüfen"
                        className="text-amber-500"
                      >
                        ⚠
                      </span>
                    )}
                    {quantityMismatch && (
                      <span
                        title="Mengen weichen zwischen den Offerten stark voneinander ab – bitte prüfen"
                        className="text-sky-500"
                      >
                        📏
                      </span>
                    )}
                    <input
                      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-indigo-400 focus:outline-none"
                      value={group.code}
                      onChange={(e) => onUpdateGroup(group.id, { code: e.target.value })}
                    />
                  </div>
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-full min-w-[200px] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-indigo-400 focus:outline-none"
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
                            <div
                              className={`text-xs ${quantityMismatch ? 'font-medium text-sky-600 dark:text-sky-400' : 'text-neutral-500'}`}
                            >
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
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={2 + offers.length} className="px-2 py-8 text-center text-sm text-neutral-500">
                  Keine Positionen gefunden.
                </td>
              </tr>
            )}
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
