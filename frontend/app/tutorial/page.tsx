'use client';

import { useRouter } from 'next/navigation';

const steps = [
  {
    number: '01',
    icon: '🎙',
    title: 'Find a quiet place',
    subtitle: 'Before you begin',
    description:
      'Ειρήνη listens to you through your microphone. For the best experience, find a quiet room and use headphones if you have them. Make sure your browser has permission to use your microphone — it will ask the first time.',
    tip: 'Tip: A quiet environment makes a big difference. Background noise can confuse the speech recognition.',
  },
  {
    number: '02',
    icon: '💬',
    title: 'Talk with Ειρήνη',
    subtitle: 'Free conversation',
    description:
      'Ειρήνη is your Ancient Greek tutor. She will greet you in Koine Greek and wait for you to respond. You can ask her anything — the meaning of a word, how to say something in Greek, or to explain a grammar rule. Speak naturally in English and she will respond in Greek with English subtitles.',
    tip: 'Try asking: "How do you say hello in Ancient Greek?" or "What does χαίρω mean?"',
  },
  {
    number: '03',
    icon: '📖',
    title: 'Explore the dictionary',
    subtitle: 'Learn any word',
    description:
      'While Ειρήνη is speaking, her words appear as subtitles on screen. Every Greek word is clickable — hover over a word to see a quick translation, then click it to open the full dictionary entry in a new tab. There you can see the translation, conjugation, examples from classical texts, and etymology.',
    tip: "The dictionary works on any word Ειρήνη says — try clicking on words you don't recognise.",
  },
];

export default function TutorialPage() {
  const router = useRouter();

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{
        background: 'linear-gradient(160deg, #0f0a05 0%, #1a1105 50%, #0f0a05 100%)',
      }}
    >
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 text-amber-200/50 hover:text-amber-200 text-sm transition-colors"
      >
        ← Back
      </button>

      <div className="text-center mb-14">
        <p className="text-amber-500/70 text-sm tracking-widest uppercase mb-3">
          How to use
        </p>
        <h1 className="text-4xl font-bold text-amber-100 mb-3">Χρονός</h1>
        <p className="text-amber-200/50 text-base max-w-sm mx-auto leading-relaxed">
          Your Ancient Greek tutor — powered by AI, taught by Ειρήνη.
        </p>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-xl">
        {steps.map((step) => (
          <div
            key={step.number}
            className="rounded-2xl border border-amber-800/30 p-6"
            style={{ background: 'rgba(255, 200, 80, 0.04)' }}
          >
            <div className="flex items-start gap-4 mb-3">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{
                  background: 'rgba(255, 180, 50, 0.12)',
                  border: '1px solid rgba(255, 180, 50, 0.25)',
                }}
              >
                {step.icon}
              </div>
              <div>
                <p className="text-amber-500/60 text-xs tracking-widest uppercase mb-0.5">
                  Step {step.number} — {step.subtitle}
                </p>
                <h2 className="text-amber-100 text-lg font-semibold leading-tight">
                  {step.title}
                </h2>
              </div>
            </div>

            <p className="text-amber-200/60 text-sm leading-relaxed mb-3 pl-14">
              {step.description}
            </p>

            <div
              className="ml-14 rounded-lg px-4 py-2.5"
              style={{
                background: 'rgba(255, 180, 50, 0.07)',
                borderLeft: '2px solid rgba(255, 180, 50, 0.3)',
              }}
            >
              <p className="text-amber-300/70 text-xs leading-relaxed">{step.tip}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center gap-3">
        <button
          onClick={() => router.push('/tutor/conversation')}
          className="px-8 py-3 rounded-full text-sm font-semibold transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #b45309, #92400e)',
            color: '#fef3c7',
            boxShadow: '0 0 24px rgba(180, 83, 9, 0.35)',
          }}
        >
          Start talking with Ειρήνη →
        </button>
        <p className="text-amber-200/30 text-xs">Make sure your microphone is ready</p>
      </div>
    </main>
  );
}