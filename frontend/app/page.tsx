'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setChecking(false);
    });
  }, []);

  const handleStart = () => {
    router.push(isLoggedIn ? '/tutor' : '/login');
  };

  return (
    <main
      className="min-h-screen relative flex flex-col"
      style={{
        backgroundImage: "url('/backgrounds/biblioteca_alejandria.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* navigation */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <img
            src="/greek-tutor-female.jpg"
            alt="Chronos"
            className="w-7 h-7 rounded-full object-cover opacity-90"
          />
          <span className="text-white font-semibold tracking-wide">
            Χρόνος
            <span className="text-white/50 font-normal text-sm ml-2">Chronos</span>
          </span>
        </div>

        {!checking && (
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <button
                onClick={() => router.push('/tutor')}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all"
              >
                Dashboard →
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push('/login')}
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => router.push('/login?signup=1')}
                  className="bg-amber-700 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-lg transition-all"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        )}
      </nav>

      {/* hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        <p className="text-amber-400/80 text-xs font-medium tracking-widest uppercase mb-5">
          AI · Ancient Languages · Live Voice
        </p>
        <h1 className="text-white text-4xl sm:text-5xl md:text-6xl font-bold leading-tight max-w-2xl mb-5 sm:mb-6">
          Speak the Language<br />of the Ancient World
        </h1>
        <p className="text-white/50 text-base sm:text-lg max-w-xl mb-8 sm:mb-10 leading-relaxed px-2">
          Learn Ancient Greek, Classical Nahuatl, and more through live voice conversations
          with AI tutors who bring history to life.
        </p>

        <button
          onClick={handleStart}
          className="bg-amber-700 hover:bg-amber-600 text-white px-8 sm:px-9 py-3.5 sm:py-4 rounded-xl text-base font-medium transition-all duration-200 shadow-xl mb-12 sm:mb-20"
        >
          Begin Your Journey
        </button>

        {/* language showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full mb-8">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-left">
            <p className="text-amber-300 text-3xl font-serif mb-2 tracking-widest">α β γ δ ε ζ</p>
            <p className="text-white font-semibold text-base mb-2">Ancient Greek</p>
            <p className="text-white/50 text-sm leading-relaxed mb-4">
              Converse with Ειρήνη — your AI tutor for ancient texts, philosophy, and the
              24-letter alphabet. Hover any word for instant grammar and etymology.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full">Voice Tutor</span>
              <span className="text-xs bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full">Alphabet Lessons</span>
              <span className="text-xs bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full">Etymology</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-left">
            <p className="text-green-300 text-3xl font-serif mb-2 tracking-wider">in tlapalli</p>
            <p className="text-white font-semibold text-base mb-2">Classical Nahuatl</p>
            <p className="text-white/50 text-sm leading-relaxed mb-4">
              Explore the language of the Aztec Empire. Speak with Citlali in English and
              discover Nahuatl color vocabulary with IPA pronunciation.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full">Voice Tutor</span>
              <span className="text-xs bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full">IPA Pronunciation</span>
              <span className="text-xs bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full">42 Color Words</span>
            </div>
          </div>
        </div>

        {/* feature pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">🎙️</p>
            <p className="text-white/80 text-sm font-medium">Live Voice Tutoring</p>
            <p className="text-white/40 text-xs mt-1 leading-relaxed">
              Real-time conversation with AI avatars over voice
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">📖</p>
            <p className="text-white/80 text-sm font-medium">Word-by-Word Analysis</p>
            <p className="text-white/40 text-xs mt-1 leading-relaxed">
              Hover any Greek word for morphology and etymology
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">🏛️</p>
            <p className="text-white/80 text-sm font-medium">Historical Context</p>
            <p className="text-white/40 text-xs mt-1 leading-relaxed">
              Learn through philosophy, texts, and ancient culture
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
