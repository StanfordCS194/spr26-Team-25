import Link from 'next/link';
import { listPacks } from '@/lib/language-pack/registry';
import { readPackFromDisk } from '@/lib/language-pack/serverLoader';
import type { LanguagePack, LanguageStatus } from '@/lib/language-pack/types';

// Auxiliary modes (lessons, dictionaries) that aren't expressed in the pack
// itself yet. Keyed by pack id. When the schema grows a `extras` block these
// move into the pack JSON; for now this table is small and tracked here.
const EXTRAS_BY_PACK: Record<
  string,
  { emoji: string; title: string; description: string; href: string }[]
> = {
  'ancient-greek': [
    {
      emoji: '📖',
      title: 'Structured alphabet lesson',
      description: 'Step through the 24 letters with Ειρήνη, one at a time.',
      href: '/tutor/lesson/intro',
    },
    {
      emoji: '📚',
      title: 'Greek dictionary',
      description: 'Look up any word — conjugations, examples, etymology.',
      href: '/dictionary',
    },
  ],
  quechua: [
    {
      emoji: '🏔️',
      title: 'Quechua dictionary',
      description: 'Browse 3,998 words from Classical Quechua.',
      href: '/tutor/quechua/dictionary',
    },
  ],
  'old-norse': [
    {
      emoji: '🗡️',
      title: 'Old Norse dictionary',
      description: 'Eddic vocabulary with declension, examples, and word families.',
      href: '/tutor/old-norse/dictionary',
    },
  ],
};

// Per-status emoji used as the section flag. Cheaper than a per-pack icon
// field and gives the catalog a consistent visual rhythm.
const STATUS_FLAG: Record<LanguageStatus, string> = {
  vibrant: '🏛️',
  endangered: '🌿',
  dormant: '🗡️',
  reconstructed: '✨',
};

const STATUS_TONE: Record<LanguageStatus, string> = {
  vibrant: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  endangered: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  dormant: 'bg-stone-500/20 text-stone-200 border-stone-400/40',
  reconstructed: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
};

async function loadAllPacks(): Promise<LanguagePack[]> {
  const metas = listPacks();
  const results = await Promise.allSettled(
    metas.map((m) => readPackFromDisk(m.id)),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

export default async function TutorCatalogPage() {
  const packs = await loadAllPacks();
  const background = '/backgrounds/bg4.jpg';

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

      <Link
        href="/"
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back to chat
      </Link>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 py-12 text-center w-full max-w-lg">
        <div>
          <h1 className="text-white text-3xl font-semibold tracking-wide">Χρόνος</h1>
          <p className="text-white/60 text-sm mt-1">How would you like to learn today?</p>
        </div>

        <Link
          href="/tutorial"
          className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
        >
          <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
            📘 Tutorial
          </p>
          <p className="text-white/50 text-sm mt-1">
            Learn how to talk with your tutor and explore the dictionary
          </p>
        </Link>

        <div className="flex flex-col gap-6 w-full">
          {packs.map((pack) => (
            <PackSection key={pack.id} pack={pack} />
          ))}
        </div>

        <p className="text-white/30 text-xs max-w-xs leading-relaxed">
          Each tutor is defined by a language pack. To add your own, drop a JSON
          file in <code className="text-white/50">packs/</code>.
        </p>
      </div>
    </main>
  );
}

function PackSection({ pack }: { pack: LanguagePack }) {
  const extras = EXTRAS_BY_PACK[pack.id] ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-base">{STATUS_FLAG[pack.status]}</span>
        <span className="text-white/40 text-xs font-semibold tracking-widest uppercase">
          {pack.displayName}
        </span>
        {pack.displayNameLocal && (
          <span className="text-white/30 text-xs italic">
            {pack.displayNameLocal}
          </span>
        )}
        <span
          className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${STATUS_TONE[pack.status]}`}
        >
          {pack.status}
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <Link
        href={`/tutor/${pack.id}`}
        className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
      >
        <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
          🗣️ Speak with {pack.tutor.name}
        </p>
        <p className="text-white/50 text-sm mt-1 line-clamp-2">
          {pack.tutor.personaShort}
        </p>
      </Link>

      {extras.map((mode) => (
        <Link
          key={mode.href}
          href={mode.href}
          className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 text-left transition-all duration-200 group"
        >
          <p className="text-white text-lg font-medium group-hover:text-amber-300 transition-colors">
            {mode.emoji} {mode.title}
          </p>
          <p className="text-white/50 text-sm mt-1">{mode.description}</p>
        </Link>
      ))}
    </div>
  );
}
