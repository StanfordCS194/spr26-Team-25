'use client';

import { useRouter } from 'next/navigation';

export default function PackDocsPage() {
  const router = useRouter();

  return (
    <main
      className="min-h-screen flex flex-col items-center relative"
      style={{
        backgroundImage: 'url(/backgrounds/bg4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <button
        onClick={() => router.push('/tutor/pack/upload')}
        className="absolute top-4 left-4 z-20 text-white/70 hover:text-white text-sm"
      >
        ← Back
      </button>

      <div className="relative z-10 w-full max-w-2xl px-6 py-16 flex flex-col gap-8 overflow-y-auto">

        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold">📖 Language Pack Guide</h1>
          <p className="text-white/50 text-sm mt-2">Everything you need to build your own language pack</p>
        </div>

        {/* Step 1 */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 space-y-2">
          <p className="text-white font-medium">Step 1 — Pick a template</p>
          <p className="text-white/60 text-sm">Start from <code className="text-white/90">ojibwe.json</code> (download it on the previous page). It works for any language — endangered or vibrant. Copy it and rename the file to your language id, for example <code className="text-white/90">lakota.json</code>.</p>
        </div>

        {/* Step 2 */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 space-y-2">
          <p className="text-white font-medium">Step 2 — Identity fields</p>
          <p className="text-white/60 text-sm mb-2">Edit these fields to describe your language:</p>
          <pre className="text-xs text-white/70 bg-black/30 rounded-xl p-3 overflow-x-auto">{`"id": "your-language-id",
"displayName": "Your Language",
"displayNameLocal": "Name in native script",
"status": "vibrant" | "endangered" | "dormant",
"family": "Language family",
"iso639": "ISO 639-3 code"`}</pre>
          <p className="text-white/40 text-xs">The id is permanent — pick a stable lowercase slug like <code className="text-white/60">modern-spanish</code> or <code className="text-white/60">lakota</code>.</p>
        </div>

        {/* Step 3 */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 space-y-2">
          <p className="text-white font-medium">Step 3 — Tutor</p>
          <p className="text-white/60 text-sm">Give your tutor a culturally appropriate name and a short persona description:</p>
          <pre className="text-xs text-white/70 bg-black/30 rounded-xl p-3 overflow-x-auto">{`"tutor": {
  "name": "Your tutor name",
  "personaShort": "One sentence about who they are."
}`}</pre>
        </div>

        {/* Step 4 */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 space-y-2">
          <p className="text-white font-medium">Step 4 — Prompt template</p>
          <p className="text-white/60 text-sm">Edit <code className="text-white/90">promptTemplate</code> to describe how your tutor should teach. Keep these placeholders:</p>
          <pre className="text-xs text-white/70 bg-black/30 rounded-xl p-3 overflow-x-auto">{`{tutor.name}          tutor's name
{displayName}         language name
{learner.level}       beginner / intermediate
{level.guidance}      level-specific instructions
{goal.guidance}       goal-specific instructions
{dictionary_context}  injected dictionary entries
{grounding.uncertaintyPhrase}  what to say when unsure`}</pre>
        </div>

        {/* Step 5 */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 space-y-2">
          <p className="text-white font-medium">Step 5 — Dictionary (optional)</p>
          <p className="text-white/60 text-sm mb-2">For endangered or community-owned languages, attach a dictionary. Two ways:</p>
          <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-1">Inline (up to ~50 words)</p>
          <pre className="text-xs text-white/70 bg-black/30 rounded-xl p-3 overflow-x-auto mb-3">{`"grounding": {
  "policy": "strict",
  "retrieval": "inline-all",
  "dictionary": {
    "entries": [
      { "word": "boozhoo", "meaning": "hello", "ipa": "boːʒoː" }
    ]
  }
}`}</pre>
          <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-1">Separate file (50+ words)</p>
          <p className="text-white/60 text-sm">Upload a second JSON file on the upload page. It should have this shape:</p>
          <pre className="text-xs text-white/70 bg-black/30 rounded-xl p-3 overflow-x-auto">{`{
  "entries": [
    { "word": "...", "meaning": "...", "ipa": "..." }
  ]
}`}</pre>
          <p className="text-white/40 text-xs">For a vibrant language with no dictionary, set <code className="text-white/60">"grounding": {"{"}"policy": "open"{"}"}</code> and remove <code className="text-white/60">dictionaryRef</code>.</p>
        </div>

        {/* Step 6 */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 space-y-2">
          <p className="text-white font-medium">Step 6 — Sovereignty</p>
          <p className="text-white/60 text-sm">Required for all packs. For an open language:</p>
          <pre className="text-xs text-white/70 bg-black/30 rounded-xl p-3 overflow-x-auto mb-2">{`"sovereignty": {
  "license": "MIT"
}`}</pre>
          <p className="text-white/60 text-sm">For community-owned data, include attribution and contact:</p>
          <pre className="text-xs text-white/70 bg-black/30 rounded-xl p-3 overflow-x-auto">{`"sovereignty": {
  "license": "CC-BY-NC-SA-3.0",
  "attribution": "Source name and URL",
  "contact": "https://...",
  "restrictions": ["non-commercial", "attribution-required"],
  "communityPartnership": "Statement of partnership with the language community."
}`}</pre>
        </div>

        {/* AI tip */}
        <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
          <p className="text-white/50 text-sm">
            💡 You can use an AI assistant (ChatGPT, Claude) to generate your pack. Paste <code className="text-white/70">ojibwe.json</code> as a reference and describe your language — it will fill in the structure for you.
          </p>
        </div>

        <button
          onClick={() => router.push('/tutor/pack/upload')}
          className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl text-sm transition-colors text-center"
        >
          ← Back to upload
        </button>

      </div>
    </main>
  );
}