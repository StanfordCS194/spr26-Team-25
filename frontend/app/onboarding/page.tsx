'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const languageQuestion = {
  id: 'language',
  question: 'Which language would you like to learn?',
  options: ['Ancient Greek', 'Old Norse'],
};

const greekFollowUps = [
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

const oldNorseFollowUps = [
  {
    id: 'experience',
    question: 'Have you studied Old Norse before?',
    options: ['No, complete beginner', 'A little (alphabet, basic words)', 'Some formal study', 'Advanced student'],
  },
  {
    id: 'goal',
    question: 'What is your main goal?',
    options: ['Read the Poetic Edda', 'Read the Prose Sagas', 'Viking history & culture', 'Academic linguistics'],
  },
  {
    id: 'time',
    question: 'How much time can you dedicate per week?',
    options: ['15–30 minutes', '30–60 minutes', '1–2 hours', '2+ hours'],
  },
];

const TOTAL_STEPS = 4; // language + 3 follow-ups

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const followUps = answers.language === 'Old Norse' ? oldNorseFollowUps : greekFollowUps;
  const current = step === 0 ? languageQuestion : followUps[step - 1];

  function selectOption(option: string) {
    const newAnswers = { ...answers, [current.id]: option };
    setAnswers(newAnswers);

    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('chronos_profile', JSON.stringify(newAnswers));
      router.push('/');
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Chronos</h1>
      <p className="text-stone-500 mb-10">Let&apos;s personalize your learning experience</p>

      <div className="w-full max-w-lg bg-white rounded-xl shadow-md p-8">

        {/* Progress bar — one segment per step */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-stone-800' : 'bg-stone-200'}`} />
          ))}
        </div>

        <h2 className="text-xl font-semibold text-stone-800 mb-6">{current.question}</h2>

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

      <p className="text-stone-400 text-sm mt-6">Question {step + 1} of {TOTAL_STEPS}</p>
    </main>
  );
}
