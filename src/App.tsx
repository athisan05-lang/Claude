import { useEffect, useRef, useState } from 'react';
import type { Offer, PositionRow, Project } from './lib/types';
import { deleteProject, listProjects, saveProject } from './lib/db';
import { parseOfferPdf } from './lib/pdfParser';
import { reconcileGroups } from './lib/matchEngine';
import UploadArea from './components/UploadArea';
import OfferEditor from './components/OfferEditor';
import ComparisonView from './components/ComparisonView';

function uuid(): string {
  return crypto.randomUUID();
}

function newProject(): Project {
  return { id: uuid(), name: 'Neues Projekt', offers: [], groups: [], updatedAt: Date.now() };
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<'offerten' | 'vergleich'>('offerten');
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  function commit(next: Project) {
    next.updatedAt = Date.now();
    setProject(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveProject(next);
    }, 400);
  }

  function withReconciledGroups(next: Project): Project {
    return { ...next, groups: reconcileGroups(next.offers, next.groups) };
  }

  async function handleOpenProject(p: Project) {
    setProject(p);
    setTab('offerten');
  }

  async function handleCreateProject() {
    const p = newProject();
    await saveProject(p);
    setProjects(await listProjects());
    setProject(p);
    setTab('offerten');
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('Dieses Projekt inkl. aller Offerten wirklich löschen?')) return;
    await deleteProject(id);
    setProjects(await listProjects());
  }

  function backToList() {
    setProject(null);
    listProjects().then(setProjects);
  }

  async function handleFiles(files: File[]) {
    if (!project) return;
    setBusy(true);
    try {
      const newOffers: Offer[] = [];
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const offerId = uuid();
        const { rows, pageCount } = await parseOfferPdf(buf, offerId);
        newOffers.push({
          id: offerId,
          name: file.name.replace(/\.pdf$/i, ''),
          fileName: file.name,
          fileData: buf,
          pageCount,
          rows,
          createdAt: Date.now(),
        });
      }
      const next = withReconciledGroups({ ...project, offers: [...project.offers, ...newOffers] });
      commit(next);
    } finally {
      setBusy(false);
    }
  }

  function updateOfferRows(offerId: string, updater: (rows: PositionRow[]) => PositionRow[]) {
    if (!project) return;
    const offers = project.offers.map((o) => (o.id === offerId ? { ...o, rows: updater(o.rows) } : o));
    commit(withReconciledGroups({ ...project, offers }));
  }

  function renameOffer(offerId: string, name: string) {
    if (!project) return;
    const offers = project.offers.map((o) => (o.id === offerId ? { ...o, name } : o));
    commit({ ...project, offers });
  }

  function deleteOffer(offerId: string) {
    if (!project) return;
    const offers = project.offers.filter((o) => o.id !== offerId);
    commit(withReconciledGroups({ ...project, offers }));
  }

  function reassignRow(groupId: string, offerId: string, rowId: string | null) {
    if (!project) return;
    const groups = project.groups.map((g) => {
      const assignments = { ...g.assignments };
      if (g.id !== groupId && assignments[offerId] === rowId) {
        delete assignments[offerId];
      } else if (g.id === groupId) {
        if (rowId) assignments[offerId] = rowId;
        else delete assignments[offerId];
      }
      return { ...g, assignments };
    });
    const cleaned = groups.filter((g) => Object.keys(g.assignments).length > 0);
    // Zeile, die vorher in der Zielgruppe stand, ist jetzt evtl. verwaist -> neu einsortieren,
    // statt sie stillschweigend aus dem Vergleich verschwinden zu lassen.
    commit(withReconciledGroups({ ...project, groups: cleaned }));
  }

  function updateGroupMeta(groupId: string, patch: Partial<{ code: string; description: string }>) {
    if (!project) return;
    const groups = project.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
    commit({ ...project, groups });
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Offertenvergleich</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Vergleiche Subunternehmer- und Lieferanten-Offerten Position für Position nach NPK-Nummer. Alles läuft
          lokal in deinem Browser, es wird nichts hochgeladen.
        </p>
        <button
          className="mb-6 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={handleCreateProject}
        >
          + Neues Vergleichsprojekt
        </button>

        {projects.length > 0 && (
          <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-700">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <button className="text-left" onClick={() => handleOpenProject(p)}>
                  <div className="font-medium text-neutral-800 dark:text-neutral-100">{p.name}</div>
                  <div className="text-xs text-neutral-500">
                    {p.offers.length} Offerte(n) · zuletzt geändert {new Date(p.updatedAt).toLocaleString('de-CH')}
                  </div>
                </button>
                <button
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                  onClick={() => handleDeleteProject(p.id)}
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <button className="text-sm text-blue-600 hover:underline" onClick={backToList}>
          ← Projekte
        </button>
        <input
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold text-neutral-900 hover:border-neutral-300 focus:border-blue-400 focus:outline-none dark:text-neutral-50"
          value={project.name}
          onChange={(e) => commit({ ...project, name: e.target.value })}
        />
      </div>

      <div className="mb-4 flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
        <button
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'offerten'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
          onClick={() => setTab('offerten')}
        >
          Offerten ({project.offers.length})
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'vergleich'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
          onClick={() => setTab('vergleich')}
        >
          Vergleich
        </button>
      </div>

      {tab === 'offerten' && (
        <div className="space-y-6">
          <UploadArea onFiles={handleFiles} busy={busy} />
          {project.offers.map((offer) => (
            <OfferEditor
              key={offer.id}
              offer={offer}
              onRename={(name) => renameOffer(offer.id, name)}
              onUpdateRow={(rowId, patch) =>
                updateOfferRows(offer.id, (rows) => rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
              }
              onDeleteRow={(rowId) => updateOfferRows(offer.id, (rows) => rows.filter((r) => r.id !== rowId))}
              onAddRow={() =>
                updateOfferRows(offer.id, (rows) => [
                  ...rows,
                  {
                    id: uuid(),
                    code: '',
                    description: '',
                    quantity: null,
                    unit: '',
                    unitPrice: null,
                    totalPrice: null,
                    page: 1,
                    rawText: '',
                    autoDetected: false,
                  },
                ])
              }
              onDeleteOffer={() => deleteOffer(offer.id)}
            />
          ))}
        </div>
      )}

      {tab === 'vergleich' && (
        <ComparisonView
          projectName={project.name}
          offers={project.offers}
          groups={project.groups}
          onReassign={reassignRow}
          onUpdateGroup={updateGroupMeta}
        />
      )}
    </div>
  );
}
