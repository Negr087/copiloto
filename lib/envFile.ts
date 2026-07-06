import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Minimal .env writer for the dev-only /setup flow. Upserts KEY=value into the
 * project's .env, preserving other lines, and mirrors the change into
 * process.env so it takes effect immediately (no server restart).
 *
 * .env is gitignored — credentials never get committed.
 */

const ENV_PATH = path.join(process.cwd(), '.env');
const KEY_RE = /^[A-Z][A-Z0-9_]*$/;

export async function saveEnvVar(key: string, rawValue: string): Promise<void> {
  if (!KEY_RE.test(key)) {
    throw new Error(`Clave de entorno inválida: ${key}`);
  }
  const value = rawValue.trim();
  if (value === '' || /[\r\n]/.test(value)) {
    throw new Error('Valor de entorno inválido (vacío o con saltos de línea).');
  }

  let content = '';
  try {
    content = await fs.readFile(ENV_PATH, 'utf8');
  } catch {
    content = '';
  }

  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    content += `${line}\n`;
  }

  await fs.writeFile(ENV_PATH, content, 'utf8');
  process.env[key] = value;
}

/** Remove a key from .env and process.env (used when switching modes). */
export async function clearEnvVar(key: string): Promise<void> {
  if (!KEY_RE.test(key)) throw new Error(`Clave de entorno inválida: ${key}`);
  delete process.env[key];
  let content = '';
  try {
    content = await fs.readFile(ENV_PATH, 'utf8');
  } catch {
    return;
  }
  const re = new RegExp(`^${key}=.*(\\r?\\n)?`, 'm');
  const next = content.replace(re, '');
  if (next !== content) await fs.writeFile(ENV_PATH, next, 'utf8');
}
