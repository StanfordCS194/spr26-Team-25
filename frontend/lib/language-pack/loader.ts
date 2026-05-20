// Frontend pack loader. Two consumption modes:
//
//   parsePack(jsonObject)   — for packs you already have in memory (e.g. static
//                             import, server-side preload, or an embedded pack)
//   loadPack(url)           — fetch a pack JSON from a URL and validate
//
// Validation here is intentionally shallow: structural shape only. The backend
// (pydantic + jsonschema) is the authoritative validator. The frontend's job is
// to refuse to render a clearly broken pack and to give a clear error.

import type { LanguagePack, LearnerProfile } from './types';

export class PackValidationError extends Error {
  readonly missingFields: string[];
  constructor(message: string, missingFields: string[] = []) {
    super(message);
    this.name = 'PackValidationError';
    this.missingFields = missingFields;
  }
}

const REQUIRED_FIELDS: Array<keyof LanguagePack> = [
  'id',
  'displayName',
  'status',
  'script',
  'tutor',
  'promptTemplate',
  'sovereignty',
];

const VALID_STATUSES = new Set(['vibrant', 'endangered', 'dormant', 'reconstructed']);

export function parsePack(json: unknown): LanguagePack {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new PackValidationError('Pack must be a JSON object.');
  }
  const obj = json as Record<string, unknown>;

  const missing = REQUIRED_FIELDS.filter((f) => obj[f] === undefined);
  if (missing.length > 0) {
    throw new PackValidationError(
      `Pack missing required field(s): ${missing.join(', ')}`,
      missing as string[],
    );
  }

  if (typeof obj.id !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(obj.id)) {
    throw new PackValidationError(`Pack id must be a lowercase slug; got: ${String(obj.id)}`);
  }
  if (typeof obj.status !== 'string' || !VALID_STATUSES.has(obj.status)) {
    throw new PackValidationError(`Pack status must be one of vibrant|endangered|dormant|reconstructed; got: ${String(obj.status)}`);
  }

  const script = obj.script as { unicodeRanges?: unknown };
  if (!script || !Array.isArray(script.unicodeRanges) || script.unicodeRanges.length === 0) {
    throw new PackValidationError('script.unicodeRanges must be a non-empty array.');
  }

  const tutor = obj.tutor as { name?: unknown; personaShort?: unknown };
  if (!tutor || typeof tutor.name !== 'string' || typeof tutor.personaShort !== 'string') {
    throw new PackValidationError('tutor.name and tutor.personaShort are required strings.');
  }

  const sovereignty = obj.sovereignty as { license?: unknown };
  if (!sovereignty || typeof sovereignty.license !== 'string') {
    throw new PackValidationError('sovereignty.license is required.');
  }

  return obj as unknown as LanguagePack;
}

export async function loadPack(url: string): Promise<LanguagePack> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Failed to load pack from ${url}: HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return parsePack(json);
}

// Convenience: derive the effective vocabulary line format after applying the
// same defaults the backend loader applies. Useful for previewing the prompt
// in the frontend without round-tripping to the backend.
export function effectiveLineFormat(pack: LanguagePack): string {
  if (pack.vocabulary?.lineFormat) return pack.vocabulary.lineFormat;
  if (pack.vocabulary?.transliterationScheme && pack.vocabulary.transliterationScheme !== 'none') {
    return '{word} ({translit}) = {meaning}';
  }
  return '{word} = {meaning}';
}

// Convenience: derive the effective grounding policy when not authored.
export function effectiveGroundingPolicy(pack: LanguagePack): 'open' | 'prefer' | 'strict' {
  const explicit = pack.grounding?.policy;
  if (explicit) return explicit;
  return pack.status === 'vibrant' ? 'open' : 'strict';
}

// Re-export so consumers can do `import { LanguagePack, loadPack } from '@/lib/language-pack/loader'`.
export type { LanguagePack, LearnerProfile } from './types';
