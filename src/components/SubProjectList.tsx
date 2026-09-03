import { useState } from 'react';
import type { Project } from '../lib/types';
import { formatCHF } from '../lib/numberFormat';

interface Props {
  project: Project;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  onOpenSubProject: (id: string) => void;
  onCreateSubProject: (name: string) => void;
  onDeleteSubProject: (id: string) => void;
}

function cheapestTotal(sp: Project['subProjects'][number]): number {
  let total = 0;
  for (const group of sp.groups) {
    const totals = Object.entries(group.assignments)
      .map(([offerId, rowId]) => sp.offers.find((o) => o.id === offerId)?.rows.find((r) => r.id === rowId)?.totalPrice)
      .filter((v): v is number => v != null);
    if (totals.length) total += Math.min(...totals);
  }
  return total;
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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button className="text-sm text-blue-600 hover:underline" onClick={onBack}>
          ← Projekte
        </button>
        <input
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold text-neutral-900 hover:border-neutral-300 focus:border-blue-400 focus:outline-none dark:text-neutral-50"
          value={project.name}
          onChange={(e) => onRenameProject(e.target.value)}
        />
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        Ein Hauptprojekt kann mehrere Bereiche/Gewerke enthalten (z.B. verschiedene NPK-Kapitel), die jeweils
        eigene Offerten und einen eigenen Vergleich haben.
      </p>

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
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
          placeholder="Name des neuen Bereichs, z.B. 132 Bohren und Trennen"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          + Bereich hinzufügen
        </button>
      </form>

      {project.subProjects.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Noch keine Bereiche – leg oben den ersten an.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {project.subProjects.map((sp) => (
            <div
              key={sp.id}
              className="group relative flex flex-col rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900"
            >
              <button className="flex-1 text-left" onClick={() => onOpenSubProject(sp.id)}>
                <div className="mb-1 truncate text-base font-semibold text-neutral-900 dark:text-neutral-50">
                  {sp.name}
                </div>
                <div className="text-xs text-neutral-500">
                  {sp.offers.length} Offerte{sp.offers.length === 1 ? '' : 'n'}
                </div>
                {sp.groups.length > 0 && (
                  <div className="mt-2 text-sm font-medium text-green-700 dark:text-green-400">
                    günstigste Kombination: CHF {formatCHF(cheapestTotal(sp))}
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
                  <button className="rounded border border-neutral-300 px-2 py-1" onClick={() => setConfirmDelete(null)}>
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
          ))}
        </div>
      )}
    </div>
  );
}
