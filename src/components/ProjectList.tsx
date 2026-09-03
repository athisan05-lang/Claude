import { useMemo, useState } from 'react';
import type { Project } from '../lib/types';
import { formatCHF } from '../lib/numberFormat';
import { cheapestTotalForSubProject } from '../lib/cost';

interface Props {
  projects: Project[];
  onOpen: (project: Project) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

type SortMode = 'updated' | 'name';

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
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
    list = [...list].sort((a, b) =>
      sortMode === 'name' ? a.name.localeCompare(b.name, 'de') : b.updatedAt - a.updatedAt,
    );
    return list;
  }, [projects, search, sortMode]);

  return (
    <div className="min-h-full bg-neutral-50 dark:bg-neutral-950">
      <div className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Offertenvergleich
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Vergleiche Subunternehmer- und Lieferanten-Offerten Position für Position nach NPK-Nummer. Alles
            läuft lokal in deinem Browser, es wird nichts hochgeladen.
          </p>
          <button
            className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            onClick={onCreate}
          >
            + Neues Projekt
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {projects.length === 0 ? (
          <button
            onClick={onCreate}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 py-16 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:border-neutral-700 dark:hover:bg-blue-950/20"
          >
            <span className="text-3xl">📋</span>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Noch keine Projekte</span>
            <span className="text-sm text-neutral-500">Klicken, um dein erstes Bauprojekt anzulegen</span>
          </button>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <input
                type="search"
                placeholder="Projekt suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="updated">Zuletzt geändert</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => {
                const offerCount = p.subProjects.reduce((s, sp) => s + sp.offers.length, 0);
                const total = p.subProjects.reduce((s, sp) => s + cheapestTotalForSubProject(sp), 0);
                return (
                  <div
                    key={p.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-400" />
                    <button className="flex-1 p-4 text-left" onClick={() => onOpen(p)}>
                      <div className="mb-1 flex items-start gap-2">
                        <span className="text-lg leading-none">📁</span>
                        <span className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-50">
                          {p.name}
                        </span>
                      </div>
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
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
                      {total > 0 && (
                        <div className="text-sm font-medium text-green-700 dark:text-green-400">
                          CHF {formatCHF(total)} günstigste Kombination
                        </div>
                      )}
                    </button>
                    {confirmDelete === p.id ? (
                      <div className="flex items-center gap-1 border-t border-neutral-100 px-4 py-2 text-xs dark:border-neutral-800">
                        Projekt löschen?
                        <button
                          className="rounded bg-red-600 px-2 py-1 text-white"
                          onClick={() => {
                            onDelete(p.id);
                            setConfirmDelete(null);
                          }}
                        >
                          Ja
                        </button>
                        <button
                          className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Nein
                        </button>
                      </div>
                    ) : (
                      <button
                        title="Projekt löschen"
                        className="absolute right-3 top-4 rounded p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(p.id);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
              {visible.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-neutral-500">
                  Kein Projekt gefunden für "{search}".
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
