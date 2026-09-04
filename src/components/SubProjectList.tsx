import { useState } from 'react';
import type { Project } from '../lib/types';
import { formatCHF } from '../lib/numberFormat';
import { cheapestTotalForSubProject } from '../lib/cost';

interface Props {
  project: Project;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  onOpenSubProject: (id: string) => void;
  onCreateSubProject: (name: string) => void;
  onDeleteSubProject: (id: string) => void;
}

export default function SubProjectList({
  project,
  onBack,
  onRenameProject,
  onOpenSubProject,
  onCreateSubProject,
  onDeleteSubProject,
}: Props) {
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="min-h-full bg-neutral-50 dark:bg-neutral-950">
      <div className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <button
            className="mb-3 text-sm font-medium text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400"
            onClick={onBack}
          >
            ← Projekte
          </button>
          <input
            className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-2xl font-bold tracking-tight text-neutral-900 transition hover:border-neutral-300 focus:border-indigo-400 focus:outline-none dark:text-neutral-50"
            value={project.name}
            onChange={(e) => onRenameProject(e.target.value)}
          />
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Ein Hauptprojekt kann mehrere Bereiche/Gewerke enthalten (z.B. verschiedene NPK-Kapitel), die jeweils
            eigene Offerten und einen eigenen Vergleich haben.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <form
          className="mb-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (!name) return;
            onCreateSubProject(name);
            setNewName('');
          }}
        >
          <input
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="Name des neuen Bereichs, z.B. 132 Bohren und Trennen"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="shrink-0 rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50"
          >
            + Bereich hinzufügen
          </button>
        </form>

        {project.subProjects.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Noch keine Bereiche – leg oben den ersten an.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.subProjects.map((sp) => (
              <div
                key={sp.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-900/5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-indigo-400" />
                <div className="p-4">
                  <button className="w-full text-left" onClick={() => onOpenSubProject(sp.id)}>
                    <div className="mb-1 truncate text-base font-semibold text-neutral-900 dark:text-neutral-50">
                      {sp.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {sp.offers.length} Offerte{sp.offers.length === 1 ? '' : 'n'}
                    </div>
                    {sp.groups.length > 0 && (
                      <div className="mt-2 text-sm font-medium text-green-700 dark:text-green-400">
                        günstigste Kombination: CHF {formatCHF(cheapestTotalForSubProject(sp))}
                      </div>
                    )}
                  </button>
                  {confirmDelete === sp.id ? (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      Löschen?
                      <button
                        className="rounded bg-red-600 px-2 py-1 text-white"
                        onClick={() => {
                          onDeleteSubProject(sp.id);
                          setConfirmDelete(null);
                        }}
                      >
                        Ja
                      </button>
                      <button
                        className="rounded border border-neutral-300 px-2 py-1"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Nein
                      </button>
                    </div>
                  ) : (
                    <button
                      title="Bereich löschen"
                      className="absolute right-3 top-3 rounded p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(sp.id);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
