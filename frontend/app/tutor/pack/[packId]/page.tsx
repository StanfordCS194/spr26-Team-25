'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { BACKEND_URL } from '@/lib/config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PackMeta {
  id: string;
  name: string;
  tutorName: string;
  status: string;
}

export default function PackChatPage({ params }: { params: { packId: string } }) {
  const { packId } = params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Pack metadata fetched from the backend so this page works for any pack
  const [meta, setMeta] = useState<PackMeta | null>(null);

  const router = useRouter();

  useEffect(() => {
    // Redirect to login if the user is not authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      }
    });

    // Fetch pack metadata so we can show the tutor name and language name
    fetch(`${BACKEND_URL}/api/packs/${packId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setMeta(data);
      });
  }, [packId]);

  async function sendMessage() {
    if (!input.trim()) return;

    // Read the user id directly from the session at send time to avoid stale state
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const response = await fetch(`${BACKEND_URL}/api/chat-packs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        pack_id: packId,
        level: 'beginner',
        goal: 'everyday greetings',
        time_commitment: '30-60 minutes',
        session_id: sessionId,
        user_id: currentUserId,
        history: messages,
      }),
    });

    const data = await response.json();

    // Save the session id returned by the backend for conversation tracking
    if (data.session_id && !sessionId) {
      setSessionId(data.session_id);
    }

    setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    setLoading(false);
  }

  // Fall back to the pack id if metadata has not loaded yet
  const tutorName = meta?.tutorName || packId;
  const langName = meta?.name || packId;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{
        backgroundImage: 'url(/backgrounds/bg4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <button
        onClick={() => router.push('/tutor')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back
      </button>

      <div className="relative z-10 w-full max-w-2xl px-4 flex flex-col h-screen py-16">

        <div className="text-center mb-4">
          <h1 className="text-white text-2xl font-semibold">{tutorName}</h1>
          <p className="text-white/50 text-sm mt-1">Your {langName} Tutor</p>
          {meta?.status === 'endangered' && (
            <p className="text-amber-400/70 text-xs mt-1">🌿 Endangered language</p>
          )}
        </div>

        {/* Scrollable message area */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <p className="text-center text-white/40 mt-20">
              Say hello to start learning {langName}
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/90 backdrop-blur-sm border border-white/10'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 text-white/50 rounded-2xl px-4 py-3 text-sm">
                {tutorName} is thinking...
              </div>
            </div>
          )}
        </div>

        {/* Message input and send button */}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-xl text-sm disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}