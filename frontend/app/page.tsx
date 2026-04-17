'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        level: 'beginner',
        history: messages,
      }),
    });

    const data = await response.json();
    setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Chronos</h1>
      <p className="text-stone-500 mb-6">Your Ancient Greek AI Tutor</p>

      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md flex flex-col h-[600px]">
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

        <div className="border-t p-4 flex gap-2">
          <input
            className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
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
    </main>
  );
}