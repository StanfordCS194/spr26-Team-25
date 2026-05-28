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
          {/* tutorial — how to use the app */}
          <button
            onClick={() => router.push('/tutorial')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
          >
            <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
               Tutorial
            </p>
            <p className="text-white/50 text-sm mt-1">
              Learn how to talk with Ειρήνη and explore the dictionary
            </p>
          </button>
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

          {/* structured lesson mode — teaches the 24 letters of the greek alphabet */}
          <button
            onClick={() => router.push('/tutor/lesson')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
          >
            <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
              📖 Structured Lesson
            </p>
            <p className="text-white/50 text-sm mt-1">
              Learn the Ancient Greek alphabet step by step with Ειρήνη
            </p>
          </button>
          {/* nahuatl mode: voice conversation in English with Citlali, teaching Nahuatl color words.
          uses the same LiveKit + avatar setup as the greek conversation but with an English
          voice and NAHUATL:/SPEECH: captions instead of GR:/EN: */}
          <button
            onClick={() => router.push('/tutor/nahuatl')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
          >
            <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
              🌿 Nahuatl Colors
            </p>
            <p className="text-white/50 text-sm mt-1">
              Learn color words in Classical Nahuatl — speak with Citlali in English
            </p>
          </button>
          {/* quechua dictionary */}
          <button
            onClick={() => router.push('/tutor/quechua/dictionary')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
          >
            <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
              🏔️ Quechua Dictionary
            </p>
            <p className="text-white/50 text-sm mt-1">
              Browse 3,998 words from Classical Quechua — the language of the Incas
            </p>
          </button>
          {/* quechua voice tutor. free conversation with Ñusta in Quechua with English subtitles */}
          <button
            onClick={() => router.push('/tutor/quechua')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
          >
            <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
               🌄 Speak with Ñusta
            </p>
            <p className="text-white/50 text-sm mt-1">
              Free conversation in Quechua — the language of the Incas, with English subtitles
            </p>
          </button>
          {/* dictionary. search any ancient or modern greek word */}
          <button
            onClick={() => router.push('/dictionary')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
          >
            <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
              📚 Greek Dictionary
            </p>
            <p className="text-white/50 text-sm mt-1">
              Look up any Ancient or Modern Greek word — conjugations, examples, etymology
            </p>
          </button>
        </div>
      </div>
    </main>
  );
}