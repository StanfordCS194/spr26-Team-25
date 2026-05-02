'use client';

import { useRouter } from 'next/navigation';

// all available backgrounds, same pool as the tutor pages
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

export default function TutorSelectPage() {
  const router = useRouter();
  // pick a random background once when the component mounts
  // const background = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
  // for now use bg4 it looks pretty
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
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* back button */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back to chat
      </button>

      {/* selection card */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        {/* title */}
        <div>
          <h1 className="text-white text-3xl font-semibold tracking-wide">Χρόνος</h1>
          <p className="text-white/60 text-sm mt-1">How would you like to learn today?</p>
        </div>

        {/* mode buttons */}
        <div className="flex flex-col gap-4 w-full max-w-sm">
          {/* conversation mode */}
          <button
            onClick={() => router.push('/tutor/conversation')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
          >
            <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
              🗣️ Free Conversation
            </p>
            <p className="text-white/50 text-sm mt-1">
              Ask Ειρήνη anything — modern Greek, ancient Greek, philosophy, history
            </p>
          </button>

          {/* lesson mode, coming soon */}
          <button
            onClick={() => router.push('/tutor/lesson')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group opacity-60"
            disabled
          >
            <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
              📖 Structured Lesson
            </p>
            <p className="text-white/50 text-sm mt-1">
              Learn ancient Greek step by step — coming soon
            </p>
          </button>
        </div>
      </div>
    </main>
  );
}