import type { Offer } from '../lib/types';
import { formatCHF } from '../lib/numberFormat';
import PdfPageCanvas from './PdfPageCanvas';

interface Entry {
  offer: Offer;
  page: number;
  quantity: number | null;
  unit: string;
  totalPrice: number | null;
}

interface Props {
  groupLabel: string;
  entries: Entry[];
  onClose: () => void;
}

/** Zeigt die Original-PDF-Seiten mehrerer Offerten für dieselbe Position nebeneinander an, statt einzeln nacheinander. */
export default function ComparePdfModal({ groupLabel, entries, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">{groupLabel}</div>
            <div className="text-xs text-neutral-500">
              {entries.length} Offerte{entries.length === 1 ? '' : 'n'} im direkten Vergleich
            </div>
          </div>
          <button
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
            onClick={onClose}
          >
            Schliessen
          </button>
        </div>
        <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4">
          {entries.map(({ offer, page, quantity, unit, totalPrice }) => (
            <div
              key={offer.id}
              className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700"
            >
              <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">{offer.name}</div>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Seite {page}</span>
                  <span>
                    {quantity ?? '–'} {unit} · CHF {formatCHF(totalPrice)}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-neutral-100 p-2 dark:bg-neutral-950">
                <PdfPageCanvas fileData={offer.fileData} page={page} scale={1.3} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
