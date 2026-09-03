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

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put(STORE, project);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDb();
  return db.get(STORE, id);
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as Project[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}
