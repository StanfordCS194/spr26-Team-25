'use client';

import WordInfoPanel from '@/components/WordInfoPanel';
import AvatarCircle from '@/components/AvatarCircle';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
  useDataChannel,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { supabase } from '@/lib/supabase';
import { loadStoredAvatar } from '@/lib/avatars';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';
// LiveKit token generation requires Railway (agent + credentials live there)
const LIVEKIT_BACKEND = process.env.NEXT_PUBLIC_LIVEKIT_BACKEND_URL ?? BACKEND;

interface LiveKitToken { token: string; url: string; room: string; }
interface Caption { greek: string; english: string; display_ms?: number; }

const BACKGROUNDS = [
  '/backgrounds/atardecer_palacio.jpg',
  '/backgrounds/atardecer_ruinas_realistas.jpg',
  '/backgrounds/bg3.jpg',
  '/backgrounds/bg4.jpg',
  '/backgrounds/biblioteca_alejandria.jpg',
  '/backgrounds/calle_jerusalen_dia.jpg',
  '/backgrounds/lindo_mar.jpg',
  '/backgrounds/mercado_dia_realista.jpg',
  '/backgrounds/ruinas_noche_realista.jpg',
];

function formatDuration(start: Date): string {
  const secs = Math.floor((Date.now() - start.getTime()) / 1000);
  const mins = Math.floor(secs / 60);
  return mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
}

export default function TutorPage() {
  const [tokenData, setTokenData] = useState<LiveKitToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keepCaptions, setKeepCaptions] = useState(true);
  const [background] = useState(() => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionDuration, setSessionDuration] = useState('');
  const [captionCount, setCaptionCount] = useState(0);
  const sessionEndedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? '';
      fetch(`${LIVEKIT_BACKEND}/api/livekit-token?user_id=${userId}`)
        .then(r => r.json())
        .then(data => setTokenData(data))
        .catch(() => setError('Could not connect to the tutor. Please try again.'));
    });
  }, []);

  const endSession = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSessionDuration(sessionStartTime ? formatDuration(sessionStartTime) : '');
    setSessionEnded(true);
  }, [sessionStartTime]);

  // ── loading ──────────────────────────────────────────────────────────────
  if (!tokenData && !error) {
    const loadingAvatar = loadStoredAvatar();
    return (
      <main className="min-h-screen relative flex flex-col items-center justify-center"
        style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/65" />
        <button onClick={() => router.push('/tutor')} className="absolute top-5 left-5 z-20 text-white/50 hover:text-white text-sm transition-colors">← Back</button>
        <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
          <AvatarCircle avatar={loadingAvatar} size="xl" />
          <div>
            <h2 className="text-white text-xl font-semibold">{loadingAvatar.name}</h2>
            <p className="text-white/50 text-sm mt-1">Ancient Greek Tutor · Free Conversation</p>
          </div>
          <div className="flex gap-2 mt-1">
            {[0, 150, 300].map(d => (
              <div key={d} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <p className="text-white/30 text-xs">Connecting to your session...</p>
        </div>
      </main>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <main className="min-h-screen relative flex flex-col items-center justify-center"
      style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 text-center px-6 space-y-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.push('/tutor')} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm px-5 py-2.5 rounded-xl transition-all">← Return to Menu</button>
      </div>
    </main>
  );

  // ── session end ───────────────────────────────────────────────────────────
  if (sessionEnded) return (
    <main className="min-h-screen relative flex flex-col items-center justify-center"
      style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6 max-w-xs w-full">
        <div className="w-14 h-14 rounded-full bg-amber-700/40 border border-amber-400/30 flex items-center justify-center text-2xl">✓</div>
        <div>
          <h2 className="text-white text-2xl font-semibold">Session Complete</h2>
          <div className="flex items-center gap-6 justify-center mt-3">
            {sessionDuration && (
              <div><p className="text-amber-300 text-lg font-medium">{sessionDuration}</p><p className="text-white/40 text-xs">duration</p></div>
            )}
            {captionCount > 0 && (
              <div><p className="text-amber-300 text-lg font-medium">{captionCount}</p><p className="text-white/40 text-xs">exchanges</p></div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          <button onClick={() => router.push('/vocabulary')} className="bg-amber-700 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-medium transition-all">Review Words</button>
          <button onClick={() => router.push('/tutor')} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3 rounded-xl text-sm transition-all">Back to Menu</button>
        </div>
      </div>
    </main>
  );

  // ── active session ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative"
      style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/40" />

      <button onClick={endSession} className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm transition-colors">
        ← End Session
      </button>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <span className="text-white/60 text-sm hidden sm:inline">Keep subtitles</span>
        <button
          onClick={() => setKeepCaptions(p => !p)}
          className={`w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${keepCaptions ? 'bg-amber-500' : 'bg-white/30'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform duration-200 ${keepCaptions ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        <LiveKitRoom
          token={tokenData!.token}
          serverUrl={tokenData!.url}
          connect={true}
          audio={true}
          video={false}
          className="w-full flex flex-col items-center"
          onConnected={() => setSessionStartTime(new Date())}
          onDisconnected={endSession}
        >
          <RoomAudioRenderer />
          <AvatarWithCaptions
            keepCaptions={keepCaptions}
            backendUrl={BACKEND}
            onCaption={() => setCaptionCount(c => c + 1)}
          />
        </LiveKitRoom>
      </div>
    </main>
  );
}

function AvatarWithCaptions({ keepCaptions, backendUrl, onCaption }: {
  keepCaptions: boolean;
  backendUrl: string;
  onCaption: () => void;
}) {
  const [caption, setCaption] = useState<Caption | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [glossary, setGlossary] = useState<Record<string, string>>({});
  const [glossaryLoading, setGlossaryLoading] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const fetchGlossary = useCallback(async (greekText: string) => {
    setGlossaryLoading(true);
    setGlossary({});
    try {
      const res = await fetch(`${backendUrl}/api/word-glossary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ greek_text: greekText }),
      });
      const data = await res.json();
      setGlossary(data.glossary ?? {});
    } catch {} finally {
      setGlossaryLoading(false);
    }
  }, [backendUrl]);

  useDataChannel('captions', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.greek) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCaption(data);
        setHoveredKey(null);
        fetchGlossary(data.greek);
        onCaption();
        if (!keepCaptions) {
          timeoutRef.current = setTimeout(() => setCaption(null), data.display_ms ?? 4000);
        }
      }
    } catch {}
  });

  const avatarTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );

  function tokenizeGreek(text: string) {
    return text.split(/(\s+)/).filter(Boolean).map((part, i) => ({
      isSpace: /^\s+$/.test(part),
      display: part,
      word: part.replace(/[.,;·!?:'"«»]+/g, ''),
      key: `${part}-${i}`,
    }));
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg px-4 pt-14">
      <div className="w-full aspect-video bg-black/30 rounded-2xl overflow-hidden backdrop-blur-sm">
        {avatarTracks.length > 0 ? (
          <VideoTrack trackRef={avatarTracks[0] as any} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <img src="/greek-tutor-female.jpg" alt="Ειρήνη" className="w-14 h-14 rounded-full object-cover opacity-60" />
            <p className="text-white/40 text-sm">Waiting for Ειρήνη...</p>
          </div>
        )}
      </div>

      <div className="w-full min-h-[90px] flex flex-col items-center justify-center text-center px-4 sm:px-6 py-4 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10">
        {caption ? (
          <>
            <p className="text-white text-xl font-medium leading-snug" style={{ userSelect: 'none' }}>
              {tokenizeGreek(caption.greek).map(token => {
                if (token.isSpace) return <span key={token.key}> </span>;
                const isHovered = hoveredKey === token.key;
                return (
                  <span key={token.key} style={{ position: 'relative', display: 'inline-block' }}
                    onMouseEnter={() => setHoveredKey(token.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => setSelectedWord(token.word)}>
                    <span style={{ color: isHovered ? '#FFD700' : 'white', cursor: 'pointer', borderBottom: isHovered ? '1px solid #FFD700' : '1px solid transparent', transition: 'color 0.15s', padding: '0 1px' }}>
                      {token.display}
                    </span>
                    {isHovered && (
                      <span style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,10,5,0.95)', border: '1px solid #8B6914', borderRadius: '6px', padding: '6px 11px', whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#F5E6C8', zIndex: 20, pointerEvents: 'none', lineHeight: 1.5 }}>
                        {glossaryLoading ? '...' : glossary[token.word] ?? '—'}
                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#8B6914', marginTop: '2px' }}>click to explore</span>
                      </span>
                    )}
                  </span>
                );
              })}
            </p>
            {caption.english && (
              <p className="text-white text-base sm:text-xl mt-2 bg-blue-600/50 rounded-full px-3 py-1">{caption.english}</p>
            )}
          </>
        ) : (
          <p className="text-white/30 text-sm">Speak to start the conversation</p>
        )}
      </div>

      <p className="text-white/30 text-xs">🎙 Speak or ask a question to continue</p>

      {selectedWord && (
        <WordInfoPanel word={selectedWord} onClose={() => setSelectedWord(null)} backendUrl={backendUrl} />
      )}
    </div>
  );
}
