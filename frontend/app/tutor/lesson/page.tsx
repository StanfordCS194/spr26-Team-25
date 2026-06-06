'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useDataChannel,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '@/lib/supabase';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';
const LIVEKIT_BACKEND = process.env.NEXT_PUBLIC_LIVEKIT_BACKEND_URL ?? BACKEND;

interface LiveKitToken { token: string; url: string; room: string; }
interface Caption { greek: string; english: string; display_ms?: number; }

const ALPHABET = [
  { upper: 'Α', lower: 'α', name: 'Alpha',   sound: 'ah' },
  { upper: 'Β', lower: 'β', name: 'Beta',    sound: 'b'  },
  { upper: 'Γ', lower: 'γ', name: 'Gamma',   sound: 'g'  },
  { upper: 'Δ', lower: 'δ', name: 'Delta',   sound: 'd'  },
  { upper: 'Ε', lower: 'ε', name: 'Epsilon', sound: 'eh' },
  { upper: 'Ζ', lower: 'ζ', name: 'Zeta',    sound: 'zd' },
  { upper: 'Η', lower: 'η', name: 'Eta',     sound: 'ay' },
  { upper: 'Θ', lower: 'θ', name: 'Theta',   sound: 'th' },
  { upper: 'Ι', lower: 'ι', name: 'Iota',    sound: 'ee' },
  { upper: 'Κ', lower: 'κ', name: 'Kappa',   sound: 'k'  },
  { upper: 'Λ', lower: 'λ', name: 'Lambda',  sound: 'l'  },
  { upper: 'Μ', lower: 'μ', name: 'Mu',      sound: 'm'  },
  { upper: 'Ν', lower: 'ν', name: 'Nu',      sound: 'n'  },
  { upper: 'Ξ', lower: 'ξ', name: 'Xi',      sound: 'ks' },
  { upper: 'Ο', lower: 'ο', name: 'Omicron', sound: 'oh' },
  { upper: 'Π', lower: 'π', name: 'Pi',      sound: 'p'  },
  { upper: 'Ρ', lower: 'ρ', name: 'Rho',     sound: 'r'  },
  { upper: 'Σ', lower: 'σ', name: 'Sigma',   sound: 's'  },
  { upper: 'Τ', lower: 'τ', name: 'Tau',     sound: 't'  },
  { upper: 'Υ', lower: 'υ', name: 'Upsilon', sound: 'ü'  },
  { upper: 'Φ', lower: 'φ', name: 'Phi',     sound: 'ph' },
  { upper: 'Χ', lower: 'χ', name: 'Chi',     sound: 'kh' },
  { upper: 'Ψ', lower: 'ψ', name: 'Psi',     sound: 'ps' },
  { upper: 'Ω', lower: 'ω', name: 'Omega',   sound: 'oh·'},
];

const BACKGROUNDS = [
  '/backgrounds/atardecer_palacio.jpg',
  '/backgrounds/biblioteca_alejandria.jpg',
  '/backgrounds/ruinas_noche_realista.jpg',
  '/backgrounds/atardecer_ruinas_realistas.jpg',
];

function formatDuration(start: Date): string {
  const secs = Math.floor((Date.now() - start.getTime()) / 1000);
  const mins = Math.floor(secs / 60);
  return mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
}

export default function LessonPage() {
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

  // agrega este ref antes del useEffect
  const fetchedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? '';
      fetch(`${LIVEKIT_BACKEND}/api/livekit-token-lesson?user_id=${userId}`)
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
  if (!tokenData && !error) return (
    <main className="min-h-screen relative flex flex-col items-center justify-center"
      style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/65" />
      <button onClick={() => router.push('/tutor')} className="absolute top-5 left-5 z-20 text-white/50 hover:text-white text-sm transition-colors">← Back</button>
      <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
        <div className="w-20 h-20 rounded-full bg-amber-700/30 border border-amber-400/30 flex items-center justify-center">
          <span className="text-amber-200 text-3xl font-serif">Α</span>
        </div>
        <div>
          <p className="text-amber-300/70 text-xs tracking-widest uppercase mb-1">Lesson 1</p>
          <h2 className="text-white text-xl font-semibold">The Greek Alphabet</h2>
          <p className="text-white/50 text-sm mt-1">with Ειρήνη</p>
        </div>
        <div className="flex gap-2 mt-1">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-white/30 text-xs">Connecting to your lesson...</p>
      </div>
    </main>
  );

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
          <h2 className="text-white text-2xl font-semibold">Lesson Complete</h2>
          <div className="flex items-center gap-6 justify-center mt-3">
            {sessionDuration && <div><p className="text-amber-300 text-lg font-medium">{sessionDuration}</p><p className="text-white/40 text-xs">duration</p></div>}
            {captionCount > 0 && <div><p className="text-amber-300 text-lg font-medium">{captionCount}</p><p className="text-white/40 text-xs">letters covered</p></div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          <button onClick={() => router.push('/vocabulary')} className="bg-amber-700 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-medium transition-all">Review Words</button>
          <button onClick={() => router.push('/tutor')} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3 rounded-xl text-sm transition-all">Back to Menu</button>
        </div>
      </div>
    </main>
  );

  // ── active lesson ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center relative overflow-hidden"
      style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/60" />

      <button onClick={endSession} className="absolute top-4 left-4 z-20 text-white/60 hover:text-white text-sm transition-colors">
        ← End Session
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none">
        <p className="text-amber-300/80 text-xs tracking-widest uppercase">Lesson 1</p>
        <p className="text-white/80 text-sm font-medium">The Greek Alphabet</p>
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <span className="text-white/60 text-sm hidden sm:inline">Keep subtitles</span>
        <button
          onClick={() => setKeepCaptions(p => !p)}
          className={`w-10 h-6 rounded-full transition-colors duration-200 ${keepCaptions ? 'bg-amber-500' : 'bg-white/30'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform duration-200 ${keepCaptions ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center px-4 pt-16 pb-8 gap-6">
        <LiveKitRoom
          token={tokenData!.token}
          serverUrl={tokenData!.url}
          connect={true}
          audio={true}
          video={false}
          className="w-full flex flex-col items-center gap-6"
          onConnected={() => setSessionStartTime(new Date())}
          onDisconnected={endSession}
        >
          <RoomAudioRenderer />
          <LessonContent keepCaptions={keepCaptions} onCaption={() => setCaptionCount(c => c + 1)} />
        </LiveKitRoom>
      </div>
    </main>
  );
}

function LessonContent({ keepCaptions, onCaption }: { keepCaptions: boolean; onCaption: () => void }) {
  const room = useRoomContext();
  const [canContinue, setCanContinue] = useState(false);
  const [caption, setCaption] = useState<Caption | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);

  // trigger the first lesson message once the LiveKit room is connected.
  // this replaces the backend-side generate_reply() call so the caption
  // data channel is guaranteed to be ready before the first caption arrives.
  useEffect(() => {
    const startLesson = () => {
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;
        const data = new TextEncoder().encode(
            JSON.stringify({ type: 'student_ready' })
        );
        room.localParticipant.publishData(data, { reliable: true, topic: 'lesson-control' });
    };

    // if room is already connected, start immediately
    // otherwise wait for the Connected event
    if (room.state === 'connected') {
        startLesson();
    } else {
        room.once(RoomEvent.Connected, startLesson);
        return () => { room.off(RoomEvent.Connected, startLesson); };
    }
  }, [room]);

  useDataChannel('captions', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.greek) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCaption(data);
        setCanContinue(true);
        onCaption();
        if (!keepCaptions) {
          timeoutRef.current = setTimeout(() => setCaption(null), data.display_ms ?? 5000);
        }
      }
    } catch {}
  });

  const handleContinue = useCallback(() => {
    setCanContinue(false);
    const data = new TextEncoder().encode(JSON.stringify({ type: 'student_ready' }));
    room.localParticipant.publishData(data, { reliable: true, topic: 'lesson-control' });
  }, [room]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.code === 'Space' && canContinue) { e.preventDefault(); handleContinue(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleContinue, canContinue]);

  return (
    <>
      {/* alphabet grid */}
      <div className="w-full max-w-2xl">
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {ALPHABET.map(letter => (
            <div key={letter.name} className="flex flex-col items-center justify-center bg-white/10 backdrop-blur-sm rounded-xl py-3 px-1 border border-white/10">
              <span className="text-amber-200 text-2xl font-serif leading-none">{letter.upper}</span>
              <span className="text-white/50 text-xs mt-1">{letter.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* caption */}
      <div className="w-full max-w-2xl min-h-[90px] flex flex-col items-center justify-center text-center px-4 sm:px-6 py-4 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10">
        {caption ? (
          <>
            <p className="text-white text-xl font-medium leading-snug">{caption.greek}</p>
            {caption.english && (
              <p className="text-white text-xl mt-2 bg-blue-600/50 rounded-full px-3 py-1">{caption.english}</p>
            )}
          </>
        ) : (
          <p className="text-white/30 text-sm">Ειρήνη will begin speaking shortly...</p>
        )}
      </div>

      {canContinue && (
        <button onClick={handleContinue} className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white text-sm transition-colors">
          Continue <span className="text-white/40 text-xs ml-2">Space</span>
        </button>
      )}

      <p className="text-white/30 text-xs">🎙 You can also speak to respond</p>
    </>
  );
}
