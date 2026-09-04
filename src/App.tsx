import { useEffect, useRef, useState } from 'react';
import type { Offer, PositionRow, Project, SubProject } from './lib/types';
import { deleteProject, listProjects, saveProject } from './lib/db';
import { parseOfferPdf } from './lib/pdfParser';
import { reconcileGroups } from './lib/matchEngine';
import ProjectList from './components/ProjectList';
import SubProjectList from './components/SubProjectList';
import UploadArea from './components/UploadArea';
import OfferEditor from './components/OfferEditor';
import ComparisonView from './components/ComparisonView';

function uuid(): string {
  return crypto.randomUUID();
}

function newProject(name: string): Project {
  return { id: uuid(), name, subProjects: [], updatedAt: Date.now() };
}

function newSubProject(name: string): SubProject {
  return { id: uuid(), name, offers: [], groups: [], updatedAt: Date.now() };
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [subProjectId, setSubProjectId] = useState<string | null>(null);
  const [tab, setTab] = useState<'offerten' | 'vergleich'>('offerten');
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [uploadError, setUploadError] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  const subProject = project?.subProjects.find((sp) => sp.id === subProjectId) ?? null;

  function commit(next: Project) {
    next.updatedAt = Date.now();
    setProject(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveProject(next);
    }, 400);
  }

  function withReconciledGroups(sp: SubProject): SubProject {
    return { ...sp, groups: reconcileGroups(sp.offers, sp.groups) };
  }

  function updateSubProject(id: string, updater: (sp: SubProject) => SubProject) {
    if (!project) return;
    const subProjects = project.subProjects.map((sp) => (sp.id === id ? { ...updater(sp), updatedAt: Date.now() } : sp));
    commit({ ...project, subProjects });
  }

  async function handleOpenProject(p: Project) {
    setProject(p);
    setSubProjectId(null);
  }

  async function handleCreateProject() {
    const p = newProject('Neues Projekt');
    await saveProject(p);
    setProjects(await listProjects());
    setProject(p);
    setSubProjectId(null);
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('Dieses Projekt inkl. aller Bereiche und Offerten wirklich löschen?')) return;
    await deleteProject(id);
    setProjects(await listProjects());
  }

  function backToProjectList() {
    setProject(null);
    setSubProjectId(null);
    listProjects().then(setProjects);
  }

  function backToSubProjectList() {
    setSubProjectId(null);
  }

  function handleCreateSubProject(name: string) {
    if (!project) return;
    const sp = newSubProject(name);
    commit({ ...project, subProjects: [...project.subProjects, sp] });
    setSubProjectId(sp.id);
    setTab('offerten');
  }

  function handleDeleteSubProject(id: string) {
    if (!project) return;
    commit({ ...project, subProjects: project.subProjects.filter((sp) => sp.id !== id) });
  }

  async function handleFiles(files: File[]) {
    if (!subProject) return;
    setBusy(true);
    setProgressText('');
    setUploadError('');
    const failed: string[] = [];
    try {
      const newOffers: Offer[] = [];
      for (const file of files) {
        try {
          const buf = await file.arrayBuffer();
          const offerId = uuid();
          const { rows, pageCount, ocrUsed } = await parseOfferPdf(buf, offerId, (p) =>
            setProgressText(`${file.name}: Seite ${p.page}/${p.pageCount} per OCR lesen…`),
          );
          newOffers.push({
            id: offerId,
            name: file.name.replace(/\.pdf$/i, ''),
            fileName: file.name,
            fileData: buf,
            pageCount,
            rows,
            createdAt: Date.now(),
            ocrUsed,
          });
        } catch (err) {
          console.error('PDF-Verarbeitung fehlgeschlagen:', file.name, err);
          failed.push(file.name);
        }
      }
      if (newOffers.length > 0) {
        updateSubProject(subProject.id, (sp) => withReconciledGroups({ ...sp, offers: [...sp.offers, ...newOffers] }));
      }
      if (failed.length > 0) {
        setUploadError(
          `${failed.join(', ')} konnte${failed.length === 1 ? '' : 'n'} nicht verarbeitet werden. Bitte nochmals versuchen oder die Positionen manuell erfassen.`,
        );
      }
    } finally {
      setBusy(false);
      setProgressText('');
    }
  }

  function updateOfferRows(offerId: string, updater: (rows: PositionRow[]) => PositionRow[]) {
    if (!subProject) return;
    updateSubProject(subProject.id, (sp) =>
      withReconciledGroups({ ...sp, offers: sp.offers.map((o) => (o.id === offerId ? { ...o, rows: updater(o.rows) } : o)) }),
    );
  }

  function renameOffer(offerId: string, name: string) {
    if (!subProject) return;
    updateSubProject(subProject.id, (sp) => ({
      ...sp,
      offers: sp.offers.map((o) => (o.id === offerId ? { ...o, name } : o)),
    }));
  }

  function deleteOffer(offerId: string) {
    if (!subProject) return;
    updateSubProject(subProject.id, (sp) => withReconciledGroups({ ...sp, offers: sp.offers.filter((o) => o.id !== offerId) }));
  }

  function reassignRow(groupId: string, offerId: string, rowId: string | null) {
    if (!subProject) return;
    updateSubProject(subProject.id, (sp) => {
      const groups = sp.groups.map((g) => {
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
      return withReconciledGroups({ ...sp, groups: cleaned });
    });
  }

  function updateGroupMeta(groupId: string, patch: Partial<{ code: string; description: string }>) {
    if (!subProject) return;
    updateSubProject(subProject.id, (sp) => ({
      ...sp,
      groups: sp.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
    }));
  }

  if (!project) {
    return (
      <ProjectList
        projects={projects}
        onOpen={handleOpenProject}
        onCreate={handleCreateProject}
        onDelete={handleDeleteProject}
      />
    );
  }

  if (!subProject) {
    return (
      <SubProjectList
        project={project}
        onBack={backToProjectList}
        onRenameProject={(name) => commit({ ...project, name })}
        onOpenSubProject={(id) => {
          setSubProjectId(id);
          setTab('offerten');
        }}
        onCreateSubProject={handleCreateSubProject}
        onDeleteSubProject={handleDeleteSubProject}
      />
    );
  }

  return (
    <div className="min-h-full bg-neutral-50 dark:bg-neutral-950">
      <div className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <button
            className="mb-2 text-sm font-medium text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400"
            onClick={backToSubProjectList}
          >
            ← {project.name}
          </button>
          <input
            className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-2xl font-bold tracking-tight text-neutral-900 transition hover:border-neutral-300 focus:border-indigo-400 focus:outline-none dark:text-neutral-50"
            value={subProject.name}
            onChange={(e) => updateSubProject(subProject.id, (sp) => ({ ...sp, name: e.target.value }))}
          />

          <div className="mt-5 inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
            <button
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                tab === 'offerten'
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-neutral-700 dark:text-indigo-300'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              onClick={() => setTab('offerten')}
            >
              Offerten ({subProject.offers.length})
            </button>
            <button
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                tab === 'vergleich'
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-neutral-700 dark:text-indigo-300'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              onClick={() => setTab('vergleich')}
            >
              Vergleich
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
      {tab === 'offerten' && (
        <div className="space-y-6">
          <UploadArea onFiles={handleFiles} busy={busy} progressText={progressText} />
          {uploadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {uploadError}
            </div>
          )}
          {subProject.offers.map((offer) => (
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
          projectName={`${project.name} - ${subProject.name}`}
          offers={subProject.offers}
          groups={subProject.groups}
          onReassign={reassignRow}
          onUpdateGroup={updateGroupMeta}
        />
      )}
      </div>
    </div>
  );
}
