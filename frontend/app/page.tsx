'use client'; // This file runs in the browser, not on the server — required for interactivity like typing and clicking

import { useState, useEffect } from 'react';
// useState: stores data that can change over time without reloading the page
// useEffect: runs code at a specific moment — here, when the page first loads

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

export default function Home() {
  // Stores the full conversation so it can be displayed on screen and sent to the backend for context
  const [messages, setMessages] = useState<Message[]>([]);

  // Tracks what the learner is currently typing before they press Send
  const [input, setInput] = useState('');

  // When true, shows "Chronos is thinking..." while waiting for the tutor's response
  const [loading, setLoading] = useState(false);

  // Holds the learner's onboarding profile so the tutor can personalize its teaching style
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // When the page first loads, retrieve the learner's saved onboarding profile from the browser
  // This allows Chronos to remember who the learner is across sessions without a login system
  useEffect(() => {
    const saved = localStorage.getItem('chronos_profile');
    if (saved) {
      setProfile(JSON.parse(saved)); // Convert the stored text back into a JavaScript object
    }
  }, []); // The empty [] ensures this only runs once when the page first opens, not on every re-render

  // Maps the learner's onboarding experience answer to a simple level string
  // This level is sent to the backend so the tutor knows whether to start
  // with the alphabet and basic vocabulary, or jump into grammar and complex texts
  function getLevel(): string {
    if (!profile) return 'beginner'; // Default to beginner if no profile is found
    if (profile.experience === 'No, complete beginner') return 'beginner';
    if (profile.experience === 'A little (alphabet, basic words)') return 'beginner';
    if (profile.experience === 'Some formal study') return 'intermediate';
    return 'advanced';
  }

  // Handles sending a message when the learner presses Send or hits Enter
  async function sendMessage() {
    if (!input.trim()) return; // Prevent sending empty or whitespace-only messages

    // Add the learner's message to the screen immediately, before waiting for the tutor's reply
    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');      // Clear the text box so the learner can type their next message
    setLoading(true);  // Show the "Chronos is thinking..." indicator

    // Send the message to the FastAPI backend, which forwards it to the AI tutor
    // We include the full conversation history so the tutor maintains context across the session
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        level: getLevel(),                              // Tells the tutor how to pitch its vocabulary and grammar explanations
        goal: profile?.goal || 'General curiosity & history',         // Learner's goal so the tutor focuses on the right texts and vocabulary
        time_commitment: profile?.time || '30-60 minutes',            // Weekly time so the tutor adjusts the pace of progression
        history: messages,                             // Previous messages so the tutor doesn't lose track of what was covered
      }),
    });

    // Add the tutor's response to the conversation and hide the loading indicator
    const data = await response.json();
    setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Chronos</h1>
      <p className="text-stone-500 mb-6">Your Ancient Greek AI Tutor</p>

      {/* If the learner completed onboarding, show their learning goal and detected level below the title */}
      {profile && (
        <p className="text-sm text-stone-400 mb-4">
          Goal: {profile.goal} · Level: {getLevel()}
        </p>
      )}

      {/* Main chat window */}
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md flex flex-col h-[600px]">

        {/* Scrollable area where the conversation history is displayed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Prompt shown before the learner sends their first message */}
          {messages.length === 0 && (
            <p className="text-center text-stone-400 mt-20">
              Start a conversation to begin learning Ancient Greek
            </p>
          )}

          {/* Render each message — learner messages appear on the right, tutor messages on the left */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-stone-800 text-white'     // Learner messages: dark background
                  : 'bg-stone-100 text-stone-800'  // Tutor messages: light background
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Shown while the tutor is generating its response */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-stone-100 text-stone-400 rounded-lg px-4 py-2 text-sm">
                Chronos is thinking...
              </div>
            </div>
          )}
        </div>

        {/* Text input and send button at the bottom of the chat window */}
        <div className="border-t p-4 flex gap-2">
          <input
            className="flex-1 border rounded-lg px-4 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}           // Update state as the learner types
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()} // Allow sending with the Enter key
          />
          <button
            onClick={sendMessage}
            disabled={loading} // Prevent double-sending while the tutor is still responding
            className="bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}