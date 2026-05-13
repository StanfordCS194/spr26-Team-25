'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// the three diagnostic questions shown to the user during onboarding
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
  // useRouter allows us to navigate to other pages programmatically
  const router = useRouter();

  // track which question we're on (0, 1, or 2)
  const [step, setStep] = useState(0);

  // store the user's answers as a key-value object, e.g. { experience: "beginner", goal: "philosophy" }
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // called when the user clicks an answer option
  async function selectOption(option: string) {
    // add the new answer to the existing answers without losing previous ones
    const newAnswers = { ...answers, [questions[step].id]: option };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      // more questions remain — advance to the next one
      setStep(step + 1);
    } else {
      // all questions answered — save profile to localStorage for the tutor session
      localStorage.setItem('chronos_profile', JSON.stringify(newAnswers));

      // also send the answers to Railway so we can track them in Supabase.
      // wrapped in try/catch so that if this fails, the user still gets to the app
      try {
        await fetch('https://spr26-team-25-production.up.railway.app/onboarding', {
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
      // go to verbal/audio tutor selection page 
      router.push('/tutor');
    }
  }

  // the current question being displayed
  const current = questions[step];

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Chronos</h1>
      <p className="text-stone-500 mb-10">Let's personalize your learning experience</p>

      <div className="w-full max-w-lg bg-white rounded-xl shadow-md p-8">

        {/* progress bar — one segment per question, filled up to the current step */}
        <div className="flex gap-2 mb-8">
          {questions.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-stone-800' : 'bg-stone-200'}`} />
          ))}
        </div>

        {/* the current question text */}
        <h2 className="text-xl font-semibold text-stone-800 mb-6">{current.question}</h2>

        {/* answer options — each is a clickable button */}
        <div className="space-y-3">
          {current.options.map((option) => (
            <button
              key={option}
              onClick={() => selectOption(option)}
              className="w-full text-left px-4 py-3 rounded-lg border border-stone-200 hover:border-stone-800 hover:bg-stone-50 text-stone-700 transition-all"
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* shows the user which question they're on */}
      <p className="text-stone-400 text-sm mt-6">Question {step + 1} of {questions.length}</p>
    </main>
  );
}