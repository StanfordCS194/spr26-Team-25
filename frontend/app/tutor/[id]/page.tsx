'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useDataChannel,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { loadPack } from '@/lib/language-pack/loader';
import type { LanguagePack } from '@/lib/language-pack/types';
import { supabase } from '@/lib/supabase';
import { BACKEND_URL } from '@/lib/config';

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

// Maps pack id → the existing LiveKit token endpoint that dispatches the right
// agent mode. Packs not in this map can't be launched yet (e.g. Ojibwe has no
// backend agent). Once agent.py is pack-aware, this whole table collapses to a
// single endpoint that takes pack_id.
const PACK_TO_TOKEN_ENDPOINT: Record<string, string> = {
  'ancient-greek': '/api/livekit-token',
  'classical-nahuatl': '/api/livekit-token-nahuatl',
  quechua: '/api/livekit-token-quechua',
  'old-norse': '/api/livekit-token-old-norse',
};

interface LiveKitToken {
  token: string;
  url: string;
  room: string;
}

// Captions arrive with different target-text field names per language. We read
// whichever field is present so the same component renders all of them.
interface AdaptiveCaption {
  greek?: string;
  nahuatl_word?: string;
  quechua?: string;
  norse?: string;
  english?: string;
  display_ms?: number;
}

function captionTarget(c: AdaptiveCaption): string | undefined {
  return c.greek ?? c.nahuatl_word ?? c.quechua ?? c.norse;
}

function StatusBadge({ status }: { status: LanguagePack['status'] }) {
  const tone =
    status === 'vibrant'
      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
      : status === 'endangered'
        ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
        : status === 'dormant'
          ? 'bg-stone-500/20 text-stone-200 border-stone-400/40'
          : 'bg-violet-500/20 text-violet-200 border-violet-400/40';
  return (
    <span
      className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${tone}`}
    >
      {status}
    </span>
  );
}

export default function GenericTutorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [pack, setPack] = useState<LanguagePack | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<LiveKitToken | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [keepCaptions, setKeepCaptions] = useState(true);
  const [background] = useState(
    () => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)],
  );

  const tokenEndpoint = PACK_TO_TOKEN_ENDPOINT[id];
  const hasVoiceBackend = Boolean(tokenEndpoint);

  useEffect(() => {
    let cancelled = false;
    loadPack(`/api/packs/${id}`)
      .then((p) => {
        if (!cancelled) setPack(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPackError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!pack || !hasVoiceBackend) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? '';
      fetch(`${BACKEND_URL}${tokenEndpoint}?user_id=${userId}`)
        .then((res) => res.json())
        .then((data: LiveKitToken) => {
          if (!cancelled) setTokenData(data);
        })
        .catch(() => {
          if (!cancelled) setTokenError('Could not connect to the tutor. Please try again.');
        });
    });
    return () => {
      cancelled = true;
    };
  }, [pack, hasVoiceBackend, tokenEndpoint]);

  if (packError) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-500">Could not load language pack: {packError}</p>
          <button
            onClick={() => router.push('/tutor')}
            className="mt-4 text-stone-500 underline"
          >
            Back to catalog
          </button>
        </div>
      </main>
    );
  }

  if (!pack) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-stone-500">Loading pack…</p>
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
      <div className="absolute inset-0 bg-black/50" />

      <button
        onClick={() => router.push('/tutor')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back to catalog
      </button>

      {hasVoiceBackend && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <span className="text-white/70 text-sm">Keep subtitles</span>
          <button
            onClick={() => setKeepCaptions((prev) => !prev)}
            className={`w-10 h-6 rounded-full transition-colors duration-200 ${
              keepCaptions ? 'bg-amber-500' : 'bg-white/30'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform duration-200 ${
                keepCaptions ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      <div className="relative z-10 w-full flex flex-col items-center px-4 py-12 max-w-lg">
        <header className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-white text-2xl font-semibold">{pack.tutor.name}</h1>
            <StatusBadge status={pack.status} />
          </div>
          <p className="text-white/70 text-sm">
            {pack.displayName}
            {pack.displayNameLocal && (
              <span className="text-white/40"> · {pack.displayNameLocal}</span>
            )}
          </p>
          <p className="text-white/50 text-xs mt-2 max-w-md mx-auto leading-relaxed">
            {pack.tutor.personaShort}
          </p>
        </header>

        {!hasVoiceBackend ? (
          <ComingSoon pack={pack} />
        ) : tokenError ? (
          <p className="text-red-300 text-sm">{tokenError}</p>
        ) : !tokenData ? (
          <p className="text-white/60 text-sm">Connecting to {pack.tutor.name}…</p>
        ) : (
          <LiveKitRoom
            token={tokenData.token}
            serverUrl={tokenData.url}
            connect={true}
            audio={true}
            video={false}
            className="w-full flex flex-col items-center"
          >
            <RoomAudioRenderer />
            <AvatarAndCaptions
              tutorName={pack.tutor.name}
              keepCaptions={keepCaptions}
            />
          </LiveKitRoom>
        )}

        {(pack.status === 'endangered' ||
          pack.status === 'dormant' ||
          pack.status === 'reconstructed') &&
          pack.sovereignty?.communityPartnership && (
            <details className="w-full mt-6 text-white/60 text-xs">
              <summary className="cursor-pointer hover:text-white/80">
                About this language
              </summary>
              <p className="mt-2 leading-relaxed border-l-2 border-white/20 pl-3">
                {pack.sovereignty.communityPartnership}
              </p>
              {pack.sovereignty.attribution && (
                <p className="mt-2 text-white/40">
                  Attribution: {pack.sovereignty.attribution} · License:{' '}
                  {pack.sovereignty.license}
                </p>
              )}
            </details>
          )}
      </div>
    </main>
  );
}

function ComingSoon({ pack }: { pack: LanguagePack }) {
  return (
    <div className="w-full bg-black/50 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-8 text-center">
      <p className="text-white text-lg font-medium">Voice tutor coming soon.</p>
      <p className="text-white/60 text-sm mt-2">
        The {pack.displayName} pack is loaded and ready, but we haven&apos;t wired{' '}
        {pack.tutor.name} into the agent yet.
      </p>
    </div>
  );
}

function AvatarAndCaptions({
  tutorName,
  keepCaptions,
}: {
  tutorName: string;
  keepCaptions: boolean;
}) {
  const [caption, setCaption] = useState<AdaptiveCaption | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDataChannel('captions', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as AdaptiveCaption;
      if (!captionTarget(data)) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCaption(data);
      if (!keepCaptions) {
        timeoutRef.current = setTimeout(() => setCaption(null), data.display_ms ?? 4000);
      }
    } catch {
      // ignore malformed messages
    }
  });

  const avatarTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true },
  );

  const target = caption ? captionTarget(caption) : undefined;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="w-full aspect-video bg-black/30 rounded-2xl overflow-hidden relative backdrop-blur-sm">
        {avatarTracks.length > 0 ? (
          <VideoTrack
            trackRef={avatarTracks[0] as never}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white/50 text-sm">Waiting for {tutorName}…</p>
          </div>
        )}
      </div>

      <div className="w-full min-h-[90px] flex flex-col items-center justify-center text-center px-6 py-4 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10">
        {target ? (
          <>
            <p className="text-white text-xl font-medium leading-snug">{target}</p>
            {caption?.english && (
              <p className="text-white text-base mt-2 bg-blue-600/50 rounded-full px-3 py-1">
                {caption.english}
              </p>
            )}
          </>
        ) : (
          <p className="text-white/30 text-sm">Speak to start the conversation</p>
        )}
      </div>

      <p className="text-white/30 text-xs">🎙 Speak or ask a question to continue</p>
    </div>
  );
}
