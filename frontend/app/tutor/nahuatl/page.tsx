'use client';

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
import nahuatlData from './nahuatl_colors.json';
import { supabase } from '@/lib/supabase';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';
const LIVEKIT_BACKEND = process.env.NEXT_PUBLIC_LIVEKIT_BACKEND_URL ?? BACKEND;

const ipaLookup: Record<string, string> = {};
for (const [word, data] of Object.entries(nahuatlData.dictionary)) {
  ipaLookup[word] = (data as { ipa: string; translation: string }).ipa;
}

interface LiveKitToken { token: string; url: string; room: string; }
interface NahuatlCaption { nahuatl_word?: string; english?: string; display_ms?: number; }

const BACKGROUNDS = [
  '/backgrounds/atardecer_palacio.jpg',
  '/backgrounds/mercado_dia_realista.jpg',
  '/backgrounds/bg4.jpg',
];

function formatDuration(start: Date): string {
  const secs = Math.floor((Date.now() - start.getTime()) / 1000);
  const mins = Math.floor(secs / 60);
  return mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
}

export default function NahuatlPage() {
  const [tokenData, setTokenData] = useState<LiveKitToken | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      fetch(`${LIVEKIT_BACKEND}/api/livekit-token-nahuatl?user_id=${userId}`)
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
        <div className="w-20 h-20 rounded-full bg-green-700/30 border border-green-400/30 flex items-center justify-center">
          <span className="text-green-200 text-2xl">🌿</span>
        </div>
        <div>
          <h2 className="text-white text-xl font-semibold">Citlali</h2>
          <p className="text-white/50 text-sm mt-1">Classical Nahuatl · Color Vocabulary</p>
        </div>
        <div className="flex gap-2 mt-1">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-white/30 text-xs">Connecting to your session...</p>
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
        <div className="w-14 h-14 rounded-full bg-green-700/40 border border-green-400/30 flex items-center justify-center text-2xl">✓</div>
        <div>
          <h2 className="text-white text-2xl font-semibold">Session Complete</h2>
          <div className="flex items-center gap-6 justify-center mt-3">
            {sessionDuration && <div><p className="text-green-300 text-lg font-medium">{sessionDuration}</p><p className="text-white/40 text-xs">duration</p></div>}
            {captionCount > 0 && <div><p className="text-green-300 text-lg font-medium">{captionCount}</p><p className="text-white/40 text-xs">words heard</p></div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          <button onClick={() => router.push('/vocabulary')} className="bg-green-700 hover:bg-green-600 text-white py-3 rounded-xl text-sm font-medium transition-all">Review Words</button>
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
          <NahuatlAvatar onCaption={() => setCaptionCount(c => c + 1)} />
        </LiveKitRoom>
      </div>
    </main>
  );
}

function NahuatlAvatar({ onCaption }: { onCaption: () => void }) {
  const [caption, setCaption] = useState<NahuatlCaption | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDataChannel('captions', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.english || data.nahuatl_word) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCaption(data);
        onCaption();
        // auto-hide after display_ms — consistent with Greek conversation page
        timeoutRef.current = setTimeout(() => setCaption(null), data.display_ms ?? 5000);
      }
    } catch {}
  });

  const avatarTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );

  const ipa = caption?.nahuatl_word ? ipaLookup[caption.nahuatl_word] : null;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg px-4 pt-14">
      <div className="w-full aspect-video bg-black/30 rounded-2xl overflow-hidden backdrop-blur-sm">
        {avatarTracks.length > 0 ? (
          <VideoTrack trackRef={avatarTracks[0] as any} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <span className="text-4xl">🌿</span>
            <p className="text-white/50 text-sm">Waiting for Citlali...</p>
            <p className="text-white/30 text-xs">Nahuatl color tutor</p>
          </div>
        )}
      </div>

      <div className="w-full min-h-[110px] flex flex-col items-center justify-center text-center px-4 py-4 rounded-xl bg-black/40 backdrop-blur-sm gap-1 border border-white/10">
        <p className="text-white/40 text-sm mb-2">Ask about any color in Nahuatl — the language of the Aztecs!</p>
        {caption && (
          <>
            {caption.nahuatl_word && (
              <div className="flex flex-col items-center">
                <p className="text-amber-300 text-2xl font-bold">{caption.nahuatl_word}</p>
                {ipa && <p className="text-white/40 text-sm font-mono mt-0.5">{ipa}</p>}
              </div>
            )}
            {caption.english && (
              <p className="text-white text-base mt-2">{caption.english}</p>
            )}
          </>
        )}
      </div>

      <p className="text-white/30 text-xs">🎙 Speak to ask about a color</p>
    </div>
  );
}
