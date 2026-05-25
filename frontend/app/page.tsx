'use client'; // This file runs in the browser, not on the server — required for interactivity like typing and clicking

import { useState, useEffect } from 'react';
// useRouter allows us to navigate programmatically between pages without the user clicking a link
import { useRouter } from 'next/navigation';
// Supabase client for checking if the user is logged in before showing the chat
import { supabase } from '../lib/supabase';

import { BACKEND_URL } from '@/lib/config';

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

  // Stores the logged-in user's ID to associate conversations with their account
  const [userId, setUserId] = useState<string | null>(null);

  // Stores the vocabulary words learned in this session to display in the sidebar
  const [vocab, setVocab] = useState<VocabWord[]>([]);

  // Controls whether the vocabulary sidebar is visible
  const [showVocab, setShowVocab] = useState(false);

  // Tracks whether the microphone is currently listening for voice input
  const [isListening, setIsListening] = useState(false);

  // router gives us access to Next.js navigation — we use it to redirect users who haven't completed onboarding
  const router = useRouter();

  // When the page first loads, check if the user is logged in.
  // If not, redirect to login. If yes, check if they've completed onboarding.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // No active session means the user hasn't logged in yet
      if (!session) {
        router.push('/login');
        return;
      }

      // Save the user's ID so we can send it with every chat message
      setUserId(session.user.id);

      // User is logged in — now check if they've completed onboarding
      const saved = localStorage.getItem('chronos_profile');
      if (saved) {
        setProfile(JSON.parse(saved));
      } else {
        router.push('/onboarding');
      }
    });
  }, []);

  // When the session ID changes, fetch the updated vocabulary list from the backend
  useEffect(() => {
    if (sessionId) {
      //fetch(`https://spr26-team-25-production.up.railway.app/api/vocabulary/${sessionId}`)
      fetch('${BACKEND_URL}/api/vocabulary/${sessionId}')
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

  // Activates the browser's Web Speech API to transcribe the user's voice into text.
  // The transcribed text is placed into the input field so the user can review it before sending. 
  // This only works in Chrome, and other browsers do not fully support the Web Speech API
  function startListening() {
    // SpeechRecognition is a built-in browser API — no external library needed
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is only supported in Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    // Set the language to English — change to 'el-GR' for Greek input
    recognition.lang = 'en-US';
    // Return only the final result, not partial words as they're being spoken
    recognition.interimResults = false;

    setIsListening(true);

    // When the browser finishes transcribing, put the result in the input field
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    // If something goes wrong (e.g. no microphone access), stop listening
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  }

  // Send Chronos' response to the backend, which uses Google Cloud Text-to-Speech to generate audio.
  // The browser then plays the returned MP3 directly.
  async function speak(text: string) {
    try {
      // Send the text to the backend, which calls Google Cloud TTS and returns an MP3 audio file
      //const response = await fetch('https://spr26-team-25-production.up.railway.app/api/speak', {
      const response = await fetch('${BACKEND_URL}/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      // Convert the response into a blob (binary audio data) and create a playable URL
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play the audio automatically when it's ready
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error('TTS error:', error);
    }
  }

  // Handles sending a message when the learner presses Send or hits Enter
  async function sendMessage() {
    if (!input.trim()) return;

    // Read the user's ID directly from the active session at the moment of sending
    // This is more reliable than using the userId state variable, which may still
    // be null if the user sends a message before the useEffect has finished loading
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Send the message to the FastAPI backend, which forwards it to the AI tutor
    //const response = await fetch('https://spr26-team-25-production.up.railway.app/api/chat', {
    const response = await fetch('${BACKEND_URL}/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        level: getLevel(),
        goal: profile?.goal || 'General curiosity & history',
        time_commitment: profile?.time || '30-60 minutes',
        session_id: sessionId,
        user_id: currentUserId, // Attach the user's ID so the backend can save it to Supabase
        history: messages,
      }),
    });

    const data = await response.json();

    // Save the session ID returned by the backend for vocabulary tracking
    if (data.session_id && !sessionId) {
      setSessionId(data.session_id);
    }

    // Add Chronos's response to the conversation, read it aloud, and re-enable the input
    setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    speak(data.response);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
      {/* header — tutor avatar + title side by side */}
      <div className="flex items-center gap-3 mb-2">
        <img
          src="/greek-tutor-female.jpg"
          alt="Chronos tutor"
          className="w-12 h-12 rounded-full object-cover shadow-md"
        />
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Chronos</h1>
      </div>
      
      <p className="text-stone-500 mb-2">Your Ancient Greek AI Tutor</p>

      {/* button to access the voice tutor modes (greek conversation, lesson, nahuatl) */}
      <button
        onClick={() => router.push('/tutor')}
        className="mb-4 px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700"
      >
        🎙️ Voice Tutor
      </button>

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

                {/* show tutor avatar to the left of every assistant message */}
                {msg.role === 'assistant' && (
                  <img
                    src="/greek-tutor-female.jpg"
                    alt="Chronos tutor"
                    className="w-8 h-8 rounded-full object-cover mr-2 mt-1 flex-shrink-0"
                  />
                )}

                <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 text-stone-800'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* show avatar next to the loading indicator too, for consistency */}
            {loading && (
              <div className="flex items-start justify-start">
                <img
                  src="/greek-tutor-female.jpg"
                  alt="Chronos tutor"
                  className="w-8 h-8 rounded-full object-cover mr-2 mt-1 flex-shrink-0"
                />
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
            {/* Microphone button - uses the browser's built-in Web Speech API to convert voice to text. While listening, the button turns red and pulses so that the user knows it is active. The button is disabled when a message is loading or already listening. */}
            <button
              onClick={startListening}
              disabled={loading || isListening}
              className={`px-4 py-2 rounded-lg text-sm ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
              }`}
            >
              {isListening ? '🎙️ Listening...' : '🎙️'}
            </button>
            {/* Send button, which is disabled while waiting for a response to prevent duplicate messages */}
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