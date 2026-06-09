'use client';

import { useRouter } from 'next/navigation';

const BACKGROUNDS = [
  '/backgrounds/atardecer_palacio.jpg',
  '/backgrounds/atardecer_ruinas_realistas.jpg',
  '/backgrounds/bg3.jpg',
  '/backgrounds/bg4.jpg',
  '/backgrounds/biblioteca_alejandria.jpg',
  '/backgrounds/calle_jerusalen_dia.jpg',
  '/backgrounds/lindo_mar.jpg',
  '/backgrounds/mercado_dia_realista.jpg',
  '/backgrounds/ruinas_noche_realista.jpg',
];

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
  {
    label: 'Language Packs',
    flag: '🌍',
    modes: [
      {
        emoji: '🌲',
        title: 'Ojibwe with Nishin',
        description: 'An endangered Algonquian language of the Great Lakes region',
        href: '/tutor/pack/ojibwe',
      },
    ],
  },
];

export default function TutorSelectPage() {
  const router = useRouter();
  const background = '/backgrounds/bg4.jpg';

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back to chat
      </button>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 py-12 text-center w-full max-w-lg">

        <div>
          <h1 className="text-white text-3xl font-semibold tracking-wide">Χρόνος</h1>
          <p className="text-white/60 text-sm mt-1">How would you like to learn today?</p>
        </div>

        {/* Tutorial sits above the language categories since it applies to all of them */}
        <button
          onClick={() => router.push('/tutorial')}
          className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
        >
          <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
            📘 Tutorial
          </p>
          <p className="text-white/50 text-sm mt-1">
            Learn how to talk with Ειρήνη and explore the dictionary
          </p>
        </button>

        <div className="flex flex-col gap-6 w-full">
          {CATEGORIES.map((category) => (
            <div key={category.label} className="flex flex-col gap-2">

              {/* Category label with a thin divider line to its right */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-base">{category.flag}</span>
                <span className="text-white/40 text-xs font-semibold tracking-widest uppercase">
                  {category.label}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {category.modes.map((mode) => (
                <button
                  key={mode.href}
                  onClick={() => router.push(mode.href)}
                  className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
                >
                  <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
                    {mode.emoji} {mode.title}
                  </p>
                  <p className="text-white/50 text-sm mt-1">
                    {mode.description}
                  </p>
                </button>
              ))}
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}