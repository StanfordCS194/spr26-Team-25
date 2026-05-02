import asyncio
import logging
import os
import tempfile
import uuid

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, AgentServer, APIConnectOptions, JobContext
from livekit.agents import tts as agents_tts
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
from livekit.plugins import anthropic, deepgram, simli

load_dotenv()

logger = logging.getLogger("chronos-eirini")
logger.setLevel(logging.INFO)

# Google Cloud TTS requires a service account JSON for authentication.
# We store that JSON as a single env variable (GOOGLE_CREDENTIALS_JSON) in .env,
# write it to a temp file at startup, and point the Google SDK to it.
# This is the same approach used in routes/chat.py for the REST endpoint.
_gcp_creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
if _gcp_creds_json:
    _tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    _tmp.write(_gcp_creds_json)
    _tmp.close()
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _tmp.name


# livekit-agents ships a Google TTS plugin (livekit.plugins.google) but it has
# a bug in v1.5.x where its internal async generator crashes with:
#   RuntimeError: aclose(): asynchronous generator is already running
# This happens in both streaming and non-streaming mode.
#
# The fix is to bypass the plugin entirely and call the Google Cloud TTS SDK
# directly using the synchronous client inside run_in_executor.
# run_in_executor runs blocking code on a thread pool without blocking the
# async event loop, and has no async generator so there is no crash.
#
# To plug into livekit-agents we subclass two base classes:
#   agents_tts.TTS           the provider that holds config and creates streams
#   agents_tts.ChunkedStream one synthesis request that does the actual work

class GoogleTTS(agents_tts.TTS):
    """Google Cloud TTS provider for livekit-agents."""

    def __init__(self, voice_name="el-GR-Wavenet-A", language_code="el-GR", sample_rate=24000):
        super().__init__(
            # streaming=False tells livekit-agents to call synthesize() for
            # one-shot synthesis instead of stream() for real-time token-by-token.
            capabilities=agents_tts.TTSCapabilities(streaming=False),
            sample_rate=sample_rate,
            num_channels=1,
        )
        self._voice_name = voice_name
        self._language_code = language_code

        # Import inside __init__ so the module still loads if the package is
        # missing. You get a clear error at runtime instead of at import time.
        from google.cloud import texttospeech
        self._texttospeech = texttospeech

        # Synchronous client that is safe to call from a thread pool
        self._client = texttospeech.TextToSpeechClient()

    def synthesize(
        self,
        text: str,
        *,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    ) -> agents_tts.ChunkedStream:
        # livekit-agents calls this method whenever the LLM produces a response
        # that needs to be spoken. We return a ChunkedStream that will do the work.
        return _GoogleTTSStream(tts=self, input_text=text, conn_options=conn_options)


class _GoogleTTSStream(agents_tts.ChunkedStream):
    """One TTS request: takes a text string and pushes audio frames to livekit-agents."""

    async def _run(self, output_emitter: agents_tts.AudioEmitter) -> None:
        tts: GoogleTTS = self._tts
        texttospeech = tts._texttospeech

        # run_in_executor runs the synchronous API call on a background thread.
        # This keeps the async event loop free while we wait for Google's response.
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: tts._client.synthesize_speech(
                input=texttospeech.SynthesisInput(text=self._input_text),
                voice=texttospeech.VoiceSelectionParams(
                    language_code=tts._language_code,
                    name=tts._voice_name,
                ),
                audio_config=texttospeech.AudioConfig(
                    # LINEAR16 returns a standard WAV file with a header.
                    # We set mime_type to "audio/wav" below so the AudioEmitter
                    # knows to decode the bytes using a WAV stream decoder.
                    audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                    sample_rate_hertz=tts._sample_rate,
                ),
            ),
        )

        # Tell the AudioEmitter what format the bytes are in, then push them.
        # The emitter handles chunking, timing, and forwarding to the WebRTC track.
        output_emitter.initialize(
            request_id=str(uuid.uuid4()),
            sample_rate=tts._sample_rate,
            num_channels=1,
            mime_type="audio/wav",
        )
        output_emitter.push(response.audio_content)


# Key design decisions for the system prompt:
# Always responds in Modern Greek so students hear Greek constantly.
# Understands English input so English speakers can participate.
# No markdown because TTS would read "**word**" as "asterisk asterisk word".
# Short sentences and Socratic style work better in voice than in text.
SYSTEM_PROMPT = """
You are Ειρήνη (Irini), an expert Ancient Greek tutor with deep knowledge of
classical literature, philosophy, and ancient history.

You understand both English and Greek from your students, but you ALWAYS respond
in Greek only. Your students will read English subtitles separately, so never
switch to English even if they speak to you in English.

You teach Ancient Greek vocabulary, grammar, and texts using simple, clear
Modern Greek so beginners can follow along.

When introducing an Ancient Greek word, say the word clearly and then give
its meaning in Greek. Keep your explanations short and conversational since
this is a voice interaction.

Your teaching style is warm, encouraging, and Socratic. Use short sentences.
Check for understanding often. Gently correct mistakes by restating the correct
form. Adjust your level based on how the student responds.

Never use markdown formatting, bullet points, or symbols in your responses.
Speak naturally as if having a conversation.
Speak slowly and clearly. Pause between sentences.
"""

server = AgentServer()


@server.rtc_session(agent_name="eirini")
async def run_eirini(ctx: JobContext):
    """
    Called by livekit-agents once per WebRTC session (one student connection).
    Wires together STT, LLM, and TTS into a live voice pipeline.
    """
    logger.info("New student session starting")

    session = AgentSession(
        # Deepgram Nova 3 in multilingual mode handles both English and
        # Greek input from the student without needing to switch modes.
        stt=deepgram.STT(model="nova-3", language="multi"),

        # Claude Haiku is fast and cheap, good enough for conversational tutoring.
        # Same model used in the Chronos text chat backend.
        llm=anthropic.LLM(model="claude-haiku-4-5-20251001"),

        # Our custom Google TTS defined above. Greek voice, no plugin bugs.
        tts=GoogleTTS(voice_name="el-GR-Wavenet-A", language_code="el-GR"),
    )

    # Simli renders Ειρήνη as a lip-synced avatar video stream.
    # Commented out while testing TTS to avoid unnecessarily burning Simli minutes.
    # Uncomment once audio is confirmed working end-to-end.
    # avatar = simli.AvatarSession(
    #     simli_config=simli.SimliConfig(
    #         api_key=os.getenv("SIMLI_API_KEY"),
    #         face_id=os.getenv("SIMLI_FACE_ID"),
    #     ),
    # )
    # await avatar.start(session, room=ctx.room)
    # logger.info("Ειρήνη avatar joined the room")

    await session.start(
        agent=agents.Agent(instructions=SYSTEM_PROMPT),
        room=ctx.room,
    )
    logger.info("Ειρήνη session started")


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=run_eirini, agent_name="eirini"))