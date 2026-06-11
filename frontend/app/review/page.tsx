'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface VocabWord {
  id: number;
  greek: string;
  transliteration: string;
  meaning: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ReviewPage() {
  const router = useRouter();
  const [cards, setCards] = useState<VocabWord[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      fetch(`${BACKEND}/api/vocabulary/by-user/${user.id}`)
        .then(r => r.json())
        .then(data => {
          const words: VocabWord[] = data.vocabulary ?? [];
          // deduplicate by greek word
          const seen = new Set<string>();
          const unique = words.filter(w => {
            if (seen.has(w.greek)) return false;
            seen.add(w.greek);
            return true;
          });
          setCards(shuffle(unique));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, []);

  // keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowDown') { e.preventDefault(); setFlipped(f => !f); }
      if (e.code === 'ArrowRight') next();
      if (e.code === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, cards.length]);

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

  const restart = () => {
    setCards(shuffle(cards));
    setIndex(0);
    setFlipped(false);
    setDone(false);
  };

  const card = cards[index];
  const progress = cards.length > 0 ? ((index + 1) / cards.length) * 100 : 0;

  return (
    <main
      className="min-h-screen relative flex flex-col"
      style={{ backgroundImage: "url('/backgrounds/biblioteca_alejandria.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/70" />

      {/* nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5">
        <button onClick={() => router.push('/tutor')} className="text-white/50 hover:text-white text-sm transition-colors">
          ← Back
        </button>
        <p className="text-white/40 text-xs tracking-widest uppercase">Vocabulary Review</p>
        <button onClick={() => router.push('/settings')} className="text-white/30 hover:text-white text-sm transition-colors">
          All Words
        </button>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-16">

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-2">
              {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </div>
            <p className="text-white/30 text-sm">Loading your vocabulary...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center space-y-4 max-w-xs">
            <p className="text-5xl">📚</p>
            <h2 className="text-white text-xl font-semibold">No words yet</h2>
            <p className="text-white/40 text-sm">Complete a voice session or text chat to build your vocabulary list.</p>
            <button onClick={() => router.push('/tutor')} className="mt-2 bg-amber-700 hover:bg-amber-600 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all">
              Start a Session
            </button>
          </div>
        ) : done ? (
          <div className="text-center space-y-5 max-w-xs w-full">
            <div className="w-16 h-16 rounded-full bg-amber-700/40 border border-amber-400/30 flex items-center justify-center text-3xl mx-auto">✓</div>
            <div>
              <h2 className="text-white text-2xl font-semibold">Round complete!</h2>
              <p className="text-white/40 text-sm mt-1">You reviewed {cards.length} word{cards.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={restart} className="bg-amber-700 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-medium transition-all">
                Shuffle & Restart
              </button>
              <button onClick={() => router.push('/tutor')} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3 rounded-xl text-sm transition-all">
                Back to Menu
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            {/* progress bar */}
            <div className="w-full flex items-center gap-3">
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400/70 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-white/30 text-xs whitespace-nowrap">{index + 1} / {cards.length}</span>
            </div>

            {/* card */}
            <div
              onClick={() => setFlipped(f => !f)}
              style={{ perspective: '1000px' }}
              className="w-full cursor-pointer select-none"
            >
              <div style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.45s ease',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                position: 'relative',
                height: '220px',
              }}>
                {/* front — Greek word */}
                <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex flex-col items-center justify-center gap-2 px-6">
                  <p className="text-white/30 text-xs tracking-widest uppercase mb-2">Greek</p>
                  <p className="text-amber-200 text-5xl font-serif">{card.greek}</p>
                  <p className="text-white/30 text-xs mt-4">Tap or press Space to reveal</p>
                </div>

                {/* back — transliteration + meaning */}
                <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}
                  className="bg-amber-900/30 backdrop-blur-md border border-amber-400/30 rounded-2xl flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-amber-200 text-4xl font-serif">{card.greek}</p>
                  <p className="text-white/50 text-sm font-mono">{card.transliteration}</p>
                  <div className="w-8 h-px bg-amber-400/30 my-1" />
                  <p className="text-white/85 text-lg leading-snug">{card.meaning}</p>
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
        )}
      </div>
    </main>
  );
}
