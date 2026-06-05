'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import vocabularyData from '../../old_norse_vocabulary.json';
import examplesData from '../../old_norse_examples.json';

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

export default function OldNorseWordPage({ params }: { params: Promise<{ word: string }> }) {
  const { word: encodedWord } = use(params);
  const word = decodeURIComponent(encodedWord);
  const router = useRouter();

  const entries = (vocabularyData as any).entries as VocabEntry[];
  const examples = (examplesData as any).sentences as ParallelExample[];

  // common Old Norse suffixes for fuzzy matching
  const OLD_NORSE_SUFFIXES = [
    'nnar', 'nnum', 'nar', 'num', 'inn', 'ins', 'inn',
    'ar', 'ir', 'ur', 'um', 'an', 'in', 'un',
    'dr', 'tr', 'r', 's', 'a', 'i', 'u',
  ];

  const entry = useMemo(() => {
    const w = word.toLowerCase();
    return (
      // 1. exact match
      entries.find(e => e.lemma.toLowerCase() === w) ??
      // 2. word starts with the lemma (inflected form)
      entries.find(e => w.startsWith(e.lemma.toLowerCase()) && e.lemma.length >= 3) ??
      // 3. lemma starts with word (partial input)
      entries.find(e => e.lemma.toLowerCase().startsWith(w)) ??
      // 4. strip common Old Norse suffixes and retry
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

  // get sentence examples from the parallel corpus
  const sentenceExamples = useMemo(() => {
    if (!examples) return [];
    // search for examples that contain the lemma or the searched word
    const searchWord = entry?.lemma.toLowerCase() ?? word.toLowerCase();
    return examples
      .filter((e: any) => e.text.toLowerCase().includes(searchWord))
      .slice(0, 5) as ParallelExample[];
  }, [entry, examples, word]);

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

        {/* back button */}
        <button
          onClick={() => router.push('/tutor/old-norse/dictionary')}
          className="text-white/60 hover:text-white text-sm mb-8 block"
        >
          ← Orðabók
        </button>

        {entry ? (
          <>
            {/* word header with runic glyph */}
            <div className="mb-8">
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

            {/* definitions — already in English, no translation needed */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-4">
              <p className="text-white/35 text-xs uppercase tracking-widest mb-4">Meanings</p>
              <div className="flex flex-col gap-3">
                {entry.definitions.map((def, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-white/30 text-sm">{i + 1}.</span>
                    <span className="text-amber-300 text-sm">{def.gloss}</span>
                  </div>
                ))}
                {/* additional gloss candidates from the corpus */}
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

            {/* sentence examples from the Heimskringla corpus */}
            {sentenceExamples.length > 0 && (
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-4">
                <p className="text-white/35 text-xs uppercase tracking-widest mb-4">
                  Examples from Corpus
                </p>
                <div className="flex flex-col gap-4">
                  {sentenceExamples.map((ex, i) => (
                    <div key={i} className={i > 0 ? 'border-t border-white/10 pt-4' : ''}>
                      {/* original Old Norse text from the corpus */}
                      <p className="text-white/85 text-sm">{ex.text}</p>
                      {/* English translation */}
                      <p className="text-white/45 text-sm mt-1">{ex.translation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* corpus frequency note */}
            {entry.extensions?._corpus_frequency && (
              <p className="text-white/20 text-xs text-center">
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