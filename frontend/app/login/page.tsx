'use client';

import { useState } from 'react';
// Import our shared Supabase client to handle auth
import { supabase } from '../../lib/supabase';
// useRouter lets us redirect to the chat after a successful login
import { useRouter } from 'next/navigation';

export default function Login() {
  // Tracks whether the user is logging in or creating a new account
  const [isSignUp, setIsSignUp] = useState(false);

  // Email and password fields controlled by React state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Shows error messages (e.g. wrong password) or success messages (e.g. check your email)
  const [message, setMessage] = useState('');

  // Prevents double-submitting while waiting for Supabase to respond
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleSubmit() {
    setLoading(true);
    setMessage('');

    if (isSignUp) {
      // Create a new account — Supabase sends a confirmation email
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Check your email to confirm your account.');
      }
    } else {
      // Log in with existing credentials
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        // Redirect to onboarding if first time, or straight to chat
        router.push('/');
      }
    }

    setLoading(false);
  }

  return (
    // min-h-screen makes the page fill the full browser height
    // flex + items-center + justify-center centers everything vertically and horizontally
    <main className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Chronos</h1>
      <p className="text-stone-500 mb-8">Your Ancient Greek AI Tutor</p>

      {/* White card container — rounded corners, shadow, fixed width, centered */}
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">

        {/* Title changes dynamically based on isSignUp state */}
        <h2 className="text-xl font-semibold text-stone-800 mb-6">
          {isSignUp ? 'Create an account' : 'Sign in'}
        </h2>

        {/* space-y-4 adds vertical spacing between the two inputs automatically */}
        <div className="space-y-4">
          {/* Controlled input — React owns the value, updates on every keystroke via onChange */}
          <input
            className="w-full border rounded-lg px-4 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {/* type="password" automatically hides the characters as the user types */}
          <input
            className="w-full border rounded-lg px-4 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {/* Only renders if message is non-empty — shows errors or success notices */}
        {message && (
          <p className="mt-4 text-sm text-stone-500">{message}</p>
        )}

        {/* Primary action button — disabled while loading to prevent duplicate requests */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full bg-stone-800 text-white py-2 rounded-lg text-sm hover:bg-stone-700 disabled:opacity-50"
        >
          {/* Button label changes based on both loading state and sign-up vs sign-in mode */}
          {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Sign in'}
        </button>

        {/* Secondary button to toggle between sign-in and sign-up modes */}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-3 w-full text-sm text-stone-400 hover:text-stone-600"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </main>
  );
}
