import asyncio
import json
import logging
import os
import re
import tempfile
import uuid
import re

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import AgentSession, AgentServer, APIConnectOptions, JobContext
from livekit.agents import tts as agents_tts
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
from livekit.plugins import anthropic, deepgram, simli

load_dotenv()

logger = logging.getLogger("chronos-eirini")
logger.setLevel(logging.INFO)

# write Google credentials from .env to a temp file so the SDK can find them
_gcp_creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
if _gcp_creds_json:
    _tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    _tmp.write(_gcp_creds_json)
    _tmp.close()
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _tmp.name


# custom TTS because livekit.plugins.google has a bug in v1.5.x that crashes
# we call the Google SDK directly using run_in_executor to avoid the issue

class GoogleTTS(agents_tts.TTS):

    def __init__(self, voice_name="el-GR-Wavenet-A", language_code="el-GR", sample_rate=24000):
        super().__init__(
            capabilities=agents_tts.TTSCapabilities(streaming=False),
            sample_rate=sample_rate,
            num_channels=1,
        )
        self._voice_name = voice_name
        self._language_code = language_code
        from google.cloud import texttospeech
        self._texttospeech = texttospeech
        self._client = texttospeech.TextToSpeechClient()

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> agents_tts.ChunkedStream:
        # called by livekit-agents each time it needs to speak a piece of text
        return _GoogleTTSStream(tts=self, input_text=text, conn_options=conn_options)


class _GoogleTTSStream(agents_tts.ChunkedStream):

    async def _run(self, output_emitter: agents_tts.AudioEmitter) -> None:
        # runs the synchronous Google TTS call on a background thread so it
        # does not block the async event loop while waiting for Google's response
        tts: GoogleTTS = self._tts
        texttospeech = tts._texttospeech

        # add 350ms pause after quoted phonetic sounds like "αα", "βε"
        ssml_body = re.sub(r'"([^"]+)"', r'"\1"<break time="350ms"/>', self._input_text)
        synthesis_input = texttospeech.SynthesisInput(ssml=f"<speak>{ssml_body}</speak>")

        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: tts._client.synthesize_speech(
                input=synthesis_input,
                voice=texttospeech.VoiceSelectionParams(
                    language_code=tts._language_code,
                    name=tts._voice_name,
                ),
                audio_config=texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                    sample_rate_hertz=tts._sample_rate,
                    speaking_rate=0.82,  # slower than default 1.0 for clearer pronunciation
                ),
            ),
        )

        # initialize tells the emitter the format, then push sends the audio bytes
        output_emitter.initialize(
            request_id=str(uuid.uuid4()),
            sample_rate=tts._sample_rate,
            num_channels=1,
            mime_type="audio/wav",
        )
        output_emitter.push(response.audio_content)


def _has_greek(text: str) -> bool:
    # returns True if the text contains any Greek Unicode characters
    # used to detect whether a sentence from the LLM is Greek or English
    # livekit-agents splits LLM output into sentences before calling synthesize,
    # so EN: translation sentences arrive without their tag — we detect them this way
    return any('\u0370' <= c <= '\u03FF' or '\u1F00' <= c <= '\u1FFF' for c in text)


# CaptionisingGoogleTTS wraps GoogleTTS to intercept the LLM text before synthesis.
# In livekit-agents v1.5.x, before_tts_cb was removed from AgentSession and Agent,
# so we handle the interception inside the TTS class itself.
# Every time livekit-agents calls synthesize(), this class:
#   1. parses the GR:/EN: format from the LLM response
#   2. skips synthesis entirely if the sentence has no Greek characters
#   3. fires off the caption data to the frontend via the LiveKit data channel
#   4. passes only the Greek text down to _GoogleTTSStream so the voice stays in Greek

class CaptionisingGoogleTTS(GoogleTTS):

    def __init__(self, room: rtc.Room, **kwargs):
        super().__init__(**kwargs)
        self._room = room
        # stores the english translation from a standalone EN: synthesize call
        # so it can be attached to the greek caption that arrives just before it
        self._pending_english: str = ""

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> agents_tts.ChunkedStream:
        logger.info(f"synthesize received: {repr(text)}")
        greek, english = parse_response(text)

        if not greek or not _has_greek(greek):
            # standalone EN: line, store it so _send_caption can pick it up
            # after its 0.5s wait (the GR call always arrives first, so by the
            # time it wakes up this will already be set)
            if english:
                self._pending_english = english
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        
        # only publish a caption if this chunk explicitly started with GR:
        # sentences that arrive without the tag are overflow from a two-sentence
        # LLM response. Speak them but don't create a broken caption for them
        if text.strip().startswith("GR:"):
            word_count = len(greek.split())
            display_ms = max(3000, int(word_count * 400))
            asyncio.ensure_future(self._send_caption(greek, english, display_ms))

        return _GoogleTTSStream(tts=self, input_text=greek, conn_options=conn_options)

    async def _send_caption(self, greek: str, english: str, display_ms: int) -> None:
        # small delay to let the EN: synthesize call arrive and set _pending_english
        # tune this value if captions appear too early (increase) or too late (decrease)
        await asyncio.sleep(0.7)

        # if english was empty when GR arrived, pick up the translation that
        # arrived while we slept, then clear it so the next response starts fresh
        if not english and self._pending_english:
            english = self._pending_english
        self._pending_english = ""

        # always send a single complete message with both greek and english
        # the frontend never needs to patch a second message onto the first
        caption_data = json.dumps({
            "greek": greek,
            "english": english,
            "display_ms": display_ms,
        }).encode()
        await self._room.local_participant.publish_data(
            caption_data,
            topic="captions",
        )


# Claude always responds in the format: GR: [greek text] EN: [english translation]
# CaptionisingGoogleTTS strips the format before sending to TTS
# and sends both parts to the frontend as captions via the data channel.
# Responses are limited to ONE sentence so that livekit-agents' sentence splitter
# does not separate the GR: and EN: parts into different synthesize() calls.
SYSTEM_PROMPT = """
You are Ειρήνη (Irini), an expert Ancient Greek tutor with deep knowledge of
classical literature, philosophy, and ancient history.

You understand both English and Greek from your students, but you ALWAYS respond
in Greek only for the spoken part. Your students will read English subtitles.

IMPORTANT: Every response must follow this exact format:
GR: [your response in Modern Greek]
EN: [English translation of exactly what you said in Greek]

Example:
GR: Καλησπέρα! Πώς σε λένε;
EN: Good evening! What is your name?

Never deviate from this format. Never add any other text outside it.

Keep EVERY response to ONE sentence maximum.
Each response must be a single GR:/EN: pair — never more than one sentence per response.

Your teaching style is warm, encouraging, and Socratic.
Check for understanding often. Gently correct mistakes by restating the correct form.
Adjust your level based on how the student responds.
Never use markdown formatting, bullet points, or symbols in your responses.
Speak slowly and clearly.
"""

server = AgentServer()


def parse_response(text: str) -> tuple[str, str]:
    # splits Claude's response into the greek and english parts
    # if the format is missing or malformed, falls back to treating the whole text as greek
    # but only if the text doesn't look like a standalone EN: chunk,  in that case
    # we return empty greek so synthesize() knows to skip it entirely
    greek = ""
    english = ""
    gr_match = re.search(r'GR:\s*(.+?)(?:\nEN:|$)', text, re.DOTALL)
    en_match = re.search(r'EN:\s*(.+?)$', text, re.DOTALL)
    if gr_match:
        greek = gr_match.group(1).strip()
    if en_match:
        english = en_match.group(1).strip()
    # only fall back to raw text if it doesn't look like an EN: chunk
    if not greek and not text.strip().startswith("EN:"):
        greek = text.strip()
    return greek, english

LESSON_SYSTEM_PROMPT = """
You are Ειρήνη (Irini), an expert Ancient Greek teacher conducting a structured lesson.

TOPIC: Lesson 1 — The Ancient Greek Alphabet

THE 24 LETTERS (teach in this order, in groups of 4-5):
Group 1: Άλφα (ακούγεται "αα", σαν αγάπη), Βήτα (ακούγεται "βε", σαν βλέπω), Γάμμα (ακούγεται "γε", σαν γεια), Δέλτα (ακούγεται "δε", σαν δάσος), Έψιλον (ακούγεται "εε", σαν εδώ)
Group 2: Ζήτα (ακούγεται "ζε", σαν ζωή), Ήτα (ακούγεται "ιι" μακρύ, σαν ήλιος), Θήτα (ακούγεται "θε", σαν θάλασσα), Ιώτα (ακούγεται "ιι", σαν ίσως), Κάππα (ακούγεται "κε", σαν καλά)
Group 3: Λάμδα (ακούγεται "λε", σαν λόγος), Μι (ακούγεται "με", σαν μάθημα), Νι (ακούγεται "νε", σαν νερό), Ξι (ακούγεται "ξε", σαν ξένος), Όμικρον (ακούγεται "οο" κοντό, σαν όνομα)
Group 4: Πι (ακούγεται "πε", σαν πάντα), Ρο (ακούγεται "ρε" τρεμάμενο, σαν ρήμα), Σίγμα (ακούγεται "σε", σαν σοφία), Ταυ (ακούγεται "τε", σαν τέχνη), Ύψιλον (ακούγεται "ιι", σαν ύδωρ)
Group 5: Φι (ακούγεται "φε", σαν φως), Χι (ακούγεται "χε", σαν χάρη), Ψι (ακούγεται "ψε", σαν ψυχή), Ωμέγα (ακούγεται "οο" μακρύ, σαν ώρα)

LESSON FLOW — follow this sequence STRICTLY:
1. Welcome the student (1 sentence) → STOP. Wait for Continue.
2. For each group of letters:
   a. Announce the group (1 sentence) → STOP. Wait for Continue.
   b. For each letter, ONE AT A TIME:
      - Say its name, sound, and example word (1 sentence) → STOP. Wait for Continue.
      - Do NOT introduce the next letter until the student presses Continue.
   c. Ask the student to name all letters in the group (1 sentence) → STOP. Wait for Continue.
   d. Quiz: ask what sound one specific letter makes (1 sentence) → STOP. Wait for Continue.
   e. React to the student's answer (1 sentence) → STOP. Wait for Continue.
3. Congratulate after all 5 groups (1 sentence) → STOP.

CRITICAL: Every single response ends with a full stop and you WAIT.
Never chain two steps together. Never say Ιώτα and then immediately Κάππα.
One step. One sentence. Then silence.

IMMERSION RULES:
- Always respond in this EXACT format — no exceptions:
  GR: [your full response in Modern Greek]
  EN: [English translation of exactly what you said in Greek]
- ONE sentence per response — this is the most critical rule. The system breaks if you send more than one.
  ❌ GR: Το τέταρτο γράμμα είναι Δέλτα. Το πέμπτο είναι Έψιλον. Τώρα μπορείς να μου πεις;
  ✅ GR: Το τέταρτο γράμμα είναι Δέλτα, ακούγεται "δε" σαν τη λέξη δάσος.
  One sentence = one full stop. Wait for the student to press Continue before saying the next thing.
- Embed Ancient Greek letters and words naturally inside your Modern Greek speech
- Speak with warmth and patience
- If a student struggles, repeat and simplify — never skip ahead
- Encourage the user after every attempt: "Μπράβο!", "Πολύ καλά!", "Ακριβώς!"
- Never use markdown, bullet points, or symbols outside of Greek letters themselves
- When speaking about a letter, say its NAME only — never the symbols.
  ❌ "Ζ ζ (Ζήτα)" — the TTS reads the symbol three times
  ✅ "Ζήτα" — clean, one word
- When describing a sound, ALWAYS use a Greek syllable or example word — never a single letter in quotes.
  ❌ "Ζήτα που ακούγεται 'z'" — TTS reads 'z' as "ζήτα" (the letter name)
  ✅ "Ζήτα που ακούγεται 'ζε', σαν τη λέξη ζωή" — TTS reads naturally
- NEVER say "Καλώς ήρθες" more than once. The welcome happens exactly once at the very start.
- When responding to a student's spoken answer, say ONLY one sentence — 
  praise OR a gentle correction — then STOP. 
  Do NOT add the answer, do NOT ask the next question in the same response.
  ❌ "Σωστά, το Γάμμα ακούγεται γε. Ο ήχος είναι γε. Τώρα, ποιος είναι ο ήχος του Δέλτα;"
  ✅ "Σωστά, Μπράβο!"
- In the EN: translation, always write sounds as: it sounds like "xx", like the word yyy
  ❌ it sounds "the" like the word thálassa
  ✅ it sounds like "the", like the word thálassa (sea)
"""

@server.rtc_session(agent_name="eirini")
async def run_eirini(ctx: JobContext):
    # metadata comes from dispatch request. "lesson" or "" for a free conversation.
    # this allows us to have a single handler that serves for both modes. 
    is_lesson = ctx.job.metadata == "lesson"
    prompt = LESSON_SYSTEM_PROMPT if is_lesson else SYSTEM_PROMPT
    logger.info(f"Session starting — mode: {'lesson' if is_lesson else 'conversation'}")

    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=anthropic.LLM(model="claude-haiku-4-5-20251001"),
        # CaptionisingGoogleTTS needs ctx.room to publish captions,
        # so it is created here inside run_eirini where ctx is available
        tts=CaptionisingGoogleTTS(
            room=ctx.room,
            voice_name="el-GR-Wavenet-A",
            language_code="el-GR",
        ),
    )

    # Simli avatar — uncomment once TTS is confirmed working end-to-end
    # avatar = simli.AvatarSession(
    #     simli_config=simli.SimliConfig(
    #         api_key=os.getenv("SIMLI_API_KEY"),
    #         face_id=os.getenv("SIMLI_FACE_ID"),
    #     ),
    # )
    # await avatar.start(session, room=ctx.room)

    await session.start(
        agent=agents.Agent(
            instructions=prompt,
        ),
        room=ctx.room,
    )

    # only in lesson mode. triggers the opening welcome through the normal
    # LLM pipeline so captionss work exactly like conversation mode. 
    if is_lesson:
        _reply_lock = asyncio.Lock()


        # listen for "student_ready" messages from the frontend.
        # when the student presses Space or the Continue button, the frontend
        # publishes this message and we trigger Irini's next response.
        @ctx.room.on("data_received")
        def on_student_data(data_packet):
            try:
                payload = json.loads(bytes(data_packet.data).decode())
                if payload.get("type") == "student_ready":
                    # Advance the lesson. Lock prevents overlapping generate_reply calls
                    # if the student presses Continue multiple times quickly.
                    async def do_reply():
                        async with _reply_lock:
                            await session.generate_reply(
                                instructions=(
                                    "The student pressed Continue. Check the conversation history to see "
                                    "what was last said, then deliver exactly the next item in the lesson flow — "
                                    "one sentence only. Do NOT re-welcome, do NOT repeat anything already said."
                                )
                            )
                    asyncio.ensure_future(do_reply())
            except Exception as e:
                logger.error(f"Error handling student data: {e}")

        await session.generate_reply(
            instructions="Begin the lesson now with your opening welcome."
        )
        

if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=run_eirini,
            agent_name="eirini",  # must match the name used in create_dispatch
        )
    )

