'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('signup') === '1') {
      setIsSignUp(true);
    }
  }, []);

  async function handleSubmit() {
    setLoading(true);
    setMessage('');

    if (isSignUp) {
      if (password !== confirmPassword) {
        setMessage('Passwords do not match.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setMessage('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Check your email to confirm your account.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        router.push('/tutor');
      }
    }

    setLoading(false);
  }

  return (
    <main
      className="min-h-screen relative flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: "url('/backgrounds/atardecer_palacio.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* back to home */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-5 left-6 z-10 text-white/50 hover:text-white text-sm transition-colors"
      >
        ← Chronos
      </button>

      {/* card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* logo */}
        <div className="text-center mb-8">
          <img
            src="/greek-tutor-female.jpg"
            alt="Chronos"
            className="w-12 h-12 rounded-full object-cover mx-auto mb-3 opacity-90"
          />
          <h1 className="text-white text-2xl font-semibold tracking-wide">Χρόνος</h1>
          <p className="text-white/40 text-sm mt-1">Ancient Language Tutor</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8">
          <h2 className="text-white text-lg font-semibold mb-6">
            {isSignUp ? 'Create an account' : 'Sign in'}
          </h2>

          <div className="space-y-3">
            <input
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => !isSignUp && e.key === 'Enter' && handleSubmit()}
            />
            {isSignUp && (
              <div className="relative">
                <input
                  className={`w-full bg-white/10 border rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                    confirmPassword.length > 0
                      ? password === confirmPassword
                        ? 'border-green-500/60'
                        : 'border-red-500/60'
                      : 'border-white/20'
                  }`}
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                {confirmPassword.length > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    {password === confirmPassword ? '✓' : '✗'}
                  </span>
                )}
              </div>
            )}
          </div>

          {message && (
            <p className="mt-4 text-sm text-amber-300/80">{message}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-6 w-full bg-amber-700 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Sign in'}
          </button>

          <button
            onClick={() => { setIsSignUp(!isSignUp); setConfirmPassword(''); setMessage(''); }}
            className="mt-3 w-full text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </main>
  );
}
