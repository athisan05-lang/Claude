import { openDB, type IDBPDatabase } from 'idb';
import type { Project } from './types';

const DB_NAME = 'offertenvergleich';
const STORE = 'projects';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

/**
 * Projekte aus einer älteren App-Version hatten Offerten/Gruppen direkt am Projekt statt
 * in Unterprojekten. Beim Laden in ein einzelnes Unterprojekt "Allgemein" umwandeln, damit
 * bestehende, lokal gespeicherte Daten nicht verloren gehen.
 */
function migrate(raw: unknown): Project {
  const p = raw as Project & { offers?: unknown; groups?: unknown };
  if (Array.isArray(p.subProjects)) return p;
  const legacy = p as unknown as { offers: Project['subProjects'][number]['offers']; groups: Project['subProjects'][number]['groups'] };
  return {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    subProjects:
      legacy.offers?.length || legacy.groups?.length
        ? [
            {
              id: `${p.id}-allgemein`,
              name: 'Allgemein',
              offers: legacy.offers ?? [],
              groups: legacy.groups ?? [],
              updatedAt: p.updatedAt,
            },
          ]
        : [],
  };
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put(STORE, project);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDb();
  const raw = await db.get(STORE, id);
  return raw ? migrate(raw) : undefined;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as unknown[];
  return all.map(migrate).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}
