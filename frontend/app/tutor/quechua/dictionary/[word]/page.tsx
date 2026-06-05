'use client';

import { use, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import vocabularyData from '../../quechua_vocabulary.json';
import examplesData from '../../quechua_examples.json';
import { BACKEND_URL } from '@/lib/config';

interface VocabEntry {
  id: string;
  lemma: string;
  pos: string;
  definitions: { gloss: string; dialect_scope: string[] }[];
  proficiency_level: string;
  frequency_band: string;
  semantic_fields?: string[];
  alternate_forms?: string[];
  example_ids?: string[];
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

export default function QuechuaWordPage({ params }: { params: Promise<{ word: string }> }) {
  const { word: encodedWord } = use(params);
  const word = decodeURIComponent(encodedWord);
  const router = useRouter();

  const entries = (vocabularyData as any).entries as VocabEntry[];
  const examples = (examplesData as any).sentences as ParallelExample[];

  const QUECHUA_SUFFIXES = [
    'rqayku', 'rqanki', 'rqani', 'rqan',
    'ykanki', 'ykani', 'ykaku', 'ykun',
    'nayku', 'nanki', 'nani', 'chkan',
    'saqku', 'sanki', 'sani', 'nqa',
    'rqa', 'yku', 'nki', 'yki', 'ku',
    'taq', 'pas', 'pis', 'chu', 'qa',
    'mi', 'si', 'ña', 'ni', 'n', 'm', 's',
  ];

  const entry = useMemo(() => {
    const w = word.toLowerCase();
    return (
      // 1. exact match
      entries.find(e => e.lemma.toLowerCase() === w) ??
      // 2. word is an inflected form. starts with the lemma (kachani → kacha)
      entries.find(e => w.startsWith(e.lemma.toLowerCase()) && e.lemma.length >= 3) ??
      // 3. lemma starts with word (partial input)
      entries.find(e => e.lemma.toLowerCase().startsWith(w)) ??
      // 4. strip common Quechua suffixes and retry
      (() => {
        for (const suffix of QUECHUA_SUFFIXES) {
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

  // get sentence examples from the parallel corpus using example_ids
  const sentenceExamples = useMemo(() => {
    if (!entry?.example_ids) return [];
    return entry.example_ids
      .map(id => examples.find((e: any) => e.id === id))
      .filter(Boolean)
      .slice(0, 5) as ParallelExample[];
  }, [entry, examples]);

  // state for Claude-translated English glosses. null while loading
  const [englishGlosses, setEnglishGlosses] = useState<string[] | null>(null);

  useEffect(() => {
    if (!entry) return;
    // collect the Spanish glosses from the vocabulary entry
    const glosses = entry.definitions.map(d => d.gloss);
    // send them to the backend where Claude translates them to English
    fetch(`${BACKEND_URL}/api/quechua-translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ glosses }),
    })
      .then(r => r.json())
      .then(data => setEnglishGlosses(data.translations))
      .catch(() => null); // on error, leave null. Spanish gloss still shows
  }, [entry]);

  return (
    <main
      className="min-h-screen relative"
      style={{
        backgroundImage: "url('/backgrounds/mercado_dia_realista.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        {/* back button */}
        <button
          onClick={() => router.push('/tutor/quechua/dictionary')}
          className="text-white/60 hover:text-white text-sm mb-8 block"
        >
          ← Simi Qollqa
        </button>

        {entry ? (
          <>
            {/* word header */}
            <div className="mb-8">
              <h1 className="text-white text-5xl font-semibold">{entry.lemma}</h1>
              <div className="flex gap-3 mt-2 flex-wrap">
                <span className="text-amber-400/70 text-xs uppercase tracking-widest">
                  {entry.pos}
                </span>
                <span className="text-white/30 text-xs uppercase tracking-widest">
                  {entry.proficiency_level} · {entry.frequency_band}
                </span>
                {entry.semantic_fields?.map(f => (
                  <span key={f} className="text-white/30 text-xs capitalize">{f}</span>
                ))}
              </div>
            </div>

            {/* definitions */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-4">
              <p className="text-white/35 text-xs uppercase tracking-widest mb-4">Meanings</p>
              <div className="flex flex-col gap-3">
                {entry.definitions.map((def, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-white/30 text-sm">{i + 1}.</span>
                    <div className="flex flex-col gap-0.5">
                      {/* English translation from Claude, shown in amber with AI badge */}
                      {englishGlosses?.[i] ? (
                        <div className="flex items-center gap-2">
                          <span className="text-amber-300 text-sm">{englishGlosses[i]}</span>
                          <span className="text-white/20 text-xs border border-white/15 rounded px-1">AI</span>
                        </div>
                      ) : (
                        /* loading state while Claude translates */
                        <span className="text-white/30 text-xs">translating...</span>
                      )}
                      {/* original Spanish gloss from the corpus, always shown below */}
                      <span className="text-white/40 text-xs">{def.gloss}</span>
                    </div>
                  </div>
                ))}
                {/* additional gloss candidates if available */}
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

            {/* alternate forms */}
            {entry.alternate_forms && entry.alternate_forms.length > 0 && (
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-4">
                <p className="text-white/35 text-xs uppercase tracking-widest mb-4">Alternate Forms</p>
                <div className="flex flex-wrap gap-2">
                  {entry.alternate_forms.map(form => (
                    <button
                      key={form}
                      onClick={() => router.push(`/tutor/quechua/dictionary/${encodeURIComponent(form)}`)}
                      className="text-white/70 hover:text-amber-300 text-sm bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {form}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* sentence examples from the parallel corpus */}
            {sentenceExamples.length > 0 && (
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-4">
                <p className="text-white/35 text-xs uppercase tracking-widest mb-4">
                  Examples from Corpus
                </p>
                <div className="flex flex-col gap-4">
                  {sentenceExamples.map((ex, i) => (
                    <div key={i} className={i > 0 ? 'border-t border-white/10 pt-4' : ''}>
                      {/* original Quechua sentence from corpus */} 
                      <p className="text-white/85 text-sm">{ex.text}</p>
                      {/* Spanish translation from corpus */}
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
              onClick={() => router.push('/tutor/quechua/dictionary')}
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