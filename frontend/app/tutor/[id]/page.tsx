'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadPack } from '@/lib/language-pack/loader';
import type { LanguagePack } from '@/lib/language-pack/types';

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
  const [background] = useState(
    () => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)],
  );

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

        <ComingSoon pack={pack} />

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
