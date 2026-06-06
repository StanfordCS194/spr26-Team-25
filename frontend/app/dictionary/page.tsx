'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// quick-access example words shown as chips below the search bar
const EXAMPLE_WORDS = ['λόγος', 'ψυχή', 'ἀρετή', 'φιλοσοφία', 'καλός', 'ἀγαθός'];

export default function DictionaryPage() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  // encode the word so Greek characters are safe in the URL
  const handleSearch = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    router.push(`/dictionary/${encodeURIComponent(trimmed)}`);
  };

  // allow submitting by pressing Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{
        backgroundImage: "url('/backgrounds/biblioteca_alejandria.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* dark overlay for readability */}
      <div className="absolute inset-0 bg-black/55" />

      {/* back button */}
      <button
        onClick={() => router.push('/tutor')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back
      </button>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center w-full max-w-xl">

        {/* page title */}
        <div>
          <h1
            className="text-white text-4xl font-semibold"
            style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}
          >
            Λεξικόν
          </h1>
          <p className="text-white/60 text-sm mt-2">
            Search any Ancient or Modern Greek word, or type in English
          </p>
        </div>

        {/* search bar and button */}
        <div className="flex w-full gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. λόγος or logos or word..."
            className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-5 py-4 text-white placeholder-white/30 text-lg outline-none focus:border-amber-400/60 transition-colors"
            style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}
            autoFocus
          />
          <button
            onClick={() => handleSearch(query)}
            className="bg-amber-500/80 hover:bg-amber-500 text-white rounded-xl px-6 py-4 font-medium transition-colors"
          >
            Search
          </button>
        </div>

        {/* example word chips for quick access */}
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-white/40 text-sm self-center">Try:</span>
          {EXAMPLE_WORDS.map(word => (
            <button
              key={word}
              onClick={() => handleSearch(word)}
              className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-1.5 text-white/80 text-sm transition-colors"
              style={{ fontFamily: "'GFS Didot', 'Palatino Linotype', serif" }}
            >
              {word}
            </button>
          ))}
        </div>

      </div>
    </main>
  );
}