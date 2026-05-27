// Public surface of the language-pack frontend library.
//
// Usage:
//   import { loadPack, listPacks } from '@/lib/language-pack';
//   const meta = listPacks();
//   const pack = await loadPack(meta[0].url);
//   console.log(pack.tutor.name);

export type {
  DictionaryEntry,
  LanguagePack,
  LanguageStatus,
  LearnerProfile,
} from './types';

export {
  PackValidationError,
  effectiveGroundingPolicy,
  effectiveLineFormat,
  loadPack,
  parsePack,
} from './loader';

export type { PackMetadata } from './registry';
export { REGISTRY, getPackMetadata, listPacks } from './registry';
