'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BACKEND_URL } from '@/lib/config';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function UploadPackPage() {
  // state variables 
  const [packData, setPackData] = useState<object | null>(null);
  const [tutorName, setTutorName] = useState('');
  const [langName, setLangName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // Read the uploaded JSON file and extract basic metadata for display
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setPackData(json);
        setTutorName(json?.tutor?.name || 'Tutor');
        setLangName(json?.displayName || json?.id || 'Custom Language');
        setError(null);
      } catch {
        setError('Invalid JSON file. Please upload a valid language pack.');
      }
    };
    reader.readAsText(file);
  }
  // Send the user message to the backend with the full pack attached
  async function sendMessage() {
    if (!input.trim() || !packData) return;

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
        pack_id: 'custom',
        pack_data: packData,
        level: 'beginner',
        goal: 'everyday greetings',
        time_commitment: '30-60 minutes',
        session_id: sessionId,
        user_id: null,
        history: messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }

    if (data.session_id && !sessionId) {
      setSessionId(data.session_id);
    }

    setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    setLoading(false);
  }

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

        {!packData ? (
          // Show upload UI before a pack is loaded
          <div className="flex flex-col items-center justify-center flex-1 gap-6">
            <h1 className="text-white text-2xl font-semibold">📤 Upload Your Pack</h1>
            <p className="text-white/50 text-sm text-center">
              Upload a language pack JSON file to start a tutoring session
            </p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <label className="cursor-pointer bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl text-sm transition-colors">
              Choose JSON File
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        ) : (
          // Show chat UI once a pack is loaded
          <>
            <div className="text-center mb-4">
              <h1 className="text-white text-2xl font-semibold">{tutorName}</h1>
              <p className="text-white/50 text-sm mt-1">Your {langName} Tutor</p>
              <button
                onClick={() => { setPackData(null); setMessages([]); setSessionId(null); }}
                className="text-white/30 text-xs mt-1 hover:text-white/60"
              >
                Upload a different pack
              </button>
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
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
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
              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
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
          </>
        )}
      </div>
    </main>
  );
}