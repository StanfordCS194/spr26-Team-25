// Type definitions for Chronos language packs.
// Hand-mirrored from packs/schema.json per the architecture decision (no generated
// types in v1). When the schema changes, update this file and re-run the validator
// in Phase 5 CI to catch drift.

export type LanguageStatus = 'vibrant' | 'endangered' | 'dormant' | 'reconstructed';

export interface Script {
  primary?: string;
  unicodeRanges: string[];
  direction?: 'ltr' | 'rtl';
}

export interface Vocabulary {
  lineFormat?: string;
  transliterationScheme?: 'none' | 'ipa' | 'romanization' | 'both';
}

export interface Tutor {
  name: string;
  personaShort: string;
  welcomeGreeting?: string;
  correctionStyle?: 'gentle-restate' | 'direct' | 'socratic';
  responseLength?: 'concise' | 'balanced' | 'thorough';
}

export interface Level {
  id: string;
  label?: string;
  guidance: string;
}

export interface Goal {
  id: string;
  label: string;
  guidance: string;
}

export interface MorphologySegment {
  form: string;
  gloss: string;
}

export interface Morphology {
  segments?: MorphologySegment[];
}

export interface DictionaryExample {
  target: string;
  english: string;
}

export interface Provenance {
  source?: string;
  url?: string;
  contributor?: string;
  date?: string;
  verified?: boolean;
}

export interface DictionaryEntry {
  word: string;
  translit?: string | null;
  ipa?: string;
  meaning: string;
  partOfSpeech?: string;
  morphology?: Morphology;
  examples?: DictionaryExample[];
  dialect?: string;
  audioUrl?: string;
  provenance?: Provenance;
}

export interface Dictionary {
  entries: DictionaryEntry[];
}

export interface Grounding {
  policy?: 'open' | 'prefer' | 'strict';
  retrieval?: 'none' | 'inline-all' | 'rag' | 'exact-lookup';
  dictionaryRef?: string;
  dictionary?: Dictionary;
  uncertaintyPhrase?: string;
}

export interface FallbackVoice {
  provider?: string;
  voice?: string;
  languageCode?: string;
  rationale?: string;
}

export interface Voice {
  provider?: 'none' | 'google-tts' | 'elevenlabs' | 'azure' | 'recorded';
  voice?: string;
  languageCode?: string;
  fallbackVoice?: FallbackVoice;
  audioPerEntry?: boolean;
}

export interface Sovereignty {
  license: string;
  attribution?: string;
  contact?: string;
  restrictions?: string[];
  communityPartnership?: string;
}

export interface LanguagePack {
  $schema?: string;
  id: string;
  schemaVersion?: string;
  version?: string;
  displayName: string;
  displayNameLocal?: string;
  status: LanguageStatus;
  family?: string;
  dialect?: string;
  iso639?: string;
  script: Script;
  vocabulary?: Vocabulary;
  tutor: Tutor;
  levels?: Level[];
  goals?: Goal[];
  promptTemplate: string;
  grounding?: Grounding;
  voice?: Voice;
  sovereignty: Sovereignty;
}

// Per-session learner state. Matches LearnerProfile in backend/language_pack/models.py.
export interface LearnerProfile {
  level: string;
  goal: string;
  time_commitment: string;
}
