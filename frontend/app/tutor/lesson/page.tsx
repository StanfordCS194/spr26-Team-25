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

// the 24 letters of the Ancient Greek alphabet in the classical teaching order.
// each card in the grid shows the uppercase letter, its name, and its sound.
// this is a static reference — it doesn't change as the lesson progresses.
const ALPHABET = [
  { upper: 'Α', lower: 'α', name: 'Alpha',   sound: 'ah' },
  { upper: 'Β', lower: 'β', name: 'Beta',    sound: 'b' },
  { upper: 'Γ', lower: 'γ', name: 'Gamma',   sound: 'g' },
  { upper: 'Δ', lower: 'δ', name: 'Delta',   sound: 'd' },
  { upper: 'Ε', lower: 'ε', name: 'Epsilon', sound: 'eh' },
  { upper: 'Ζ', lower: 'ζ', name: 'Zeta',    sound: 'zd' },
  { upper: 'Η', lower: 'η', name: 'Eta',     sound: 'ay' },
  { upper: 'Θ', lower: 'θ', name: 'Theta',   sound: 'th' },
  { upper: 'Ι', lower: 'ι', name: 'Iota',    sound: 'ee' },
  { upper: 'Κ', lower: 'κ', name: 'Kappa',   sound: 'k' },
  { upper: 'Λ', lower: 'λ', name: 'Lambda',  sound: 'l' },
  { upper: 'Μ', lower: 'μ', name: 'Mu',      sound: 'm' },
  { upper: 'Ν', lower: 'ν', name: 'Nu',      sound: 'n' },
  { upper: 'Ξ', lower: 'ξ', name: 'Xi',      sound: 'ks' },
  { upper: 'Ο', lower: 'ο', name: 'Omicron', sound: 'oh' },
  { upper: 'Π', lower: 'π', name: 'Pi',      sound: 'p' },
  { upper: 'Ρ', lower: 'ρ', name: 'Rho',     sound: 'r' },
  { upper: 'Σ', lower: 'σ', name: 'Sigma',   sound: 's' },
  { upper: 'Τ', lower: 'τ', name: 'Tau',     sound: 't' },
  { upper: 'Υ', lower: 'υ', name: 'Upsilon', sound: 'ü' },
  { upper: 'Φ', lower: 'φ', name: 'Phi',     sound: 'ph' },
  { upper: 'Χ', lower: 'χ', name: 'Chi',     sound: 'kh' },
  { upper: 'Ψ', lower: 'ψ', name: 'Psi',     sound: 'ps' },
  { upper: 'Ω', lower: 'ω', name: 'Omega',   sound: 'oh·' },
];

// a subset of the same backgrounds used in conversation. lesson picks one randomly
// so each session feels visually fresh without needing to add new images
const BACKGROUNDS = [
  '/backgrounds/atardecer_palacio.jpg',
  '/backgrounds/biblioteca_alejandria.jpg',
  '/backgrounds/ruinas_noche_realista.jpg',
  '/backgrounds/atardecer_ruinas_realistas.jpg',
];

export default function LessonPage() {
  const [tokenData, setTokenData] = useState<LiveKitToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  // keepCaptions defaults to true for lessons because students need time to
  // read the Greek letter name and sound before Eirini moves on
  const [keepCaptions, setKeepCaptions] = useState(true);
  // pick a random background once when the component mounts. same pattern as
  // conversation/page.tsx so the two pages feel like part of the same app
  const [background] = useState(
    () => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
  );
  const router = useRouter();

  useEffect(() => {
    // /api/livekit-token-lesson dispatches eirini-lesson (LESSON_SYSTEM_PROMPT)
    // instead of eirini (SYSTEM_PROMPT), so the agent follows the alphabet curriculum
    // fetch('https://spr26-team-25-production.up.railway.app/api/livekit-token-lesson')
    fetch('http://localhost:8000/api/livekit-token-lesson')
      .then(res => res.json())
      .then(data => setTokenData(data))
      .catch(() => setError('Could not connect to the tutor. Please try again.'));
  }, []);

  // token fetch failed so show the error message and stop rendering
  if (error) {
    return (
      <main className="min-h-screen bg-stone-900 flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  // token not yet received so show a loading state while the fetch is completed
  if (!tokenData) {
    return (
      <main className="min-h-screen bg-stone-900 flex items-center justify-center">
        <p className="text-amber-200/60">Connecting to Irini...</p>
      </main>
    );
  }

  // the token is ready so render the full lesson page with the background image
  return (
    <main
      className="min-h-screen flex flex-col items-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* dark overlay so text stays readable over any background image */}
      <div className="absolute inset-0 bg-black/60" />

      {/* back button. z-20 so it always sits above LiveKit components */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 z-20 text-white/60 hover:text-white text-sm"
      >
        ← Back
      </button>

      {/* lesson title. centered at the top so the student always knows the topic */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center">
        <p className="text-amber-300/80 text-xs tracking-widest uppercase">Lesson 1</p>
        <p className="text-white/80 text-sm font-medium">The Greek Alphabet</p>
      </div>

      {/* keep-captions toggle. same as conversation page */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <span className="text-white/60 text-sm">Keep subtitles</span>
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
      <div className="relative z-10 w-full flex flex-col items-center px-4 pt-16 pb-8 gap-6">
        {/* LiveKitRoom manages the WebRTC connection.
            audio=true lets the student speak. video=false skips the camera. */}
        <LiveKitRoom
          token={tokenData.token}
          serverUrl={tokenData.url}
          connect={true}
          audio={true}
          video={false}
          className="w-full flex flex-col items-center gap-6"
        >
          {/* plays Irini's voice automatically */}
          <RoomAudioRenderer />

          {/* LessonContent is a separate component because LiveKit hooks
              (useDataChannel) only work inside a LiveKitRoom */}
          <LessonContent keepCaptions={keepCaptions} />
        </LiveKitRoom>
      </div>
    </main>
  );
}

function LessonContent({ keepCaptions }: { keepCaptions: boolean }) {
  const room = useRoomContext();
  const [canContinue, setCanContinue] = useState(false);
  const [caption, setCaption] = useState<Caption | null>(null);
  // ref for the active clear timer so we can cancel it when a new caption arrives
  // without this, a fast second response would clear the first caption too early
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // listens on the "captions" data channel — same topic the agent publishes to.
  // each message is one complete {greek, english, display_ms} JSON object,
  // matching exactly what CaptionisingGoogleTTS._send_caption() publishes.
  useDataChannel('captions', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.greek) {
        // cancel the previous timer so it doesn't wipe out the new caption
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCaption(data);
        setCanContinue(true); // show Continue button once caption arrives
        if (!keepCaptions) {
          // auto-hide after display_ms (estimated by the agent from word count)
          timeoutRef.current = setTimeout(
            () => setCaption(null),
            data.display_ms ?? 5000
          );
        }
        // if keepCaptions is true, the caption stays until the next one replaces it
      }
    } catch {
      // ignore malformed or non-caption data messages
    }
  });

  // publishes "student_ready" to the room so the agent calls generate_reply()
  const handleContinue = useCallback(() => {
    setCanContinue(false);
    const data = new TextEncoder().encode(
      JSON.stringify({ type: "student_ready" })
    );
    room.localParticipant.publishData(data, { reliable: true, topic: "lesson-control" });
  }, [room]);

  // spacebar shortcut. only active when the Continue button is visible
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && canContinue) {
        e.preventDefault();
        handleContinue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleContinue, canContinue]);

  return (
    <>
      {/* alphabet reference grid. always visible so the student can follow along
          as Irini names each letter. 6 columns fits all 24 letters in 4 rows. */}
      <div className="w-full max-w-2xl">
        <div className="grid grid-cols-6 gap-2">
          {ALPHABET.map((letter) => (
            <div
              key={letter.name}
              className="flex flex-col items-center justify-center bg-white/10 backdrop-blur-sm rounded-xl py-3 px-1 border border-white/10"
            >
              {/* uppercase letter. large and amber so it stands out */}
              <span className="text-amber-200 text-2xl font-serif leading-none">
                {letter.upper}
              </span>
              {/* letter name. small so the grid stays compact */}
              <span className="text-white/50 text-xs mt-1">{letter.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* caption area, same layout as conversation page so the UX feels consistent.
          shows Greek on top (what Irini said) and English below (translation). */}
      <div className="w-full max-w-2xl min-h-[90px] flex flex-col items-center justify-center text-center px-6 py-4 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10">
        {caption ? (
          <>
            <p className="text-white text-xl font-medium leading-snug">
              {caption.greek}
            </p>
            {caption.english && (
            //   <p className="text-white/70 text-base mt-1">
            <p className="text-white text-xl mt-2 bg-blue-600/50 rounded-full px-3 py-1">
                {caption.english}
              </p>
            )}
          </>
        ) : (
          // shown while the agent is loading or hasn't spoken yet
          <p className="text-white/30 text-sm">
            Irini will begin speaking shortly...
          </p>
        )}
      </div>

      {/* Continue button appears after each caption so the student controls
          the pace. Spacebar also works as a shortcut. */}
      {canContinue && (
        <button
          onClick={handleContinue}
          className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white text-sm transition-colors"
        >
          Continue <span className="text-white/40 text-xs ml-2">Space</span>
        </button>
      )}

      {/* mic hint to remind the student that the session is voice-interactive */}
      <p className="text-white/30 text-xs">
        🎙 You can also speak to respond
      </p>
    </>
  );
}