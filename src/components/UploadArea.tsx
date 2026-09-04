import { useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
  progressText?: string;
  /** Fortschritt 0..1, nur relevant während OCR (Text-PDFs sind zu schnell, um ihn sinnvoll anzuzeigen). */
  progress?: number;
}

export default function UploadArea({ onFiles, busy, progressText, progress }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
          : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <span className="mb-2 text-2xl">📄</span>
      <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">
        Offerten-PDFs hierher ziehen (ein PDF pro Anbieter) oder auswählen
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50"
      >
        {busy ? 'Wird verarbeitet…' : 'PDFs auswählen'}
      </button>
      {busy && progressText && (
        <div className="mt-3 w-full max-w-xs">
          {!!progress && (
            <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-[width] duration-300"
                style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
              />
            </div>
          )}
          <p className="text-xs text-neutral-500">{progressText}</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
