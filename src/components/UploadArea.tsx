import { useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
  progressText?: string;
}

export default function UploadArea({ onFiles, busy, progressText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-neutral-300 dark:border-neutral-700'
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
      <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-300">
        Offerten-PDFs hierher ziehen (ein PDF pro Anbieter) oder auswählen
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? 'Wird verarbeitet…' : 'PDFs auswählen'}
      </button>
      {busy && progressText && <p className="mt-2 text-xs text-neutral-500">{progressText}</p>}
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
