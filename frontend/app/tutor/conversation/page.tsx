'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  VideoTrack,
  useDataChannel,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';

interface LiveKitToken {
  token: string;
  url: string;
  room: string;
}

interface Caption {
  greek: string;
  english: string;
  display_ms?: number;
}

// all available backgrounds — picked randomly at the start of each session
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

export default function TutorPage() {
  const [tokenData, setTokenData] = useState<LiveKitToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  // controls whether captions disappear automatically or stay until the next one. by default set to stay till next
  const [keepCaptions, setKeepCaptions] = useState(true);
  // pick a random background once when the component mounts
  const [background] = useState(
    () => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
  );
  const router = useRouter();

  // fetch a fresh token on load — each token creates a unique room for this session
  useEffect(() => {
    fetch('https://spr26-team-25-production.up.railway.app/api/livekit-token')
    // fetch('http://localhost:8000/api/livekit-token')
      .then(res => res.json())
      .then(data => setTokenData(data))
      .catch(() => setError('Could not connect to the tutor. Please try again.'));
  }, []);

  if (error) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  if (!tokenData) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-stone-500">Connecting to Ειρήνη...</p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* dark overlay so the avatar and captions stay readable over any background */}
      <div className="absolute inset-0 bg-black/40" />

      {/* back button — z-20 so it's always above LiveKit components */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back to chat
      </button>

      {/* subtitle toggle — z-20 so it's always clickable above LiveKit components */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <span className="text-white/70 text-sm">Keep subtitles</span>
        <button
          onClick={() => setKeepCaptions(prev => !prev)}
          className={`w-10 h-6 rounded-full transition-colors duration-200 ${
            keepCaptions ? 'bg-amber-500' : 'bg-white/30'
          }`}
        >
          <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform duration-200 ${
            keepCaptions ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* main content sits above the overlay */}
      <div className="relative z-10 w-full flex flex-col items-center">
        {/* LiveKitRoom manages the WebRTC connection and provides all LiveKit hooks.
            audio=true lets the student speak. video=false skips the student's camera. */}
        <LiveKitRoom
          token={tokenData.token}
          serverUrl={tokenData.url}
          connect={true}
          audio={true}
          video={false}
          className="w-full flex flex-col items-center"
        >
          {/* plays all incoming audio automatically, including Ειρήνη's voice */}
          <RoomAudioRenderer />

          {/* AvatarWithCaptions is a separate component because LiveKit hooks
              only work inside a LiveKitRoom */}
          <AvatarWithCaptions keepCaptions={keepCaptions} />
        </LiveKitRoom>
      </div>
    </main>
  );
}

function AvatarWithCaptions({ keepCaptions }: { keepCaptions: boolean }) {
  const [caption, setCaption] = useState<Caption | null>(null);
  // ref for the active clear timer so we can cancel it when a new caption arrives
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const participants = useParticipants();

  // listens for caption messages from the agent on the "captions" data channel.
  // the agent always sends one complete {greek, english, display_ms} message per response.
  useDataChannel('captions', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.greek) {
        // cancel the previous timer so it doesn't wipe out this new caption
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCaption(data);
        if (!keepCaptions) {
          // auto-hide: clear after display_ms (estimated from word count in agent.py)
          timeoutRef.current = setTimeout(() => setCaption(null), data.display_ms ?? 4000);
        }
        // if keepCaptions is true, the caption stays until the next one replaces it
      }
    } catch {
      // ignore malformed messages
    }
  });

  // Simli publishes the avatar video as a camera track
  const avatarTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg px-4 pt-16">
      <div className="w-full aspect-video bg-black/30 rounded-2xl overflow-hidden relative backdrop-blur-sm">
        {avatarTracks.length > 0 ? (
          // VideoTrack renders the video stream from Simli into this div
          <VideoTrack
            trackRef={avatarTracks[0] as any}
            className="w-full h-full object-cover"
          />
        ) : (
          // shown while the avatar is loading or the agent hasn't joined yet
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white/50 text-sm">Waiting for Ειρήνη...</p>
          </div>
        )}
      </div>

      {/* caption area — same layout as lesson page for visual consistency.
          greek on top (what Eirini said), english below in a blue pill (translation). */}
      <div className="w-full min-h-[90px] flex flex-col items-center justify-center text-center px-6 py-4 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10">
        {caption ? (
          <>
            {/* greek text — what Eirini is saying out loud */}
            <p className="text-white text-xl font-medium leading-snug">{caption.greek}</p>
            {/* english translation — blue pill so it's visually distinct from the greek */}
            {caption.english && (
              <p className="text-white text-xl mt-2 bg-blue-600/50 rounded-full px-3 py-1">
                {caption.english}
              </p>
            )}
          </>
        ) : (
          // shown while the agent is loading or hasn't spoken yet
          <p className="text-white/30 text-sm">Speak to start the lesson</p>
        )}
      </div>
    </div>
  );
}