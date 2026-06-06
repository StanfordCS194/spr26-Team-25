'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const questions = [
  {
    id: 'experience',
    question: 'Have you studied Ancient Greek before?',
    options: ['No, complete beginner', 'A little (alphabet, basic words)', 'Some formal study', 'Advanced student'],
  },
  {
    id: 'goal',
    question: 'What is your main goal?',
    options: ['Read philosophy (Plato, Aristotle)', 'Read the New Testament', 'General curiosity & history', 'Academic coursework'],
  },
  {
    id: 'time',
    question: 'How much time can you dedicate per week?',
    options: ['15–30 minutes', '30–60 minutes', '1–2 hours', '2+ hours'],
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function selectOption(option: string) {
    const newAnswers = { ...answers, [questions[step].id]: option };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('chronos_profile', JSON.stringify(newAnswers));

      // persist profile to Supabase user metadata so it survives across devices/browsers
      try {
        await supabase.auth.updateUser({ data: { profile: newAnswers } });
      } catch (err) {
        console.error('failed to save profile to Supabase metadata:', err);
      }

      try {
        const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';
        await fetch(`${BACKEND}/onboarding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            experience: newAnswers.experience,
            goal: newAnswers.goal,
            time_commitment: newAnswers.time,
          }),
        });
      } catch (err) {
        console.error('failed to save onboarding response:', err);
      }

      router.push('/tutor');
    }
  }

  const current = questions[step];

  return (
    <main
      className="min-h-screen relative flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: "url('/backgrounds/ruinas_noche_realista.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/65" />

      {/* header */}
      <div className="relative z-10 text-center mb-8">
        <h1 className="text-white text-2xl font-semibold tracking-wide">Χρόνος</h1>
        <p className="text-white/40 text-sm mt-1">Let's personalise your learning experience</p>
      </div>

      {/* card */}
      <div className="relative z-10 w-full max-w-lg bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8">

        {/* progress bar */}
        <div className="flex gap-2 mb-8">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-amber-400' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        <h2 className="text-white text-xl font-semibold mb-6">{current.question}</h2>

        <div className="space-y-3">
          {current.options.map((option) => (
            <button
              key={option}
              onClick={() => selectOption(option)}
              className="w-full text-left px-4 py-3 rounded-xl border border-white/20 hover:border-amber-400/60 hover:bg-white/10 text-white/70 hover:text-white transition-all"
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <p className="relative z-10 text-white/30 text-xs mt-6">
        Question {step + 1} of {questions.length}
      </p>
    </main>
  );
}
