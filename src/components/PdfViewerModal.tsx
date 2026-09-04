import { useEffect, useState } from 'react';
import { pdfjsLib } from '../lib/pdfjsSetup';
import PdfPageCanvas from './PdfPageCanvas';

interface Props {
  fileName: string;
  fileData: ArrayBuffer;
  page: number;
  rawText?: string;
  onClose: () => void;
}

export default function PdfViewerModal({ fileName, fileData, page, rawText, onClose }: Props) {
  const [currentPage, setCurrentPage] = useState(page);
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
    setCurrentPage(page);
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    pdfjsLib.getDocument({ data: fileData.slice(0) }).promise.then((doc) => {
      if (!cancelled) setPageCount(doc.numPages);
    });
    return () => {
      cancelled = true;
    };
  }, [fileData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-700">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{fileName}</div>
            <div className="text-xs text-neutral-500">
              Seite {currentPage}
              {pageCount ? ` / ${pageCount}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-neutral-600"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <button
              className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-neutral-600"
              disabled={pageCount !== null && currentPage >= pageCount}
              onClick={() => setCurrentPage((p) => (pageCount ? Math.min(pageCount, p + 1) : p + 1))}
            >
              ›
            </button>
            <button
              className="ml-2 rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600"
              onClick={onClose}
            >
              Schliessen
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-neutral-100 p-4 dark:bg-neutral-950">
          <PdfPageCanvas fileData={fileData} page={currentPage} scale={1.5} />
        </div>
        {rawText && (
          <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            <span className="font-medium">Erkannte Zeile:</span> {rawText}
          </div>
        )}
      </div>
    </div>
  );
}
