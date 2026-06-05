'use client';

import { use, useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import vocabularyData from '../../old_norse_vocabulary.json';
import examplesData from '../../old_norse_examples.json';
import { BACKEND_URL } from '@/lib/config';

interface VocabEntry {
  id: string;
  lemma: string;
  runic?: string;
  pos?: string;
  definitions: { gloss: string; dialect_scope?: string[] }[];
  proficiency_level: string;
  frequency_band?: string;
  extensions?: {
    _corpus_frequency?: number;
    _gloss_candidates_full?: string[];
  };
}

interface ParallelExample {
  id: string;
  text: string;
  translation: string;
}

// shape of AI-generated sentence examples from /api/old-norse-word-info
interface AIExample { norse: string; english: string; source: string; }

// shape of AI-generated related words from /api/old-norse-word-info
interface RelatedWord { norse: string; english: string; note: string; }
interface RelatedEntry { word_family: RelatedWord[]; semantic_field: RelatedWord[]; }

// shapes for the declension/conjugation table from /api/old-norse-word-info
interface VerbRow { person: string; label: string; forms: string[]; }
interface DeclensionRow { case: string; singular: string; plural: string; }
type DeclensionData =
  | { type: 'verb'; lemma: string; meaning: string; class: string; indicative: { tenses: string[]; rows: VerbRow[] } }
  | { type: 'noun'; lemma: string; meaning: string; gender: string; declension: { rows: DeclensionRow[] } };

// tabs shown below the word header
const TABS = [
  { key: 'corpus',     label: 'Related Words' },
  { key: 'examples',   label: 'Examples'      },
  { key: 'declension', label: 'Declension'    },
  { key: 'related',    label: 'Word Family'   },
];

export default function OldNorseWordPage({ params }: { params: Promise<{ word: string }> }) {
  // Next.js 15 passes params as a Promise, use() reads it before the component renders
  const { word: encodedWord } = use(params);
  const word = decodeURIComponent(encodedWord);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('corpus');
  // AI tab state, null while not yet fetched, populated after the first fetch
  const [aiExamples, setAiExamples] = useState<AIExample[] | null>(null);
  const [aiExamplesError, setAiExamplesError] = useState(false);
  const [related, setRelated] = useState<RelatedEntry | null>(null);
  const [relatedError, setRelatedError] = useState(false);
  const [declension, setDeclension] = useState<DeclensionData | null>(null);
  const [declensionError, setDeclensionError] = useState(false);
  const [loading, setLoading] = useState(false);

  const entries = (vocabularyData as any).entries as VocabEntry[];
  const examples = (examplesData as any).sentences as ParallelExample[];

  // common Old Norse suffixes for fuzzy matching
  // tried in order from longest to shortest so we don't strip too little
  const OLD_NORSE_SUFFIXES = [
    'nnar', 'nnum', 'nar', 'num', 'inn', 'ins',
    'ar', 'ir', 'ur', 'um', 'an', 'in', 'un',
    'dr', 'tr', 'r', 's', 'a', 'i', 'u',
  ];

  const entry = useMemo(() => {
    const w = word.toLowerCase();
    return (
      // 1. exact match
      entries.find(e => e.lemma.toLowerCase() === w) ??
      // 2. word starts with the lemma (inflected form, e.g. "dags" finds "dagr")
      entries.find(e => w.startsWith(e.lemma.toLowerCase()) && e.lemma.length >= 3) ??
      // 3. lemma starts with word (partial input)
      entries.find(e => e.lemma.toLowerCase().startsWith(w)) ??
      // 4. strip common Old Norse suffixes and retry exact then prefix match
      (() => {
        for (const suffix of OLD_NORSE_SUFFIXES) {
          if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
            const stem = w.slice(0, w.length - suffix.length);
            const hit = entries.find(e => e.lemma.toLowerCase() === stem) ??
                        entries.find(e => e.lemma.toLowerCase().startsWith(stem));
            if (hit) return hit;
          }
        }
        return null;
      })()
    );
  }, [entries, word]);

  // AI-generated gloss for words with auto-extracted definitions
  const [aiGloss, setAiGloss] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    // check if all definitions are auto-extracted and need an AI gloss
    const needsGloss = entry.definitions.every(d => d.gloss.includes('auto-extracted'));
    if (!needsGloss) return;
    fetch(`${BACKEND_URL}/api/old-norse-word-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: entry.lemma, info_type: 'gloss' }),
    })
      .then(r => r.json())
      .then(data => setAiGloss(data.content?.trim() ?? null))
      .catch(() => null);
  }, [entry]);

  // corpus entries whose text contains the lemma, shown in the Related Words tab.
  // these are Zoega dictionary entries, not real sentences, so they are labelled
  // as "related words" rather than "examples" to avoid misleading the user
  const corpusRelated = useMemo(() => {
    const searchWord = entry?.lemma.toLowerCase() ?? word.toLowerCase();
    return examples
      .filter((e: any) => e.text.toLowerCase().includes(searchWord) && e.text !== searchWord)
      .slice(0, 8) as ParallelExample[];
  }, [entry, examples, word]);

  // shared fetch helper for all AI tabs, calls /api/old-norse-word-info with the lemma
  const fetchAI = useCallback(async (infoType: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/old-norse-word-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // always send the lemma so inflected forms get the right AI response
        body: JSON.stringify({ word: entry?.lemma ?? word, info_type: infoType }),
      });
      const data = await res.json();
      return data.content as string;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [entry, word]);

  // fetch AI sentence examples, cached after first load
  const fetchExamples = useCallback(async () => {
    if (aiExamples || aiExamplesError) return;
    const content = await fetchAI('examples');
    if (!content) { setAiExamplesError(true); return; }
    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (!match) throw new Error();
      setAiExamples(JSON.parse(match[0]));
    } catch { setAiExamplesError(true); }
  }, [aiExamples, aiExamplesError, fetchAI]);

  // fetch AI word family and semantic field, cached after first load
  const fetchRelated = useCallback(async () => {
    if (related || relatedError) return;
    const content = await fetchAI('related');
    if (!content) { setRelatedError(true); return; }
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error();
      setRelated(JSON.parse(match[0]));
    } catch { setRelatedError(true); }
  }, [related, relatedError, fetchAI]);

  // fetch AI declension or conjugation table, cached after first load
  const fetchDeclension = useCallback(async () => {
    if (declension || declensionError) return;
    const content = await fetchAI('declension');
    if (!content) { setDeclensionError(true); return; }
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error();
      setDeclension(JSON.parse(match[0]));
    } catch { setDeclensionError(true); }
  }, [declension, declensionError, fetchAI]);

  // trigger the right fetch when the user switches tabs
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'examples')   fetchExamples();
    if (key === 'related')    fetchRelated();
    if (key === 'declension') fetchDeclension();
  };

  return (
    <main
      className="min-h-screen relative"
      style={{
        backgroundImage: "url('/backgrounds/bg4.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        {/* back button navigates to the main Old Norse dictionary */}
        <button
          onClick={() => router.push('/tutor/old-norse/dictionary')}
          className="text-white/60 hover:text-white text-sm mb-8 block"
        >
          ← Orðabók
        </button>

        {entry ? (
          <>
            {/* word header: latin spelling on the left, runic glyph in amber on the right */}
            <div className="mb-6">
              <div className="flex items-baseline gap-4">
                <h1 className="text-white text-5xl font-semibold">{entry.lemma}</h1>
                {/* runic glyph displayed prominently next to the latin spelling */}
                {entry.runic && (
                  <span className="text-amber-400 text-3xl">{entry.runic}</span>
                )}
              </div>
              <div className="flex gap-3 mt-2 flex-wrap">
                {entry.pos && (
                  <span className="text-amber-400/70 text-xs uppercase tracking-widest">
                    {entry.pos}
                  </span>
                )}
                <span className="text-white/30 text-xs uppercase tracking-widest">
                  {entry.proficiency_level}{entry.frequency_band ? ` · ${entry.frequency_band}` : ''}
                </span>
              </div>
            </div>

            {/* definitions are already in English so no translation step is needed */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-4">
              <p className="text-white/35 text-xs uppercase tracking-widest mb-4">Meanings</p>
              <div className="flex flex-col gap-3">
                {entry.definitions.map((def, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-white/30 text-sm">{i + 1}.</span>
                    <span className="text-amber-300 text-sm">
                      {def.gloss.includes('auto-extracted')
                        ? aiGloss
                          ? <>{aiGloss} <span className="text-white/20 text-xs border border-white/15 rounded px-1 ml-1">AI</span></>
                          : 'loading...'
                        : def.gloss}
                    </span>
                  </div>
                ))}
                {/* additional gloss candidates from the Zoega corpus pipeline */}
                {(entry.extensions?._gloss_candidates_full?.length ?? 0) > entry.definitions.length && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-white/25 text-xs mb-2">Also found in corpus</p>
                    <div className="flex flex-wrap gap-2">
                      {entry.extensions!._gloss_candidates_full!
                        .filter(g => !entry.definitions.some(d => d.gloss.includes(g)))
                        .map((g, i) => (
                          <span key={i} className="text-white/30 text-xs bg-white/5 rounded px-2 py-0.5">{g}</span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* tab bar: underline style matching the Greek dictionary */}
            <div className="flex border-b border-white/20 mb-4">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`px-4 py-3 text-xs font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'text-amber-400 border-amber-400'
                      : 'text-white/40 border-transparent hover:text-white/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* tab content card */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-6 min-h-[200px]">
              {loading ? (
                <p className="text-white/30 text-center pt-12">Loading...</p>

              ) : activeTab === 'corpus' ? (
                // Zoega dictionary entries that contain the lemma.
                // labelled "Related Words" because they are dictionary entries, not real sentences
                corpusRelated.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-white/25 text-xs mb-2">
                      Words containing "{entry.lemma}" from the Zoëga dictionary
                    </p>
                    {corpusRelated.map((ex, i) => (
                      <div key={i} className={i > 0 ? 'border-t border-white/10 pt-3' : ''}>
                        <p className="text-white/80 text-sm font-medium">{ex.text}</p>
                        <p className="text-white/45 text-xs mt-0.5">{ex.translation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/30 text-center pt-12 text-sm">No corpus entries found.</p>
                )

              ) : activeTab === 'examples' ? (
                // AI-generated sentence examples from the Eddic sagas
                aiExamplesError ? (
                  <p className="text-white/40 text-center pt-12 text-sm">Could not load examples.</p>
                ) : !aiExamples ? (
                  <p className="text-white/20 text-center pt-12 text-sm">Loading...</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {aiExamples.map((ex, i) => (
                      <div key={i} className={i > 0 ? 'border-t border-white/10 pt-4' : ''}>
                        {/* Old Norse sentence with the word in context */}
                        <p className="text-white/85 text-sm">{ex.norse}</p>
                        {/* English translation below in muted white */}
                        <p className="text-white/50 text-sm mt-1">{ex.english}</p>
                        {/* source citation in small italics */}
                        <p className="text-white/25 text-xs mt-1 italic">{ex.source}</p>
                      </div>
                    ))}
                  </div>
                )

              ) : activeTab === 'declension' ? (
                // AI-generated declension table for nouns or conjugation table for verbs
                declensionError ? (
                  <p className="text-white/40 text-center pt-12 text-sm">Could not load declension.</p>
                ) : !declension ? (
                  <p className="text-white/20 text-center pt-12 text-sm">Loading...</p>
                ) : declension.type === 'verb' ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-white/40 text-xs">{declension.lemma} — {declension.meaning} ({declension.class})</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            {/* empty header cell for the pronoun column */}
                            <th className="text-left pb-3 pr-4 text-white/30 text-xs font-normal w-12"></th>
                            {declension.indicative.tenses.map(t => (
                              <th key={t} className="text-left pb-3 pr-4 text-white/50 text-xs font-medium">{t}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {declension.indicative.rows.map((row, i) => (
                            <tr key={row.person} className={i > 0 ? 'border-t border-white/5' : ''}>
                              {/* Old Norse pronoun label for this person */}
                              <td className="py-2 pr-4 text-white/30 text-xs">{row.label}</td>
                              {row.forms.map((f, j) => (
                                <td key={j} className="py-2 pr-4 text-white/80 text-sm">{f}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-white/40 text-xs">{declension.lemma} — {declension.gender}, {declension.meaning}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left pb-3 pr-4 text-white/30 text-xs font-normal w-28"></th>
                            <th className="text-left pb-3 pr-4 text-white/50 text-xs font-medium">Singular</th>
                            <th className="text-left pb-3 text-white/50 text-xs font-medium">Plural</th>
                          </tr>
                        </thead>
                        <tbody>
                          {declension.declension.rows.map((row, i) => (
                            <tr key={row.case} className={i > 0 ? 'border-t border-white/5' : ''}>
                              <td className="py-2 pr-4 text-white/30 text-xs">{row.case}</td>
                              <td className="py-2 pr-4 text-white/80 text-sm">{row.singular}</td>
                              <td className="py-2 text-white/80 text-sm">{row.plural}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )

              ) : activeTab === 'related' ? (
                // AI-generated word family (same root) and semantic field (same concept)
                relatedError ? (
                  <p className="text-white/40 text-center pt-12 text-sm">Could not load related words.</p>
                ) : !related ? (
                  <p className="text-white/20 text-center pt-12 text-sm">Loading...</p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {related.word_family.length > 0 && (
                      <div>
                        <p className="text-white/35 text-xs uppercase tracking-widest mb-3">Word Family</p>
                        <div className="flex flex-wrap gap-2">
                          {related.word_family.map((w, i) => (
                            <div key={i} className="border border-white/15 rounded-lg px-3 py-2">
                              <p className="text-white/85 text-sm">{w.norse}</p>
                              <p className="text-white/50 text-xs">{w.english}</p>
                              <p className="text-white/25 text-xs italic">{w.note}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {related.semantic_field.length > 0 && (
                      <div>
                        <p className="text-white/35 text-xs uppercase tracking-widest mb-3">Semantic Field</p>
                        <div className="flex flex-wrap gap-2">
                          {related.semantic_field.map((w, i) => (
                            // amber border distinguishes semantic field from word family
                            <div key={i} className="border border-amber-400/15 rounded-lg px-3 py-2">
                              <p className="text-white/85 text-sm">{w.norse}</p>
                              <p className="text-white/50 text-xs">{w.english}</p>
                              <p className="text-white/25 text-xs italic">{w.note}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : null}
            </div>

            {/* corpus frequency note shown below the tab card */}
            {entry.extensions?._corpus_frequency && (
              <p className="text-white/20 text-xs text-center mt-4">
                Appears {entry.extensions._corpus_frequency.toLocaleString()} times in the corpus
              </p>
            )}
          </>
        ) : (
          /* word not found in vocabulary */
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-8 text-center">
            <p className="text-white/60 text-lg mb-2">"{word}"</p>
            <p className="text-white/30 text-sm">
              This word wasn't found in the vocabulary. It may be a rare form or spelling variant.
            </p>
            <button
              onClick={() => router.push('/tutor/old-norse/dictionary')}
              className="mt-6 text-amber-400/70 hover:text-amber-400 text-sm transition-colors"
            >
              ← Back to dictionary
            </button>
          </div>
        )}
      </div>
    </main>
  );
}