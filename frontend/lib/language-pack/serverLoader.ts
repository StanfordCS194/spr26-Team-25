// Server-only loader that reads pack JSON from the repo's packs/ directory
// and resolves dictionaryRef. Used by /api/packs/[id]/route.ts and any Server
// Component (e.g. the catalog) that needs pack bodies without an HTTP hop.
//
// Importing this module from a Client Component will fail at build time
// because node:fs is unavailable in the browser bundle.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parsePack } from './loader';
import type { LanguagePack } from './types';

const SLUG = /^[a-z][a-z0-9-]{1,40}$/;
const PACKS_DIR = path.join(process.cwd(), '..', 'packs');

async function readJson(absPath: string): Promise<unknown> {
  const raw = await fs.readFile(absPath, 'utf8');
  return JSON.parse(raw);
}

export async function readPackFromDisk(id: string): Promise<LanguagePack> {
  if (!SLUG.test(id)) {
    throw new Error(`invalid pack id: ${id}`);
  }

  const pack = (await readJson(path.join(PACKS_DIR, `${id}.json`))) as Record<string, unknown>;

  const grounding = pack.grounding as
    | { dictionaryRef?: string; dictionary?: unknown }
    | undefined;
  if (grounding?.dictionaryRef && !grounding.dictionary) {
    const ref = grounding.dictionaryRef;
    if (path.isAbsolute(ref) || ref.includes('..')) {
      throw new Error(`dictionaryRef must be relative and contained: ${ref}`);
    }
    const dict = await readJson(path.join(PACKS_DIR, ref));
    pack.grounding = { ...grounding, dictionary: dict, dictionaryRef: undefined };
  }

  return parsePack(pack);
}
