'use client'; // This file runs in the browser, not on the server — required for interactivity like typing and clicking

import { useState, useEffect } from 'react';
// useRouter allows us to navigate programmatically between pages without the user clicking a link
import { useRouter } from 'next/navigation';

// Define the shape of a chat message
// role distinguishes who spoke: 'user' is the learner, 'assistant' is the Chronos tutor
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Define the shape of the learner's profile collected during onboarding
interface UserProfile {
  experience: string; // Prior knowledge of Ancient Greek (e.g. "No, complete beginner")
  goal: string;       // Why they want to learn (e.g. "Read the New Testament")
  time: string;       // Weekly time commitment (e.g. "30–60 minutes")
}

// Define the shape of a vocabulary word saved in Supabase
interface VocabWord {
  greek: string;
  transliteration: string;
  meaning: string;
}

export default function Home() {
  // Stores the full conversation so it can be displayed on screen and sent to the backend for context
  const [messages, setMessages] = useState<Message[]>([]);

  // Tracks what the learner is currently typing before they press Send
  const [input, setInput] = useState('');

  // When true, shows "Chronos is thinking..." while waiting for the tutor's response
  const [loading, setLoading] = useState(false);

  // Holds the learner's onboarding profile so the tutor can personalize its teaching style
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Stores the session ID returned by the backend to track this conversation
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Stores the vocabulary words learned in this session to display in the sidebar
  const [vocab, setVocab] = useState<VocabWord[]>([]);

  // Controls whether the vocabulary sidebar is visible
  const [showVocab, setShowVocab] = useState(false);

  // router gives us access to Next.js navigation — we use it to redirect users who haven't completed onboarding
  const router = useRouter();

  // When the page first loads, check if the learner has completed onboarding
  // If not, redirect them to the onboarding flow before they can access the tutor
  useEffect(() => {
    const saved = localStorage.getItem('chronos_profile');
    if (saved) {
      setProfile(JSON.parse(saved));
    } else {
      router.push('/onboarding');
    }
  }, []);

  // When the session ID changes, fetch the updated vocabulary list from the backend
  useEffect(() => {
    if (sessionId) {
      fetch(`http://localhost:8000/api/vocabulary/${sessionId}`)
        .then(res => res.json())
        .then(data => setVocab(data.vocabulary || []));
    }
  }, [sessionId, messages]); // Re-fetch after each new message

  // Maps the learner's onboarding experience answer to a simple level string
  // This level is sent to the backend so the tutor knows whether to start
  // with the alphabet and basic vocabulary, or jump into grammar and complex texts
  function getLevel(): string {
    if (!profile) return 'beginner';
    if (profile.experience === 'No, complete beginner') return 'beginner';
    if (profile.experience === 'A little (alphabet, basic words)') return 'beginner';
    if (profile.experience === 'Some formal study') return 'intermediate';
    return 'advanced';
  }

  // Handles sending a message when the learner presses Send or hits Enter
  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Send the message to the FastAPI backend, which forwards it to the AI tutor
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        level: getLevel(),
        goal: profile?.goal || 'General curiosity & history',
        time_commitment: profile?.time || '30-60 minutes',
        session_id: sessionId,
        history: messages,
      }),
    });

    const data = await response.json();

    // Save the session ID returned by the backend for vocabulary tracking
    if (data.session_id && !sessionId) {
      setSessionId(data.session_id);
    }

    setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Chronos</h1>
      <p className="text-stone-500 mb-2">Your Ancient Greek AI Tutor</p>

      {/* Show the learner's goal and level, plus a button to toggle the vocabulary sidebar */}
      {profile && (
        <div className="flex items-center gap-4 mb-4">
          <p className="text-sm text-stone-400">
            Goal: {profile.goal} · Level: {getLevel()}
          </p>
          <button
            onClick={() => setShowVocab(!showVocab)}
            className="text-sm bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-1 rounded-lg"
          >
            {showVocab ? 'Hide' : 'Show'} Vocabulary ({vocab.length})
          </button>
        </div>
      )}

      <div className="w-full max-w-4xl flex gap-4">
        {/* Main chat window */}
        <div className="flex-1 bg-white rounded-xl shadow-md flex flex-col h-[600px]">

          {/* Scrollable message area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <p className="text-center text-stone-400 mt-20">
                Start a conversation to begin learning Ancient Greek
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 text-stone-800'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-stone-100 text-stone-400 rounded-lg px-4 py-2 text-sm">
                  Chronos is thinking...
                </div>
              </div>
            )}
          </div>

          {/* Text input and send button */}
          <div className="border-t p-4 flex gap-2">
            <input
              className="flex-1 border rounded-lg px-4 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>

        {/* Vocabulary sidebar — shown when the user clicks "Show Vocabulary" */}
        {showVocab && (
          <div className="w-64 bg-white rounded-xl shadow-md p-4 h-[600px] overflow-y-auto">
            <h2 className="font-semibold text-stone-800 mb-3">Words Learned</h2>
            {vocab.length === 0 ? (
              <p className="text-stone-400 text-sm">No words yet — start chatting!</p>
            ) : (
              <div className="space-y-3">
                {vocab.map((word, i) => (
                  <div key={i} className="border-b border-stone-100 pb-2">
                    <p className="text-lg text-stone-800">{word.greek}</p>
                    <p className="text-xs text-stone-400">{word.transliteration}</p>
                    <p className="text-sm text-stone-600">{word.meaning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}