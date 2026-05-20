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
  // URL the loader will fetch when the pack body is needed. Convention:
  // 'frontend/public/packs/<id>.json' (Next.js serves /packs/ from /public).
  // If your deployment serves packs from a different origin, update here.
  url: string;
}

export const REGISTRY: PackMetadata[] = [
  {
    id: 'ancient-greek',
    displayName: 'Ancient Greek',
    displayNameLocal: 'Ἑλληνική',
    status: 'vibrant',
    family: 'Indo-European',
    url: '/packs/ancient-greek.json',
  },
  {
    id: 'classical-nahuatl',
    displayName: 'Classical Nahuatl',
    displayNameLocal: 'Nāhuatlahtōlli',
    status: 'endangered',
    family: 'Uto-Aztecan',
    url: '/packs/classical-nahuatl.json',
  },
  {
    id: 'ojibwe',
    displayName: 'Ojibwe',
    displayNameLocal: 'Anishinaabemowin',
    status: 'endangered',
    family: 'Algonquian',
    url: '/packs/ojibwe.json',
  },
];

export function listPacks(): PackMetadata[] {
  return REGISTRY;
}

export function getPackMetadata(id: string): PackMetadata | undefined {
  return REGISTRY.find((p) => p.id === id);
}
