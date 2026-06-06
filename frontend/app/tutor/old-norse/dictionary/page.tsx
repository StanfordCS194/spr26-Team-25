'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import vocabularyData from '../old_norse_vocabulary.json';

const POS_FILTERS = ['all', 'noun', 'verb', 'adjective', 'adverb', 'other'];
const LEVELS = ['all', 'A1', 'A2', 'B1', 'B2'];

// quick-access example words from the Eddic sagas
const EXAMPLE_WORDS = ['dagr', 'maðr', 'konungr', 'land', 'ek', 'vera', 'ganga', 'góðr'];

interface VocabEntry {
  id: string;
  lemma: string;
  runic?: string;
  pos?: string;
  definitions: { gloss: string }[];
  proficiency_level: string;
  frequency_band?: string;
}

export default function OldNorseDictionaryPage() {
  const [query, setQuery] = useState('');
  const [selectedPos, setSelectedPos] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const router = useRouter();

  const entries = (vocabularyData as any).entries as VocabEntry[];

  const handleSearch = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    router.push(`/tutor/old-norse/dictionary/${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  // filter by search query, part of speech, level, and remove auto-extracted noise
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const gloss = e.definitions[0]?.gloss ?? '';
      const isClean = !gloss.includes('auto-extracted');
      const matchQuery = !query ||
        e.lemma.toLowerCase().includes(query.toLowerCase()) ||
        gloss.toLowerCase().includes(query.toLowerCase());
      const matchPos = selectedPos === 'all' || e.pos === selectedPos;
      const matchLevel = selectedLevel === 'all' || e.proficiency_level === selectedLevel;
      return isClean && matchQuery && matchPos && matchLevel;
    }).slice(0, 120);
  }, [entries, query, selectedPos, selectedLevel]);

  return (
    <main
      className="min-h-screen flex flex-col items-center relative"
      style={{
        backgroundImage: "url('/backgrounds/bg4.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <button
        onClick={() => router.push('/tutor')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back
      </button>

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 pt-16 pb-12 w-full max-w-2xl">

        {/* "Ordabok" means dictionary in Old Norse */}
        <div className="text-center">
          <h1 className="text-white text-4xl font-semibold">Orðabók</h1>
          <p className="text-white/60 text-sm mt-2">
            Old Norse (West Norse) — {entries.length.toLocaleString()} words
          </p>
        </div>

        {/* search bar */}
        <div className="flex w-full gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in Old Norse or English..."
            className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-5 py-4 text-white placeholder-white/30 text-lg outline-none focus:border-amber-400/60 transition-colors"
            autoFocus
          />
          <button
            onClick={() => handleSearch(query)}
            className="bg-amber-500/80 hover:bg-amber-500 text-white rounded-xl px-6 py-4 font-medium transition-colors"
          >
            Search
          </button>
        </div>

        {/* example word chips */}
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-white/40 text-sm self-center">Try:</span>
          {EXAMPLE_WORDS.map(word => (
            <button
              key={word}
              onClick={() => handleSearch(word)}
              className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-1.5 text-white/80 text-sm transition-colors"
            >
              {word}
            </button>
          ))}
        </div>

        {/* part of speech filter chips */}
        <div className="flex flex-wrap justify-center gap-2 w-full">
          {POS_FILTERS.map(pos => (
            <button
              key={pos}
              onClick={() => setSelectedPos(pos)}
              className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                selectedPos === pos
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* proficiency level filters */}
        <div className="flex gap-2">
          {LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedLevel === level
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* word grid — shows lemma, runic glyph, and gloss */}
        <div className="w-full grid grid-cols-2 gap-2">
          {filtered.map(entry => (
            <button
              key={entry.id}
              onClick={() => handleSearch(entry.lemma)}
              className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl px-4 py-3 text-left transition-colors"
            >
              <div className="flex items-baseline gap-2">
                <p className="text-white font-medium">{entry.lemma}</p>
                {/* runic glyph in amber next to the latin spelling */}
                {entry.runic && (
                  <p className="text-amber-400 text-sm">{entry.runic}</p>
                )}
              </div>
              <p className="text-white/50 text-xs mt-0.5 truncate">
                {entry.definitions[0]?.gloss}
              </p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-white/30 col-span-2 text-center py-8">No words found.</p>
          )}
        </div>

        {filtered.length === 120 && (
          <p className="text-white/30 text-xs">
            Showing first 120 results — refine your search or filter to see more
          </p>
        )}

      </div>
    </main>
  );
}