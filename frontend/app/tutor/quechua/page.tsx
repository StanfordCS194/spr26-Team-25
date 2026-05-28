'use client';

import { useEffect, useState, useRef } from 'react';
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
import { BACKEND_URL } from '@/lib/config';

// shape of the token returned by /api/livekit-token-quechua
interface LiveKitToken { token: string; url: string; room: string; }

// shape of caption messages sent by QuechuaTTS in agent.py
// quechua goes in the top line (amber), english goes below (white)
interface QuechuaCaption {
  quechua?: string;
  english?: string;
  display_ms?: number;
}

// andean/incan themed backgrounds
const BACKGROUNDS = [
  '/backgrounds/machu_picchu_manana.jpg',
  '/backgrounds/machu_picchu_tarde.jpg',
  '/backgrounds/andes_atardecer.jpg',
  '/backgrounds/cusco_plaza.jpg',
];

export default function QuechuaPage() {
  // token from the backend — null until the fetch completes
  const [tokenData, setTokenData] = useState<LiveKitToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  // lock in a random background for the whole session
  const [background] = useState(() => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]);
  const router = useRouter();

  useEffect(() => {
    // get the current user's session so we can pass their ID to the agent
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? '';

      fetch(`${BACKEND_URL}/api/livekit-token-quechua?user_id=${userId}`)
        .then(res => res.json())
        .then(data => setTokenData(data))
        .catch(() => setError('Could not connect to Ñusta. Please try again.'));
    });
  }, []);

  if (error) return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center">
      <p className="text-red-500">{error}</p>
    </main>
  );

  if (!tokenData) return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center">
      <p className="text-stone-500">Connecting to Ñusta...</p>
    </main>
  );

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* dark overlay so the avatar and captions stay readable */}
      <div className="absolute inset-0 bg-black/40" />

      {/* back button always above livekit components */}
      <button
        onClick={() => router.push('/tutor')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back
      </button>

      {/* dictionary button — top right shortcut to browse the full Quechua dictionary */}
      <button
        onClick={() => router.push('/tutor/quechua/dictionary')}
        className="absolute top-4 right-4 z-20 text-white/70 hover:text-white text-sm"
      >
        📖 Dictionary
      </button>

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* LiveKitRoom manages the WebRTC connection.
            audio=true lets the student speak. video=false skips the student's camera. */}
        <LiveKitRoom
          token={tokenData.token}
          serverUrl={tokenData.url}
          connect={true}
          audio={true}
          video={false}
          className="w-full flex flex-col items-center"
        >
          {/* plays Ñusta's audio stream automatically */}
          <RoomAudioRenderer />
          {/* NustaAvatar is a separate component because LiveKit hooks
              only work inside a LiveKitRoom */}
          <NustaAvatar />
        </LiveKitRoom>
      </div>
    </main>
  );
}

function NustaAvatar() {
  const router = useRouter();
  // current caption being displayed — null when nothing is showing
  const [caption, setCaption] = useState<QuechuaCaption | null>(null);
  // ref so we can cancel the auto-hide timer when a new caption arrives
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // listen for caption messages from agent.py on the shared "captions" data channel
  useDataChannel('captions', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      // only update if the message has quechua content (ignore greek/nahuatl messages)
      if (data.quechua || data.english) {
        // cancel the previous hide timer so the old caption doesn't wipe out the new one
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCaption(data);
        // auto-hide disabled — captions stay until Ñusta speaks again
        // timeoutRef.current = setTimeout(() => setCaption(null), data.display_ms ?? 5000);
      }
    } catch { /* ignore malformed messages */ }
  });

  // Simli streams the avatar video as a camera track
  const avatarTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );

  // split the quechua caption into individual clickable words.
  // clicking a word navigates to its dictionary page.
  function renderQuechuaWords(text: string) {
    return text.split(/\s+/).map((word, i) => {
      // strip punctuation from the lookup key so "Allillanchu!" finds "allillanchu"
      const lookup = word.replace(/[^a-záéíóúñü]/gi, '').toLowerCase();
      return (
        <span
          key={i}
          onClick={() => router.push(`/tutor/quechua/dictionary/${encodeURIComponent(lookup)}`)}
          className="cursor-pointer hover:text-amber-200 transition-colors"
          title="See in dictionary"
        >
          {word}{' '}
        </span>
      );
    });
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg px-4 pt-16">

      {/* avatar video window */}
      <div className="w-full aspect-video bg-black/30 rounded-2xl overflow-hidden backdrop-blur-sm">
        {avatarTracks.length > 0 ? (
          // render Simli's video stream once it arrives
          <VideoTrack trackRef={avatarTracks[0] as any} className="w-full h-full object-cover" />
        ) : (
          // placeholder while the avatar is loading
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <p className="text-white/50 text-sm">Waiting for Ñusta...</p>
            <p className="text-white/30 text-xs">Quechua tutor — language of the Incas</p>
          </div>
        )}
      </div>

      {/* caption box. instruction always visible, quechua + english when Ñusta speaks */}
      <div className="w-full min-h-[110px] flex flex-col items-center justify-center text-center px-4 py-4 rounded-xl bg-black/40 backdrop-blur-sm gap-1">
        {/* always shown so the user knows what to do */}
        <p className="text-white/40 text-sm mb-2">
          Speak freely — Ñusta will respond in Quechua, the language of the Incas.
        </p>
        {caption && (
          <>
            {/* quechua text. each word is clickable to open the dictionary */}
            {caption.quechua && (
              <p className="text-amber-300 text-2xl font-bold leading-snug">
                {renderQuechuaWords(caption.quechua)}
              </p>
            )}
            {/* english translation below in white */}
            {caption.english && (
              <p className="text-white text-base mt-2">{caption.english}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}