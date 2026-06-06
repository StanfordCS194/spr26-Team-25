'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AvatarCircle from '../../components/AvatarCircle';
import { loadStoredAvatar, type TutorAvatar } from '../../lib/avatars';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UserProfile {
  experience: string;
  goal: string;
  time: string;
}

interface VocabWord {
  greek: string;
  transliteration: string;
  meaning: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [vocab, setVocab] = useState<VocabWord[]>([]);
  const [showVocab, setShowVocab] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [avatar, setAvatar] = useState<TutorAvatar | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  // Stop audio and clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Load auth + profile + recent conversation history
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }

      setUserId(user.id);
      setAvatar(loadStoredAvatar());

      const saved = localStorage.getItem('chronos_profile');
      if (saved) {
        setProfile(JSON.parse(saved));
      } else {
        router.push('/onboarding');
        return;
      }

      // Load the most recent session's messages
      fetch(`${BACKEND}/api/conversations/recent/${user.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.session_id && data.messages?.length > 0) {
            setSessionId(data.session_id);
            setMessages(data.messages as Message[]);
          }
        })
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    });
  }, []);

  // Fetch session vocab whenever sessionId or messages change
  useEffect(() => {
    if (sessionId) {
      fetch(`${BACKEND}/api/vocabulary/${sessionId}`)
        .then(res => res.json())
        .then(data => setVocab(data.vocabulary || []));
    }
  }, [sessionId, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function getLevel(): string {
    if (!profile) return 'beginner';
    if (profile.experience === 'No, complete beginner') return 'beginner';
    if (profile.experience === 'A little (alphabet, basic words)') return 'beginner';
    if (profile.experience === 'Some formal study') return 'intermediate';
    return 'advanced';
  }

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Voice input is only supported in Chrome.'); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    setIsListening(true);

    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  async function speak(text: string) {
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      const response = await fetch(`${BACKEND}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const audioBlob = await response.blob();
      const objectUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(objectUrl);
      audioRef.current = audio;

      audio.onended = () => URL.revokeObjectURL(objectUrl);
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }

  function startNewChat() {
    stopAudio();
    setMessages([]);
    setSessionId(null);
    setVocab([]);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          level: getLevel(),
          goal: profile?.goal || 'General curiosity & history',
          time_commitment: profile?.time || '30-60 minutes',
          session_id: sessionId,
          user_id: userId,
          history: messages,
        }),
      });

      const data = await response.json();
      if (data.session_id && !sessionId) setSessionId(data.session_id);

      const updated = [...newMessages, { role: 'assistant' as const, content: data.response }];
      setMessages(updated);
      speak(data.response);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen relative flex flex-col"
      style={{
        backgroundImage: "url('/backgrounds/atardecer_ruinas_realistas.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/70" />

      {/* nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 flex-shrink-0 gap-2">
        <button
          onClick={() => { stopAudio(); router.push('/tutor'); }}
          className="text-white/50 hover:text-white text-sm transition-colors flex-shrink-0"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 min-w-0">
          {avatar && <AvatarCircle avatar={avatar} size="xs" />}
          <span className="text-white/70 text-sm font-medium truncate hidden sm:block">Ancient Greek · Text Chat</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={startNewChat}
            className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 text-white/50 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
            title="Start a fresh conversation"
          >
            + New
          </button>
          <button
            onClick={() => setShowVocab(!showVocab)}
            className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
          >
            词 {vocab.length > 0 ? `(${vocab.length})` : 'Vocab'}
          </button>
          <button
            onClick={() => { stopAudio(); router.push('/settings'); }}
            className="text-white/40 hover:text-white text-lg transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </nav>

      {/* chat area */}
      <div className="relative z-10 flex-1 flex gap-4 px-4 pb-4 min-h-0">
        <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">

          {/* messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="flex gap-2">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
                <p className="text-white/30 text-xs">Loading conversation history...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16">
                {avatar && <AvatarCircle avatar={avatar} size="xl" />}
                <div>
                  <p className="text-white/60 text-base font-medium">
                    Γεια σου! I'm {avatar?.name ?? 'Ειρήνη'}.
                  </p>
                  <p className="text-white/30 text-sm mt-1 max-w-xs">
                    Ask me anything in English — I'll reply in Ancient Greek and explain it word by word.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {['How do I say "hello"?', 'Teach me a Greek word', 'What did Socrates say?'].map(s => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-xs bg-white/10 hover:bg-white/20 border border-white/15 text-white/50 hover:text-white/80 px-3 py-1.5 rounded-full transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* history banner */}
                <div className="flex items-center gap-2 justify-center mb-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-white/20 text-xs">previous conversation</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && avatar && (
                      <div className="mr-2 mt-1">
                        <AvatarCircle avatar={avatar} size="sm" />
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-amber-700/80 text-white'
                        : 'bg-white/10 border border-white/10 text-white/85'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </>
            )}

            {loading && (
              <div className="flex items-start">
                {avatar && <div className="mr-2 mt-1"><AvatarCircle avatar={avatar} size="sm" /></div>}
                <div className="bg-white/10 border border-white/10 text-white/40 rounded-xl px-4 py-2.5 text-sm">
                  Ειρήνη is thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* input bar */}
          <div className="border-t border-white/10 p-4 flex gap-2">
            <input
              className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              placeholder="Ask Ειρήνη anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={historyLoading}
            />
            <button
              onClick={startListening}
              disabled={loading || isListening || historyLoading}
              className={`px-3 py-2 rounded-xl text-sm transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 border border-white/15 text-white/60'
              }`}
            >
              🎙️
            </button>
            <button
              onClick={sendMessage}
              disabled={loading || historyLoading}
              className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>

        {/* vocabulary sidebar — side panel on desktop, bottom sheet on mobile */}
        {showVocab && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/50 sm:hidden"
              onClick={() => setShowVocab(false)}
            />
            <div className="
              fixed bottom-0 left-0 right-0 h-2/3 z-30
              sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:h-auto sm:z-auto
              sm:w-60 sm:flex-shrink-0
              bg-black/80 sm:bg-white/5 backdrop-blur-md
              border-t border-white/15 sm:border sm:border-white/10
              rounded-t-2xl sm:rounded-2xl
              p-4 overflow-y-auto
            ">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white/70 text-sm font-semibold">Words Learned</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/vocabulary')}
                    className="text-amber-400/70 hover:text-amber-300 text-xs transition-colors"
                  >
                    All words →
                  </button>
                  <button
                    onClick={() => setShowVocab(false)}
                    className="sm:hidden text-white/40 hover:text-white text-lg leading-none"
                  >×</button>
                </div>
              </div>
              {vocab.length === 0 ? (
                <p className="text-white/30 text-xs">No words yet — start chatting!</p>
              ) : (
                <div className="space-y-3">
                  {vocab.map((word, i) => (
                    <div key={i} className="border-b border-white/10 pb-2">
                      <p className="text-amber-300 text-base">{word.greek}</p>
                      <p className="text-white/40 text-xs">{word.transliteration}</p>
                      <p className="text-white/60 text-xs mt-0.5">{word.meaning}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
