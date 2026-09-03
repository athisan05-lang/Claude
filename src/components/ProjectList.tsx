import type { Project } from '../lib/types';

interface Props {
  projects: Project[];
  onOpen: (project: Project) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 30) return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
  return new Date(ts).toLocaleDateString('de-CH');
}

export default function ProjectList({ projects, onOpen, onCreate, onDelete }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Offertenvergleich</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Vergleiche Subunternehmer- und Lieferanten-Offerten Position für Position nach NPK-Nummer. Alles
            läuft lokal in deinem Browser, es wird nichts hochgeladen.
          </p>
        </div>
        <button
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          onClick={onCreate}
        >
          + Neues Projekt
        </button>
      </div>

      {projects.length === 0 ? (
        <button
          onClick={onCreate}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 py-16 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:border-neutral-700 dark:hover:bg-blue-950/20"
        >
          <span className="text-3xl">📋</span>
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Noch keine Projekte
          </span>
          <span className="text-sm text-neutral-500">Klicken, um dein erstes Bauprojekt anzulegen</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const offerCount = p.subProjects.reduce((s, sp) => s + sp.offers.length, 0);
            return (
              <div
                key={p.id}
                className="group relative flex flex-col rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900"
              >
                <button className="flex-1 text-left" onClick={() => onOpen(p)}>
                  <div className="mb-1 truncate text-base font-semibold text-neutral-900 dark:text-neutral-50">
                    {p.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    <span>
                      {p.subProjects.length} Bereich{p.subProjects.length === 1 ? '' : 'e'}
                    </span>
                    <span>·</span>
                    <span>
                      {offerCount} Offerte{offerCount === 1 ? '' : 'n'}
                    </span>
                    <span>·</span>
                    <span>{relativeTime(p.updatedAt)}</span>
                  </div>
                </button>
                <button
                  title="Projekt löschen"
                  className="absolute right-3 top-3 rounded p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p.id);
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
