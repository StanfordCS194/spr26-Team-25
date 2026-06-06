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

// shape of the token returned by /api/livekit-token-old-norse
interface LiveKitToken { token: string; url: string; room: string; }

// shape of caption messages sent by OldNorseTTS in agent.py
// old norse goes in the top line (amber), english goes below (white)
interface NorseCaption {
  norse?: string;
  english?: string;
  display_ms?: number;
}

// use existing backgrounds until norse-themed ones are added
const BACKGROUNDS = [
  '/backgrounds/bg3.jpg',
  '/backgrounds/bg4.jpg',
  '/backgrounds/ruinas_noche_realista.jpg',
];

export default function OldNorsePage() {
  // token from the backend, null until the fetch completes
  const [tokenData, setTokenData] = useState<LiveKitToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  // lock in a random background for the whole session
  const [background] = useState(() => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]);
  const router = useRouter();

  useEffect(() => {
    // get the current user's session so we can pass their ID to the agent
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? '';

      fetch(`${BACKEND_URL}/api/livekit-token-old-norse?user_id=${userId}`)
        .then(res => res.json())
        .then(data => setTokenData(data))
        .catch(() => setError('Could not connect to Sigríðr. Please try again.'));
    });
  }, []);

  if (error) return (
    <main className="min-h-screen bg-stone-900 flex items-center justify-center">
      <p className="text-red-500">{error}</p>
    </main>
  );

  if (!tokenData) return (
    <main className="min-h-screen bg-stone-900 flex items-center justify-center">
      <p className="text-stone-400">Connecting to Sigríðr...</p>
    </main>
  );

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* dark overlay so the avatar and captions stay readable */}
      <div className="absolute inset-0 bg-black/50" />

      {/* back button always above livekit components */}
      <button
        onClick={() => router.push('/tutor')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back
      </button>

      {/* dictionary shortcut */}
      <button
        onClick={() => router.push('/tutor/old-norse/dictionary')}
        className="absolute top-4 right-4 z-20 text-white/70 hover:text-white text-sm"
      >
        📖 Dictionary
      </button>

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* LiveKitRoom manages the WebRTC connection */}
        <LiveKitRoom
          token={tokenData.token}
          serverUrl={tokenData.url}
          connect={true}
          audio={true}
          video={false}
          className="w-full flex flex-col items-center"
        >
          {/* plays Sigridr's audio stream automatically */}
          <RoomAudioRenderer />
          {/* SigridrAvatar is a separate component because LiveKit hooks
              only work inside a LiveKitRoom */}
          <SigridrAvatar />
        </LiveKitRoom>
      </div>
    </main>
  );
}

function SigridrAvatar() {
  const router = useRouter();
  // current caption being displayed, null when nothing is showing
  const [caption, setCaption] = useState<NorseCaption | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // listen for caption messages from agent.py on the shared "captions" data channel
  useDataChannel('captions', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      // only update if the message has norse content
      if (data.norse || data.english) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCaption(data);
      }
    } catch { /* ignore malformed messages */ }
  });

  // Simli streams the avatar video as a camera track
  const avatarTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );

  // split the norse caption into individual clickable words.
  // clicking a word navigates to its dictionary page.
  function renderNorseWords(text: string) {
    return text.split(/\s+/).map((word, i) => {
      // strip punctuation so "dagr!" finds "dagr" in the dictionary
      const lookup = word.replace(/[^a-záéíóúðþæøǫ]/gi, '').toLowerCase();
      return (
        <span
          key={i}
          onClick={() => router.push(`/tutor/old-norse/dictionary/${encodeURIComponent(lookup)}`)}
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
          <VideoTrack trackRef={avatarTracks[0] as any} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <p className="text-white/50 text-sm">Waiting for Sigríðr...</p>
            <p className="text-white/30 text-xs">Old Norse tutor — language of the Vikings</p>
          </div>
        )}
      </div>

      {/* caption box */}
      <div className="w-full min-h-[110px] flex flex-col items-center justify-center text-center px-4 py-4 rounded-xl bg-black/40 backdrop-blur-sm gap-1">
        {/* always shown so the user knows what to do */}
        <p className="text-white/40 text-sm mb-2">
          Speak freely — Sigríðr will respond in Old Norse, the language of the Vikings.
        </p>
        {caption && (
          <>
            {/* old norse text, each word is clickable to open the dictionary */}
            {caption.norse && (
              <p className="text-amber-300 text-2xl font-bold leading-snug">
                {renderNorseWords(caption.norse)}
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