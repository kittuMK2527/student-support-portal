import type { Database } from '@/types';

export const DB_KEY = 'support-portal.db.v1';
export const DB_VERSION = 3; // bump when the shape changes: older saved data is replaced by a fresh seed

interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
const memory = new Map<string, string>();
const memoryStore: KV = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};
function store(): KV {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* blocked storage: fall back */
  }
  return memoryStore;
}

let cache: Database | null = null;
const REQUIRED_LISTS: (keyof Database)[] = [
  'colleges',
  'teams',
  'owners',
  'users',
  'tickets',
  'events',
  'emails',
  'departments',
  'subjects',
  'enrollments',
  'results',
  'attendance',
  'timetable',
  'notices',
];

export function readDb(): Database | null {
  if (cache) return cache;
  const raw = store().getItem(DB_KEY);
  if (!raw) return null;
  try {
    const db = JSON.parse(raw) as Database;
    // older or incomplete data: reseed
    if (db.version !== DB_VERSION || REQUIRED_LISTS.some((k) => !Array.isArray(db[k]))) return null;
    cache = db;
    return db;
  } catch {
    return null;
  }
}

export function writeDb(db: Database): void {
  cache = db;
  store().setItem(DB_KEY, JSON.stringify(db));
}

export function clearDb(): void {
  cache = null;
  store().removeItem(DB_KEY);
}
