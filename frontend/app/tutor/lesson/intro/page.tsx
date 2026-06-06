'use client';

import { useRouter } from 'next/navigation';

// The 24 letters shown as a preview so the student knows what they're getting into.
// Same data as lesson/page.tsx, keeping it in sync manually for now.
const ALPHABET = [
  { upper: 'Α', lower: 'α', name: 'Alpha' },
  { upper: 'Β', lower: 'β', name: 'Beta' },
  { upper: 'Γ', lower: 'γ', name: 'Gamma' },
  { upper: 'Δ', lower: 'δ', name: 'Delta' },
  { upper: 'Ε', lower: 'ε', name: 'Epsilon' },
  { upper: 'Ζ', lower: 'ζ', name: 'Zeta' },
  { upper: 'Η', lower: 'η', name: 'Eta' },
  { upper: 'Θ', lower: 'θ', name: 'Theta' },
  { upper: 'Ι', lower: 'ι', name: 'Iota' },
  { upper: 'Κ', lower: 'κ', name: 'Kappa' },
  { upper: 'Λ', lower: 'λ', name: 'Lambda' },
  { upper: 'Μ', lower: 'μ', name: 'Mu' },
  { upper: 'Ν', lower: 'ν', name: 'Nu' },
  { upper: 'Ξ', lower: 'ξ', name: 'Xi' },
  { upper: 'Ο', lower: 'ο', name: 'Omicron' },
  { upper: 'Π', lower: 'π', name: 'Pi' },
  { upper: 'Ρ', lower: 'ρ', name: 'Rho' },
  { upper: 'Σ', lower: 'σ', name: 'Sigma' },
  { upper: 'Τ', lower: 'τ', name: 'Tau' },
  { upper: 'Υ', lower: 'υ', name: 'Upsilon' },
  { upper: 'Φ', lower: 'φ', name: 'Phi' },
  { upper: 'Χ', lower: 'χ', name: 'Chi' },
  { upper: 'Ψ', lower: 'ψ', name: 'Psi' },
  { upper: 'Ω', lower: 'ω', name: 'Omega' },
];

const STEPS = [
  {
    icon: '🔤',
    title: 'One letter at a time',
    description:
      'Ειρήνη introduces each of the 24 letters in order — its name, its sound, and an example Greek word. She teaches them in groups of five so it never feels overwhelming.',
  },
  {
    icon: '📺',
    title: 'Read the subtitles',
    description:
      'Everything Ειρήνη says appears as Greek text on screen, with the English translation highlighted in blue below. You always know exactly what she said.',
  },
  {
    icon: '⏎',
    title: 'You control the pace',
    description:
      'After each letter, a Continue button appears. Press it — or hit Space — when you\'re ready to move on. Ειρήνη waits for you.',
  },
  {
    icon: '🎙',
    title: 'Answer quiz questions by speaking',
    description:
        'At the end of each group, Ειρήνη will quiz you. If she asks what sound a letter makes, describe it phonetically in English — like "th" or "ah". You don\'t need to say anything in Greek.',
  },
];

export default function LessonIntroPage() {
  const router = useRouter();

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{
        background: 'linear-gradient(160deg, #0f0a05 0%, #1a1105 50%, #0f0a05 100%)',
      }}
    >
      <button
        onClick={() => router.push('/tutor')}
        className="absolute top-4 left-4 text-amber-200/50 hover:text-amber-200 text-sm transition-colors"
      >
        ← Back
      </button>

      <div className="text-center mb-12">
        <p className="text-amber-500/70 text-sm tracking-widest uppercase mb-3">
          Lesson 1
        </p>
        <h1 className="text-4xl font-bold text-amber-100 mb-3">
          The Greek Alphabet
        </h1>
        <p className="text-amber-200/50 text-base max-w-sm mx-auto leading-relaxed">
          Learn all 24 letters of Ancient Greek with Ειρήνη — one letter at a time, at your own pace.
        </p>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-xl">

        {STEPS.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-amber-800/30 p-6"
            style={{ background: 'rgba(255, 200, 80, 0.04)' }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ background: 'rgba(255, 180, 50, 0.12)', border: '1px solid rgba(255, 180, 50, 0.25)' }}
              >
                {step.icon}
              </div>
              <div>
                <h2 className="text-amber-100 text-base font-semibold mb-1">
                  {step.title}
                </h2>
                <p className="text-amber-200/60 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* alphabet preview so the student knows what they're about to learn */}
        <div
          className="rounded-2xl border border-amber-800/30 p-6"
          style={{ background: 'rgba(255, 200, 80, 0.04)' }}
        >
          <p className="text-amber-500/70 text-xs tracking-widest uppercase mb-4">
            The 24 letters you'll learn
          </p>
          <div className="grid grid-cols-6 gap-2">
            {ALPHABET.map((letter) => (
              <div
                key={letter.name}
                className="flex flex-col items-center justify-center rounded-xl py-2 px-1 border border-white/10"
                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                >
                <div className="flex items-baseline gap-1">
                    <span className="text-amber-200 text-xl font-serif leading-none">
                        {letter.upper}
                    </span>
                    <span className="text-amber-200/50 text-base font-serif leading-none">
                        {letter.lower}
                    </span>
                </div>
                <span className="text-white/40 text-[10px] mt-1">{letter.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="mt-12 flex flex-col items-center gap-3">
        <button
          onClick={() => router.push('/tutor/lesson')}
          className="px-8 py-3 rounded-full text-sm font-semibold transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #b45309, #92400e)',
            color: '#fef3c7',
            boxShadow: '0 0 24px rgba(180, 83, 9, 0.35)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 36px rgba(180, 83, 9, 0.55)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(180, 83, 9, 0.35)';
          }}
        >
          Start the lesson →
        </button>
        <p className="text-amber-200/30 text-xs">
          Make sure your microphone is ready
        </p>
      </div>
    </main>
  );
}