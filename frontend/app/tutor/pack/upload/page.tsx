'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadInstructionsPage() {
  const router = useRouter();
  const [packJson, setPackJson] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  // Fetch the reference pack so the user can read or copy it
  useEffect(() => {
    fetch('/packs/ojibwe.json')
      .then(res => res.text())
      .then(setPackJson);
  }, []);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative"
      style={{
        backgroundImage: 'url(/backgrounds/bg4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <button
        onClick={() => router.push('/tutor')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back
      </button>

      <div className="relative z-10 w-full max-w-lg px-6 py-16 flex flex-col gap-6 overflow-y-auto max-h-screen">
        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold">📦 Create a Language Pack</h1>
          <p className="text-white/50 text-sm mt-2">
            A language pack is a single JSON file that defines a tutor, a language, and an optional dictionary.
          </p>
        </div>

        {/* Steps based on packs/README.md */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 text-sm text-white/80 space-y-3">
          <p className="text-white font-medium">How to build your pack</p>
          <ol className="list-decimal list-inside space-y-2 text-white/70">
            <li>Start from <code className="text-white/90">ojibwe.json</code> as your template.</li>
            <li>Edit the identity fields: <code className="text-white/90">id</code>, <code className="text-white/90">displayName</code>, <code className="text-white/90">status</code>, <code className="text-white/90">family</code>, <code className="text-white/90">iso639</code>.</li>
            <li>Set <code className="text-white/90">script.unicodeRanges</code> for your writing system.</li>
            <li>Write your <code className="text-white/90">promptTemplate</code> using the available placeholders.</li>
            <li>For endangered or community-owned languages, set <code className="text-white/90">grounding.policy: "strict"</code> and attach a dictionary.</li>
            <li>Declare a license and attribution under <code className="text-white/90">sovereignty</code>.</li>
          </ol>
          <p className="text-white/40 text-xs pt-1">
            Full reference: <code>packs/README.md</code> and <code>packs/CONTRIBUTING.md</code> in the repo.
          </p>
        </div>

        {/* Download and preview buttons for the reference pack */}
        <div className="flex gap-3">
          
            href="/packs/ojibwe.json"
            download="ojibwe.json"
            className="flex-1 bg-white/20 hover:bg-white/30 text-white px-4 py-3 rounded-xl text-sm transition-colors text-center"
          >
            ⬇️ Download ojibwe.json
          </a>
          <button
            onClick={() => setShowJson(v => !v)}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white/70 px-4 py-3 rounded-xl text-sm transition-colors"
          >
            {showJson ? 'Hide' : '👁 View'} reference
          </button>
        </div>

        {/* Scrollable JSON preview */}
        {showJson && packJson && (
          <pre className="bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white/70 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
            {packJson}
          </pre>
        )}

        <button
          onClick={() => router.push('/tutor/pack/upload/create')}
          className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl text-sm transition-colors text-center"
        >
          I'm ready — upload my pack →
        </button>
      </div>
    </main>
  );
}