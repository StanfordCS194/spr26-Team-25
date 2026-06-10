// Discovery layer: enumerates known packs with the minimal metadata a UI
// (e.g. a language picker) needs to render before deciding whether to load
// the full pack body.
//
// Hand-maintained for v1. When a new pack is added under packs/, append an
// entry here. The Phase 5 validator can mechanically check this list stays
// in sync with the packs/ directory.

import type { LanguageStatus } from './types';

export interface PackMetadata {
  id: string;
  displayName: string;
  displayNameLocal?: string;
  status: LanguageStatus;
  family?: string;
  // URL the loader will fetch when the pack body is needed. The /api/packs/<id>
  // route reads the pack from the repo's packs/ directory and resolves any
  // dictionaryRef before returning JSON. Override here if your deployment
  // serves packs from a different origin.
  url: string;
}

export const REGISTRY: PackMetadata[] = [
  {
    id: 'ancient-greek',
    displayName: 'Ancient Greek',
    displayNameLocal: 'Ἑλληνική',
    status: 'vibrant',
    family: 'Indo-European',
    url: '/api/packs/ancient-greek',
  },
  {
    id: 'classical-nahuatl',
    displayName: 'Classical Nahuatl',
    displayNameLocal: 'Nāhuatlahtōlli',
    status: 'endangered',
    family: 'Uto-Aztecan',
    url: '/api/packs/classical-nahuatl',
  },
  {
    id: 'quechua',
    displayName: 'Quechua',
    displayNameLocal: 'Runa Simi',
    status: 'endangered',
    family: 'Quechuan',
    url: '/api/packs/quechua',
  },
  {
    id: 'old-norse',
    displayName: 'Old Norse',
    displayNameLocal: 'Norrœnt mál',
    status: 'dormant',
    family: 'Indo-European',
    url: '/api/packs/old-norse',
  },
  {
    id: 'ojibwe',
    displayName: 'Ojibwe',
    displayNameLocal: 'Anishinaabemowin',
    status: 'endangered',
    family: 'Algonquian',
    url: '/api/packs/ojibwe',
  },
];

export function listPacks(): PackMetadata[] {
  return REGISTRY;
}

export function getPackMetadata(id: string): PackMetadata | undefined {
  return REGISTRY.find((p) => p.id === id);
}
