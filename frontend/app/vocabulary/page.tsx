'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

type Mode = 'words' | 'flashcards';

interface VocabWord {
  id: number;
  greek: string;
  transliteration: string;
  meaning: string;
  language: string;
}

// Languages that should be hidden by default (removed feature)
const HIDDEN_BY_DEFAULT = new Set(['old-norse', 'old_norse', 'norse', 'oldnorse']);

const LANGUAGE_META: Record<string, { label: string; color: string; border: string; text: string }> = {
  'greek':     { label: 'Ancient Greek', color: '#92400e',  border: '#d97706', text: '#fde68a' },
  'nahuatl':   { label: 'Nahuatl',       color: '#14532d',  border: '#22c55e', text: '#bbf7d0' },
  'old-norse': { label: 'Old Norse',     color: '#1e3a5f',  border: '#3b82f6', text: '#bfdbfe' },
  'old_norse': { label: 'Old Norse',     color: '#1e3a5f',  border: '#3b82f6', text: '#bfdbfe' },
};

function langMeta(lang: string) {
  return LANGUAGE_META[lang] ?? { label: lang, color: '#374151', border: '#6b7280', text: '#d1d5db' };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VocabularyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('words');
  const [allWords, setAllWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeLangs, setActiveLangs] = useState<Set<string>>(new Set());
  const [availableLangs, setAvailableLangs] = useState<string[]>([]);

  // flashcard state
  const [cards, setCards] = useState<VocabWord[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      fetch(`${BACKEND}/api/vocabulary/by-user/${user.id}`)
        .then(r => r.json())
        .then(data => {
          const vocab: VocabWord[] = (data.vocabulary ?? []).map((w: any) => ({
            ...w,
            language: (w.language ?? 'greek').toLowerCase(),
          }));

          // deduplicate by word+language
          const seen = new Set<string>();
          const unique = vocab.filter(w => {
            const key = `${w.greek}|${w.language}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          // compute distinct languages
          const langs = [...new Set(unique.map(w => w.language))].sort();
          setAvailableLangs(langs);

          // default: show all languages except old norse variants
          const defaults = new Set(langs.filter(l => !HIDDEN_BY_DEFAULT.has(l)));
          setActiveLangs(defaults.size > 0 ? defaults : new Set(langs));

          setAllWords(unique);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, []);

  // words visible after language filter
  const langFiltered = allWords.filter(w => activeLangs.has(w.language));

  // words visible after search filter
  const filtered = search.trim()
    ? langFiltered.filter(w =>
        w.greek.toLowerCase().includes(search.toLowerCase()) ||
        (w.transliteration ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (w.meaning ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : langFiltered;

  // keyboard nav for flashcards
  const next = useCallback(() => {
    if (index >= cards.length - 1) { setDone(true); return; }
    setFlipped(false);
    setTimeout(() => setIndex(i => i + 1), 150);
  }, [index, cards.length]);

  const prev = useCallback(() => {
    if (index === 0) return;
    setFlipped(false);
    setTimeout(() => setIndex(i => i - 1), 150);
  }, [index]);

  useEffect(() => {
    if (mode !== 'flashcards') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowDown') { e.preventDefault(); setFlipped(f => !f); }
      if (e.code === 'ArrowRight') next();
      if (e.code === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, next, prev]);

  function toggleLang(lang: string) {
    setActiveLangs(prev => {
      const next = new Set(prev);
      if (next.has(lang)) {
        // don't allow deselecting the last active language
        if (next.size === 1) return prev;
        next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  }

  function startFlashcards() {
    setCards(shuffle(langFiltered));
    setIndex(0);
    setFlipped(false);
    setDone(false);
    setMode('flashcards');
  }

  function restart() {
    setCards(shuffle(langFiltered));
    setIndex(0);
    setFlipped(false);
    setDone(false);
  }

  function exportCsv() {
    if (filtered.length === 0) return;
    const rows = [
      ['Language', 'Word', 'Transliteration', 'Meaning'],
      ...filtered.map(w => [
        langMeta(w.language).label,
        w.greek,
        w.transliteration ?? '',
        w.meaning ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chronos_vocabulary.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const card = cards[index];
  const progress = cards.length > 0 ? ((index + 1) / cards.length) * 100 : 0;

  return (
    <main
      className="min-h-screen relative flex flex-col"
      style={{
        backgroundImage: "url('/backgrounds/biblioteca_alejandria.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/70" />

      {/* nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-5">
        <button onClick={() => router.push('/tutor')} className="text-white/50 hover:text-white text-sm transition-colors">
          ← Back
        </button>
        <p className="text-white/40 text-xs tracking-widest uppercase">Vocabulary</p>
        <div className="w-14" />
      </nav>

      <div className="relative z-10 flex-1 flex flex-col items-center px-4 pb-16">

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="flex gap-2">
              {[0, 150, 300].map(d => (
                <div key={d} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="text-white/30 text-sm">Loading vocabulary...</p>
          </div>

        ) : allWords.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 max-w-xs">
            <p className="text-5xl">📚</p>
            <h2 className="text-white text-xl font-semibold">No words yet</h2>
            <p className="text-white/40 text-sm leading-relaxed">
              Complete a voice session or text chat to build your vocabulary list.
            </p>
            <button onClick={() => router.push('/tutor')} className="bg-amber-700 hover:bg-amber-600 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all">
              Start a Session
            </button>
          </div>

        ) : (
          <div className="w-full max-w-lg">

            {/* stats */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-amber-300/80 text-sm font-semibold">
                {langFiltered.length} word{langFiltered.length !== 1 ? 's' : ''}
                {langFiltered.length !== allWords.length && (
                  <span className="text-white/30 font-normal"> of {allWords.length}</span>
                )}
              </span>
            </div>

            {/* ── language filter pills ── */}
            {availableLangs.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {availableLangs.map(lang => {
                  const meta = langMeta(lang);
                  const active = activeLangs.has(lang);
                  const count = allWords.filter(w => w.language === lang).length;
                  return (
                    <button
                      key={lang}
                      onClick={() => toggleLang(lang)}
                      style={active ? {
                        backgroundColor: meta.color,
                        borderColor: meta.border,
                        color: meta.text,
                      } : {
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.35)',
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all"
                    >
                      {active && <span className="opacity-70">✓</span>}
                      {meta.label}
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* mode tabs */}
            <div className="flex bg-white/10 border border-white/15 rounded-xl p-1 mb-6">
              <button
                onClick={() => setMode('words')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'words' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                }`}
              >
                📚 Word List
              </button>
              <button
                onClick={startFlashcards}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'flashcards' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                }`}
              >
                🃏 Flashcards
              </button>
            </div>

            {/* ── Word List ── */}
            {mode === 'words' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search word, transliteration, or meaning..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <button
                    onClick={exportCsv}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-white/50 hover:text-white text-sm transition-all whitespace-nowrap"
                    title="Export visible words as CSV"
                  >
                    ↓ CSV
                  </button>
                </div>

                {search && (
                  <p className="text-white/30 text-xs px-1">
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
                  </p>
                )}

                {langFiltered.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-10">No words for the selected language(s)</p>
                ) : filtered.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-10">No matches</p>
                ) : (
                  <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
                    {filtered.map(w => {
                      const meta = langMeta(w.language);
                      return (
                        <div
                          key={w.id}
                          className="bg-white/8 hover:bg-white/12 border border-white/10 rounded-xl px-4 py-3 flex items-start gap-4 transition-colors"
                        >
                          <p
                            className="text-xl font-serif w-28 flex-shrink-0 leading-tight"
                            style={{ color: meta.text }}
                          >
                            {w.greek}
                          </p>
                          <div className="flex-1 min-w-0">
                            <p className="text-white/40 text-xs font-mono">{w.transliteration}</p>
                            <p className="text-white/80 text-sm mt-0.5 leading-snug">{w.meaning}</p>
                          </div>
                          {/* language dot — only show if multiple langs active */}
                          {activeLangs.size > 1 && (
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                              style={{ backgroundColor: meta.border }}
                              title={meta.label}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Flashcards ── */}
            {mode === 'flashcards' && (
              cards.length === 0 ? (
                <div className="text-center space-y-4 py-8">
                  <p className="text-white/40 text-sm">No words to review for the selected language(s).</p>
                  <button onClick={() => setMode('words')} className="text-amber-400/70 hover:text-amber-300 text-sm transition-colors">
                    ← Back to list
                  </button>
                </div>
              ) : done ? (
                <div className="text-center space-y-5 max-w-xs mx-auto">
                  <div className="w-16 h-16 rounded-full bg-amber-700/40 border border-amber-400/30 flex items-center justify-center text-3xl mx-auto">✓</div>
                  <div>
                    <h2 className="text-white text-2xl font-semibold">Round complete!</h2>
                    <p className="text-white/40 text-sm mt-1">You reviewed {cards.length} word{cards.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={restart} className="bg-amber-700 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-medium transition-all">
                      Shuffle & Restart
                    </button>
                    <button onClick={() => setMode('words')} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3 rounded-xl text-sm transition-all">
                      Back to List
                    </button>
                  </div>
                </div>
              ) : card ? (
                <div className="flex flex-col items-center gap-6">
                  {/* progress */}
                  <div className="w-full flex items-center gap-3">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400/70 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-white/30 text-xs whitespace-nowrap">{index + 1} / {cards.length}</span>
                  </div>

                  {/* language badge on card */}
                  <div className="w-full">
                    <div
                      className="text-xs px-2 py-0.5 rounded-full border w-fit mb-2"
                      style={{ backgroundColor: langMeta(card.language).color, borderColor: langMeta(card.language).border, color: langMeta(card.language).text }}
                    >
                      {langMeta(card.language).label}
                    </div>

                    {/* flip card */}
                    <div onClick={() => setFlipped(f => !f)} style={{ perspective: '1000px' }} className="w-full cursor-pointer select-none">
                      <div style={{ transformStyle: 'preserve-3d', transition: 'transform 0.45s ease', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', position: 'relative', height: '200px' }}>
                        {/* front */}
                        <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
                          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex flex-col items-center justify-center gap-2 px-6">
                          <p className="text-white/30 text-xs tracking-widest uppercase mb-1">Word</p>
                          <p className="text-amber-200 text-5xl font-serif">{card.greek}</p>
                          <p className="text-white/30 text-xs mt-3">Tap or press Space to reveal</p>
                        </div>
                        {/* back */}
                        <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}
                          className="bg-amber-900/30 backdrop-blur-md border border-amber-400/30 rounded-2xl flex flex-col items-center justify-center gap-3 px-6 text-center">
                          <p className="text-amber-200 text-4xl font-serif">{card.greek}</p>
                          <p className="text-white/50 text-sm font-mono">{card.transliteration}</p>
                          <div className="w-8 h-px bg-amber-400/30 my-1" />
                          <p className="text-white/85 text-lg leading-snug">{card.meaning}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* controls */}
                  <div className="flex items-center gap-4 w-full">
                    <button onClick={prev} disabled={index === 0}
                      className="flex-1 py-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-white/60 hover:text-white text-sm transition-all disabled:opacity-30">
                      ← Prev
                    </button>
                    <button onClick={() => setFlipped(f => !f)}
                      className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40 text-xs transition-all hover:text-white/70">
                      Flip
                    </button>
                    <button onClick={next}
                      className="flex-1 py-3 bg-amber-700/80 hover:bg-amber-600 border border-amber-500/30 rounded-xl text-white text-sm font-medium transition-all">
                      {index >= cards.length - 1 ? 'Finish' : 'Next →'}
                    </button>
                  </div>
                  <p className="text-white/20 text-xs">← → arrow keys · Space to flip</p>
                </div>
              ) : null
            )}

          </div>
        )}
      </div>
    </main>
  );
}
