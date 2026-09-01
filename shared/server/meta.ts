import { query, execute } from './db';
import type { AppMeta } from '@/shared/types';

export async function getMeta(key: string): Promise<string | null> {
  const rows = await query<{ meta_value: string | null }>('SELECT meta_value FROM app_meta WHERE meta_key = ?', [key]);
  return rows[0]?.meta_value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await execute('INSERT INTO app_meta (meta_key, meta_value) VALUES (?,?) ON DUPLICATE KEY UPDATE meta_value = ?', [key, value, value]);
}

export async function getAllMeta(): Promise<AppMeta> {
  const rows = await query<{ meta_key: string; meta_value: string | null }>('SELECT meta_key, meta_value FROM app_meta');
  const out: Record<string, string> = {};
  for (const r of rows) out[r.meta_key] = r.meta_value ?? '';
  return out as AppMeta;
}
