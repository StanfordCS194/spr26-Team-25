# Integration

How to wire the language pack foundation into the existing Chronos app. Companion to [`overview.md`](./overview.md) (what packs are) and [`CONTRIBUTING.md`](../CONTRIBUTING.md) (how to author one).

## Audience

You're a Chronos teammate who needs to **consume** packs from one of the three runtime surfaces:

- **Chat backend** (`backend/routes/chat.py`) — the text-mode tutor.
- **Voice agent** (`backend/agent.py`) — the LiveKit-based voice tutor (Eirini, Citlali, lesson mode).
- **Frontend** (`frontend/app/page.tsx`, `frontend/app/tutor/*`) — UI, language picker, vocabulary sidebar.

The pack foundation is in place but **not yet wired into any of these surfaces**. This doc covers the wiring step-by-step for each.

## Prerequisites

```bash
# Backend deps (pydantic, jsonschema, anthropic) come from backend/requirements.txt
cd backend && pip install -r requirements.txt

# Confirm the foundation works
bash scripts/validate-packs.sh                       # all packs validate
cd backend && python3 -m language_pack info ojibwe   # pack summary
cd backend && python3 language_pack/tests/test_phase2.py  # 14/14 should pass

# Frontend deps
cd frontend && npm install
npx tsc --noEmit                                     # no errors in lib/language-pack/
```

If any of those fail, fix before touching app code.

## Mental model

A pack is **data**. The foundation gives you:

- A Python loader (`backend/language_pack`) that returns a typed `LanguagePack`.
- A TypeScript loader (`frontend/lib/language-pack`) that does the same in the browser.
- Pure functions: `compose(pack, learner_profile) → str` produces the system prompt; `extract(pack, response_text) → list[dict]` parses vocabulary out of the model's response.

Integration is therefore mostly **replacing hardcoded values with pack lookups**. The shape of the existing endpoints does not need to change.

---

## Integration 1 — chat backend (`backend/routes/chat.py`)

**Current state**: `SYSTEM_PROMPT` is a hardcoded Greek-only string, `extract_vocabulary` uses a hardcoded Greek regex, the `/api/chat` body has no `pack_id` field.

**Goal**: accept a `pack_id` in the request, compose the system prompt from that pack, extract vocabulary using that pack's regex.

### Step 1 — accept a `pack_id` in the request body

```python
# backend/routes/chat.py
class ChatMessage(BaseModel):
    message: str
    pack_id: str = "ancient-greek"           # NEW — defaults to today's Greek
    level: str = "beginner"
    goal: str = "General curiosity & history"
    time_commitment: str = "30-60 minutes"
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    history: list = []
```

The default keeps existing callers working without any frontend change.

### Step 2 — load the pack once per process, cache it

Pack loading does jsonschema validation + pydantic construction + dictionary-ref resolution. Don't repeat that per request.

```python
# backend/routes/chat.py
from functools import lru_cache
from language_pack import load, compose, extract, LearnerProfile

@lru_cache(maxsize=16)
def _get_pack(pack_id: str):
    return load(pack_id)
```

Add `language_pack` to the import path. If running uvicorn from `backend/`, the package is already importable.

### Step 3 — swap the prompt composition

```python
# backend/routes/chat.py — inside chat()
pack = _get_pack(body.pack_id)
profile = LearnerProfile(
    level=body.level,
    goal=body.goal,
    time_commitment=body.time_commitment,
)
system_prompt = compose(pack, profile)

response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=1024,
    system=system_prompt,                    # was: SYSTEM_PROMPT.format(...)
    messages=messages,
)
```

For `pack_id="ancient-greek"`, the composed prompt equals today's prompt byte-for-byte (verified by `test_greek_prompt_matches_today_byte_for_byte`).

### Step 4 — swap the vocabulary extractor

```python
# backend/routes/chat.py — replace the local extract_vocabulary() with:
vocab_rows = extract(pack, assistant_response, session_id=session_id)
# Add user_id, then translate field names if the Supabase schema differs:
for row in vocab_rows:
    row["user_id"] = body.user_id
    row["greek"] = row.pop("word")          # match existing column names if needed
    # row.pop("translit") may be None for packs without transliteration; the
    # Supabase column accepts NULL.
if vocab_rows:
    supabase.table("vocabulary").insert(vocab_rows).execute()
```

**Schema note**: the existing `vocabulary` table has a `greek` column. Generalizing this is a separate migration — either rename to `word`, or keep `greek` for backward compatibility and add per-pack columns later. The above keeps the schema as-is.

### Step 5 — verify nothing changed for Greek callers

Run the existing chat flow with no `pack_id` in the request. The response should be byte-identical to before the change, because the default `pack_id="ancient-greek"` reproduces today's prompt.

---

## Integration 2 — voice agent (`backend/agent.py`)

**Current state**: `SYSTEM_PROMPT`, `LESSON_SYSTEM_PROMPT`, `NAHUATL_SYSTEM_PROMPT` are three hardcoded strings selected by a `mode` string ("conversation" / "lesson" / "nahuatl"). TTS voice and language code are also hardcoded per mode.

**Goal**: each mode loads a pack and reads `tutor`, `promptTemplate`, `voice` from it.

### Step 1 — map modes to pack IDs

```python
# backend/agent.py
MODE_TO_PACK = {
    "conversation": "ancient-greek",
    "lesson":       "ancient-greek",        # uses same pack; differs in lesson logic
    "nahuatl":      "classical-nahuatl",
    "ojibwe":       "ojibwe",               # NEW
}
```

### Step 2 — replace the three system prompts with pack composition

```python
from language_pack import load, compose, LearnerProfile

@server.rtc_session(agent_name="eirini")
async def run_eirini(ctx: JobContext):
    metadata_parts = (ctx.job.metadata or "").split("|", 1)
    mode = metadata_parts[0]
    session_user_id = metadata_parts[1] if len(metadata_parts) > 1 else ""

    pack = load(MODE_TO_PACK.get(mode, "ancient-greek"))
    profile = LearnerProfile(
        level="beginner",                   # voice mode currently has no profile UI
        goal=pack.goals[0].id if pack.goals else "general",
        time_commitment="30-60 minutes",
    )
    prompt = compose(pack, profile)
```

### Step 3 — drive TTS from the pack

```python
voice_cfg = pack.voice
if voice_cfg.provider == "google-tts":
    voice_name = voice_cfg.voice
    language_code = voice_cfg.languageCode
elif voice_cfg.provider == "none" and voice_cfg.fallbackVoice:
    voice_name = voice_cfg.fallbackVoice.voice
    language_code = voice_cfg.fallbackVoice.languageCode
else:
    voice_name, language_code = "el-GR-Wavenet-A", "el-GR"  # safe default
```

Then construct `CaptionisingGoogleTTS(voice_name=voice_name, language_code=language_code, ...)` from the pack values.

### Step 4 — keep the caption-format hook in agent.py, not in the pack

The `NAHUATL:/SPEECH:` format and the `_has_greek()` Greek-detection helper are **voice-mode rendering concerns**, not pack concerns. Leave them in `agent.py`. The pack supplies persona + dictionary + voice config; the agent decides how to surface them.

This is the deliberate boundary: packs are language-agnostic data; voice-agent code is the framework that consumes them with mode-specific rendering.

---

## Integration 3 — frontend (`frontend/app/page.tsx` and others)

**Current state**: the Greek tutor URL is hardcoded; the persona, goals, and vocabulary sidebar all assume Greek.

**Goal**: read the current pack from state, render persona/goals/vocab from it, send `pack_id` with chat requests.

### Step 1 — serve packs to the browser

`registry.ts` lists URLs like `/packs/<id>.json`, but `frontend/public/packs/` doesn't exist. Pick one:

**Option A — sync script (recommended).** Add `frontend/scripts/sync-packs.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(root, '../../packs');
const dst = path.resolve(root, '../public/packs');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true, filter: (s) => !s.endsWith('.md') });
console.log(`synced packs/ -> public/packs/`);
```

Wire into `package.json`:

```json
{
  "scripts": {
    "predev": "node scripts/sync-packs.mjs",
    "prebuild": "node scripts/sync-packs.mjs",
    "dev": "next dev",
    "build": "next build"
  }
}
```

Add `frontend/public/packs/` to `.gitignore` (it's derived, not source).

**Option B — backend endpoint.** Add `GET /api/packs/{id}` to FastAPI that reads from `packs/<id>.json`. Update `registry.ts` URLs accordingly. Use when you want auth gating or dynamic pack delivery.

**Option C — symlink (dev only).** `ln -s ../../packs frontend/public/packs`. Fastest, but Vercel's build is finicky about symlinks; don't rely on this in production.

### Step 2 — load the current pack

In `app/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { loadPack, getPackMetadata, type LanguagePack } from '@/lib/language-pack';

export default function Home() {
  const [pack, setPack] = useState<LanguagePack | null>(null);

  useEffect(() => {
    // Persisted from onboarding or defaulted to Greek.
    const id = localStorage.getItem('chronos_pack_id') || 'ancient-greek';
    const meta = getPackMetadata(id);
    if (meta) loadPack(meta.url).then(setPack);
  }, []);

  if (!pack) return <Loading />;
  // ... rest of the component
}
```

### Step 3 — replace hardcoded persona/goals

```tsx
<h1>{pack.displayName}</h1>
<p>Your {pack.displayName} AI tutor — {pack.tutor.name}</p>

{/* goals as onboarding buttons */}
{pack.goals?.map(g => (
  <button key={g.id} onClick={() => setGoal(g.id)}>{g.label}</button>
))}
```

### Step 4 — send `pack_id` in chat requests

```tsx
await fetch(`${API}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pack_id: pack.id,                       // NEW
    message: input,
    level: getLevel(),
    goal: profile?.goal || pack.goals?.[0].label || 'general',
    time_commitment: profile?.time || '30-60 minutes',
    session_id: sessionId,
    user_id: currentUserId,
    history: messages,
  }),
});
```

Backend already defaults to `ancient-greek` if `pack_id` is missing, so older builds of the frontend keep working through the cutover.

### Step 5 — render vocabulary from the pack's dictionary too

For packs with a dictionary, you can show "words in today's lesson" without round-tripping to Supabase:

```tsx
pack.grounding?.dictionary?.entries.slice(0, 10).map(e => (
  <div key={e.word}>
    <strong>{e.word}</strong>
    {e.ipa && <code>/{e.ipa}/</code>}
    <span>{e.meaning}</span>
  </div>
))
```

### Step 6 — render attribution

Required for non-MIT packs (including all endangered-language packs):

```tsx
{pack.sovereignty.attribution && (
  <footer className="text-xs text-stone-400">{pack.sovereignty.attribution}</footer>
)}
```

This is not optional — the validator enforces that `sovereignty` is present, but the team enforces that the UI surfaces `attribution`.

---

## Deployment

### Railway (backend)

- The pack files live in `packs/` at repo root and need to ship in the deployment. They're already tracked in git, so Railway's git-based deploy picks them up automatically.
- `backend/language_pack/loader.py` computes `PACKS_DIR` relative to the package file via `Path(__file__).resolve().parents[2] / "packs"`. This works on Railway as long as the deployed tree mirrors the repo layout. If Railway flattens the structure, adjust the `_REPO_ROOT` calculation.
- `requirements.txt` may need `jsonschema>=4.0` added if not already present — verify with `pip show jsonschema` in the build environment.

### Vercel (frontend)

- Option A from Integration 3 (sync script + `prebuild`) works on Vercel — the build step runs Node and copies files into `public/`, which Vercel serves as static assets.
- Confirm `frontend/public/packs/` is in `.gitignore`; otherwise the sync script's `rmSync` will fight git.
- The `predev` hook means local development picks up pack changes on `npm run dev` restart. For instant updates, run `node frontend/scripts/sync-packs.mjs` manually after editing a pack.

### Supabase

- No schema changes required for the chat integration described above (Step 4 of Integration 1 keeps the existing `greek` column).
- For a clean per-language vocabulary table: add `language_pack_id` and `word` columns; backfill `word` from `greek`; deprecate `greek`. This is a separate migration outside the scope of pack integration.

---

## Migration strategy — rolling out without breaking Greek

The default pack ID is `ancient-greek` everywhere. To roll out safely:

1. **Land the chat-backend integration first** with the `pack_id` default. No frontend change yet. Run regression: existing requests must produce identical responses.
2. **Land the frontend pack loader** but keep sending the default `pack_id` and reading hardcoded persona text. Confirm the pack loads in the browser without affecting UI.
3. **Switch the persona / goals to read from the loaded pack.** Still only Greek pack is served. Confirm UI parity.
4. **Add a language picker** (gated behind a feature flag or hidden behind a query param) that lets users pick `classical-nahuatl` or `ojibwe`. Eat your own dogfood.
5. **Add voice-agent integration** for the modes that have packs.
6. **Remove the hardcoded `SYSTEM_PROMPT` constant** from `chat.py` only after the pack-backed path has run in production for a week without regressions.

At every step, the fallback path (default pack = Greek) keeps working.

---

## Testing your integration

### Backend

```bash
cd backend
python3 -m language_pack validate            # all packs lint
python3 language_pack/tests/test_phase2.py   # 14/14 passing
```

After integrating into chat.py, add a route-level test:

```python
def test_chat_with_default_pack_id_equals_legacy():
    """Posting to /api/chat without pack_id produces a response composed from
    the ancient-greek pack, which should match the legacy behavior."""
    # ...
```

### Frontend

```bash
cd frontend
npx tsc --noEmit                             # no new errors
npm run dev                                  # check the language picker works
```

After integration: hit `/pack-preview` (the demo page in this doc's quick-start) to verify the pack loads in the browser.

### End-to-end

`python3 -m language_pack repl <pack-id>` opens an Anthropic-backed REPL against the composed prompt. The voice agent and chat backend produce the same prompt for the same pack + profile, so REPL behavior is a good predictor of voice/chat behavior.

---

## Gotchas

- **Pack `id` vs. file name.** The file must be `packs/<id>.json`. The validator enforces this; if you rename the file, rename the `id` field too.
- **The `vocabulary` Supabase table's `greek` column** is Greek-specific. If you swap to packs without renaming the column, downstream queries that filter on Greek-only assumptions will silently treat non-Greek vocabulary as Greek.
- **`grounding.policy: "strict"` is not magic.** The pack format's `policy` field is documentation; the actual enforcement lives in your `promptTemplate` prose (see `pedagogy.md`). A pack with strict policy and a permissive prompt will produce a permissive tutor.
- **Per-entry `audioUrl` is unused today.** The schema supports it; no UI surfaces it yet. When you add audio playback (e.g. click-to-hear on the vocabulary sidebar), wire it through.
- **The voice agent's caption format (`NAHUATL:/SPEECH:`) is voice-mode-specific.** Don't push it into the pack's `promptTemplate` — it would break chat-mode use of the same pack.
- **Token cost of `inline-all` grounding.** A 100-entry dictionary is 3-5k tokens per request. With prompt caching this amortizes across a session, but profile before shipping a 500-entry pack with `inline-all`.
- **Cross-origin loading.** If you serve packs from the backend (Integration 3, Option B), the CORS config in `backend/main.py` already allows all origins, so this works. If you proxy through another domain, verify.

---

## FAQ

**Q: Can a pack change while the app is running?**
The Python loader caches per process (via `lru_cache`). To pick up edits, restart the backend. The frontend re-fetches on each `loadPack` call, so it picks up changes on full page reload.

**Q: How do I write a pack that does something different in voice mode vs. text mode?**
The pack itself doesn't know about mode. Compose two different system prompts in your code: one for text (`compose(pack, profile)`), one for voice (`compose(pack, profile)` plus prepending voice-format instructions). Or write the pack's `promptTemplate` to be mode-agnostic and add the voice format as a per-request prefix in the agent.

**Q: How do I add per-user pack overrides (e.g. user wants to skip the greeting)?**
Not in the pack — packs are per-language, not per-user. User-level overrides belong on the `LearnerProfile` or in a session-state struct. Extend `LearnerProfile` if you need a new field; the pydantic model is straightforward to extend.

**Q: What happens if the user picks a pack the backend doesn't recognize?**
`load(pack_id)` raises `FileNotFoundError`. Wrap it in a try/except in `chat.py` and either 400 the request or fall back to `ancient-greek`. The latter is friendlier.

**Q: Do I need to update the schema to add a new field per language?**
No. The schema is intentionally language-agnostic. If your language needs structured data not in the schema (e.g. tone-marking rules for a tonal language), that's a schema extension that benefits all packs — propose the change, update `schema.json` + `models.py` + `types.ts` together, and confirm all existing packs still validate.

**Q: Who owns this integration if it breaks?**
Whoever wired the surface. Chat backend → chat owner. Voice agent → voice owner. Frontend → frontend owner. The `language_pack/` package itself is shared.
