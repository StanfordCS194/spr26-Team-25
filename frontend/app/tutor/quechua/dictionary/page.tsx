'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import vocabularyData from '../quechua_vocabulary.json';

const SEMANTIC_FIELDS = [
  'all', 'nature', 'body', 'food', 'kinship', 'emotions',
  'numbers', 'location', 'motion', 'social', 'agriculture', 'possession',
];
const LEVELS = ['all', 'A1', 'A2', 'B1', 'B2'];

// quick-access example words
const EXAMPLE_WORDS = ['mayu', 'yaku', 'inti', 'mama', 'rumi', 'allin', 'runa', 'pacha'];

interface VocabEntry {
  id: string;
  lemma: string;
  definitions: { gloss: string }[];
  proficiency_level: string;
  semantic_fields?: string[];
}

export default function QuechuaDictionaryPage() {
  const [query, setQuery] = useState('');
  const [selectedField, setSelectedField] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const router = useRouter();

  const entries = (vocabularyData as any).entries as VocabEntry[];

  const handleSearch = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    router.push(`/tutor/quechua/dictionary/${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  // filter by search query, semantic field, level, and remove religious noise
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const gloss = e.definitions[0]?.gloss ?? '';
      const isClean = !gloss.includes('jehová') && !gloss.includes('auto-extracted');
      const matchQuery = !query ||
        e.lemma.toLowerCase().includes(query.toLowerCase()) ||
        gloss.toLowerCase().includes(query.toLowerCase());
      const matchField = selectedField === 'all' || (e.semantic_fields ?? []).includes(selectedField);
      const matchLevel = selectedLevel === 'all' || e.proficiency_level === selectedLevel;
      return isClean && matchQuery && matchField && matchLevel;
    }).slice(0, 120);
  }, [entries, query, selectedField, selectedLevel]);

  return (
    <main
      className="min-h-screen flex flex-col items-center relative"
      style={{
        backgroundImage: "url('/backgrounds/mercado_dia_realista.jpg')",
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

        {/* title — "Simi Qollqa" means word treasury in Quechua */}
        <div className="text-center">
          <h1 className="text-white text-4xl font-semibold">Simi Qollqa</h1>
          <p className="text-white/60 text-sm mt-2">
            Quechua (Ayacucho-Chanka) — {entries.length.toLocaleString()} words
          </p>
        </div>

        {/* search bar */}
        <div className="flex w-full gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in Quechua or Spanish..."
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

        {/* semantic field filter chips */}
        <div className="flex flex-wrap justify-center gap-2 w-full">
          {SEMANTIC_FIELDS.map(field => (
            <button
              key={field}
              onClick={() => setSelectedField(field)}
              className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                selectedField === field
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {field}
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

        {/* word grid */}
        <div className="w-full grid grid-cols-2 gap-2">
          {filtered.map(entry => (
            <button
              key={entry.id}
              onClick={() => handleSearch(entry.lemma)}
              className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl px-4 py-3 text-left transition-colors"
            >
              <p className="text-white font-medium">{entry.lemma}</p>
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