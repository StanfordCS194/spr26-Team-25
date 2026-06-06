'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { updateStreak } from '../../lib/streak';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

// Each category groups the mode buttons for one language.
// To add a new language or mode, just add an entry here — no JSX changes needed.
const CATEGORIES = [
  {
    label: 'Ancient Greek',
    flag: '🏛️',
    modes: [
      {
        emoji: '📖',
        title: 'Structured Lesson',
        description: 'Learn the Ancient Greek alphabet step by step with Ειρήνη',
        href: '/tutor/lesson/intro',
      },
      {
        emoji: '🗣️',
        title: 'Free Conversation',
        description: 'Ask Ειρήνη anything — modern Greek, ancient Greek, philosophy, history',
        href: '/tutor/conversation',
      },
      {
        emoji: '📚',
        title: 'Greek Dictionary',
        description: 'Look up any Ancient or Modern Greek word — conjugations, examples, etymology',
        href: '/dictionary',
      },
    ],
  },
  {
    label: 'Quechua',
    flag: '🏔️',
    modes: [
      {
        emoji: '🌄',
        title: 'Speak with Ñusta',
        description: 'Free conversation in Quechua — the language of the Incas, with English subtitles',
        href: '/tutor/quechua',
      },
      {
        emoji: '🏔️',
        title: 'Quechua Dictionary',
        description: 'Browse 3,998 words from Classical Quechua — the language of the Incas',
        href: '/tutor/quechua/dictionary',
      },
    ],
  },
  {
    label: 'Nahuatl',
    flag: '🌿',
    modes: [
      {
        emoji: '🌿',
        title: 'Nahuatl Colors',
        description: 'Learn color words in Classical Nahuatl — speak with Citlali in English',
        href: '/tutor/nahuatl',
      },
    ],
  },
  {
    label: 'Old Norse',
    flag: '⚔️',
    modes: [
      {
        emoji: '⚔️',
        title: 'Speak with Sigríðr',
        description: 'Free conversation in Old Norse — the language of the Vikings, with English subtitles',
        href: '/tutor/old-norse',
      },
    ],
  },
];

export default function TutorSelectPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [streakJustIncremented, setStreakJustIncremented] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }

      // Prefer localStorage; fall back to Supabase metadata for returning users
      // whose localStorage was cleared (e.g. after logout)
      let saved = localStorage.getItem('chronos_profile');
      if (!saved) {
        const metaProfile = user.user_metadata?.profile;
        if (metaProfile) {
          localStorage.setItem('chronos_profile', JSON.stringify(metaProfile));
          saved = JSON.stringify(metaProfile);
        }
      }
      if (!saved) { router.push('/onboarding'); return; }

      const name = user.user_metadata?.display_name as string | undefined;
      const fallback = (user.email ?? '').split('@')[0];
      setDisplayName(name || fallback);

      fetch(`${BACKEND}/api/vocabulary/by-user/${user.id}`)
        .then(r => r.json())
        .then(data => {
          const all = data.vocabulary ?? [];
          const visible = all.filter((w: any) => {
            const lang = (w.language ?? 'greek').toLowerCase();
            return !['old-norse', 'old_norse', 'norse'].includes(lang);
          });
          setWordCount(visible.length);
        })
        .catch(() => {});

      // update and read streak
      const { data: streakData, justIncremented } = updateStreak();
      setStreak(streakData.currentStreak);
      setLongestStreak(streakData.longestStreak);
      setStreakJustIncremented(justIncremented);

      setReady(true);
    });
  }, []);

  if (!ready) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white/30 text-sm">Loading...</p>
    </main>
  );

  const isNewStreak = streakJustIncremented && streak === 1;
  const isMilestone = streakJustIncremented && [3, 7, 14, 30, 60, 100].includes(streak);

  return (
    <main
      className="min-h-screen flex flex-col relative"
      style={{ backgroundImage: "url('/backgrounds/bg4.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/55" />

      {/* nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-8 py-5">
        <button onClick={() => router.push('/')} className="text-white/50 hover:text-white text-sm transition-colors">
          ← Chronos
        </button>
        <p className="text-white/30 text-xs tracking-wide hidden sm:block">Select a language to begin</p>
        <button onClick={() => router.push('/settings')} className="text-white/40 hover:text-white text-lg transition-colors" title="Settings">
          ⚙️
        </button>
      </nav>

      {/* content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-12">

        {/* personalised header */}
        <div className="text-center mb-10">
          <h1 className="text-white text-3xl font-semibold tracking-wide">Χρόνος</h1>
          {displayName && (
            <p className="text-white/60 text-base mt-1">Welcome back, {displayName}</p>
          )}
          <p className="text-white/35 text-sm mt-1">How would you like to learn today?</p>

          {/* stats row */}
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">

            {/* streak badge */}
            <div className={`inline-flex items-center gap-1.5 border rounded-full px-4 py-1.5 transition-all ${
              isMilestone
                ? 'bg-orange-500/20 border-orange-400/50'
                : streak >= 3
                ? 'bg-white/10 border-orange-400/30'
                : 'bg-white/10 border-white/15'
            }`}>
              <span className={`text-sm ${streak >= 3 ? 'animate-pulse' : ''}`}>🔥</span>
              <span className={`text-sm font-semibold ${streak >= 7 ? 'text-orange-300' : streak >= 3 ? 'text-orange-400/90' : 'text-white/60'}`}>
                {streak}
              </span>
              <span className="text-white/40 text-xs">
                {streak === 1 ? 'day' : 'day streak'}
              </span>
              {isMilestone && (
                <span className="text-orange-300 text-xs font-medium ml-0.5">🎉</span>
              )}
            </div>

            {/* word count badge */}
            {wordCount !== null && (
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5">
                <span className="text-amber-300 text-sm font-semibold">{wordCount}</span>
                <span className="text-white/40 text-xs">words learned</span>
                <button
                  onClick={() => router.push('/vocabulary')}
                  className="text-amber-400/70 hover:text-amber-300 text-xs ml-1 transition-colors"
                >
                  {wordCount > 0 ? 'Review →' : 'Vocabulary →'}
                </button>
              </div>
            )}
          </div>

          {/* milestone message */}
          {isMilestone && (
            <p className="mt-2 text-orange-300/80 text-xs font-medium">
              {streak}-day streak — keep it up!
            </p>
          )}
          {isNewStreak && !isMilestone && (
            <p className="mt-2 text-white/30 text-xs">Start your streak — come back tomorrow to keep it going</p>
          )}

          {/* longest streak hint — only show if current < longest */}
          {longestStreak > streak && (
            <p className="mt-1 text-white/20 text-xs">
              Personal best: {longestStreak} days
            </p>
          )}
        </div>

        <div className="w-full max-w-xl space-y-6 sm:space-y-8">

          {/* ── Ancient Greek ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/20" />
              <p className="text-amber-300/70 text-xs font-medium tracking-widest uppercase">Ancient Greek</p>
              <div className="h-px flex-1 bg-white/20" />
            </div>
            <div className="space-y-3">
              <ModeButton
                onClick={() => router.push('/tutor/conversation')}
                icon="🗣️" title="Free Conversation"
                desc="Speak openly with Ειρήνη — ancient Greek, philosophy, history"
                badge="Voice · Avatar"
                hoverColor="text-amber-300"
              />
              <ModeButton
                onClick={() => router.push('/tutor/lesson')}
                icon="📖" title="Alphabet Lesson"
                desc="Learn all 24 letters of the Greek alphabet step by step"
                badge="Structured"
                hoverColor="text-amber-300"
              />
            </div>
          </div>

          {/* ── Classical Nahuatl ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/20" />
              <p className="text-green-300/70 text-xs font-medium tracking-widest uppercase">Classical Nahuatl</p>
              <div className="h-px flex-1 bg-white/20" />
            </div>
            <div className="space-y-3">
              <ModeButton
                onClick={() => router.push('/tutor/nahuatl')}
                icon="🌿" title="Color Vocabulary"
                desc="42 Nahuatl color words with IPA — speak with Citlali in English"
                badge="Voice · IPA"
                hoverColor="text-green-300"
              />
            </div>
          </div>

          {/* ── Text Chat ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/20" />
              <p className="text-white/30 text-xs font-medium tracking-widest uppercase">Text Chat</p>
              <div className="h-px flex-1 bg-white/20" />
            </div>
            <div className="space-y-3">
              <ModeButton
                onClick={() => router.push('/chat')}
                icon="💬" title="Ancient Greek Chat"
                desc="Type with Ειρήνη — ask questions, get word-by-word explanations"
                badge="Text · TTS"
                hoverColor="text-white/90"
              />
            </div>
          </div>

          {/* ── Vocabulary ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/20" />
              <p className="text-amber-200/40 text-xs font-medium tracking-widest uppercase">Review</p>
              <div className="h-px flex-1 bg-white/20" />
            </div>
            <ModeButton
              onClick={() => router.push('/vocabulary')}
              icon="📚" title="Vocabulary & Flashcards"
              desc="Browse every word you've learned — search, export CSV, or drill with flip cards"
              badge="All sessions"
              hoverColor="text-amber-200"
            />
          </div>

        </div>

      </div>
    </main>
  );
}

function ModeButton({ onClick, icon, title, desc, badge, hoverColor }: {
  onClick: () => void;
  icon: string;
  title: string;
  desc: string;
  badge: string;
  hoverColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-5 sm:px-6 py-5 text-left transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-white text-base font-medium group-hover:${hoverColor} transition-colors`}>
            {icon} {title}
          </p>
          <p className="text-white/50 text-sm mt-1 leading-relaxed">{desc}</p>
        </div>
        <span className="text-white/25 text-xs mt-0.5 whitespace-nowrap flex-shrink-0">{badge}</span>
      </div>
    </button>
  );
}
