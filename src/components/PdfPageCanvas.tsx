import { useEffect, useRef, useState } from 'react';
import { pdfjsLib } from '../lib/pdfjsSetup';

interface Props {
  fileData: ArrayBuffer;
  page: number;
  scale?: number;
}

/** Rendert eine einzelne PDF-Seite auf ein Canvas. Wird sowohl im Einzel- als auch im Nebeneinander-Vergleichs-Viewer verwendet. */
export default function PdfPageCanvas({ fileData, page, scale = 1.5 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const doc = await pdfjsLib.getDocument({ data: fileData.slice(0) }).promise;
      if (cancelled) return;
      const pdfPage = await doc.getPage(Math.min(Math.max(page, 1), doc.numPages));
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fileData, page, scale]);

  return (
    <>
      {loading && <div className="p-4 text-center text-xs text-neutral-500">PDF wird geladen…</div>}
      <canvas ref={canvasRef} className="mx-auto shadow" />
    </>
  );
}
