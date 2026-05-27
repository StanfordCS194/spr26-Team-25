import asyncio # manages asynchronous operations to not block the event loop
import json # serializes and deserializes data to send captions over the data channel
import logging # logs debug and error messages to the console
import os # reads environment variables and manipulates file paths
import re # regex to parse the GR:/EN: format from the LLM response
import tempfile # creates temporary files to write Google credentials to disk 
import uuid # generates unique IDs for each TTS request
import re 

from dotenv import load_dotenv # to load secrets from the .env file into os.environ
from livekit import agents, rtc # core livekit framework and real-time communication primitives
from livekit.agents import AgentSession, AgentServer, APIConnectOptions, JobContext # session orchestrator, server, and job context
from livekit.agents import tts as agents_tts # base TTS interface that GoogleTTS inherits from
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS # default timeout/retry settings for API calls
from livekit.plugins import anthropic, deepgram, simli # Claude LLM, Deepgram STT, and Simli avatar plugins 
from supabase import create_client # connect to Supabase to log conversations

# read the .env file and load all secrets into os.environ
load_dotenv()

# initialize supabase client for saving conversation logs.
# falls back to None gracefully if credentials aren't set so the agent still runs
_supabase_url = os.getenv("SUPABASE_URL") # read Supabase project URL from environment
_supabase_key = os.getenv("SUPABASE_KEY") # read the Supabase secret key from environment
# create the client only if both credentials exist, otherwise defaults to None so the agent still runs
supabase_client = create_client(_supabase_url, _supabase_key) if _supabase_url and _supabase_key else None 

# creates a named logger so its messages can be filtered independently
logger = logging.getLogger("chronos-eirini")
# logs info and errors but skips verbose debug messages
logger.setLevel(logging.INFO)

# write Google credentials from .env to a temp file so the SDK can find them
# 1) reads Google credentials JSON string from environment (from Service Account of Google cloud, pertains to the application)
# GOOGLE_CREDENTIALS_JSON contains email of server accoumt, ID of project in Google Cloud for API calls, and private key that verifies it is you
_gcp_creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
if _gcp_creds_json:
    # create a temp file on disk (Google SDK requires a file, not a string)
    _tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    # writesthe credentials JSON into the temp file 
    _tmp.write(_gcp_creds_json)
    # closes the file so the SDK can read it (delete=False keeps it alive)
    _tmp.close()
    # points the Google SDK to the temp file location
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _tmp.name


# custom TTS class that wraps the Google Cloud SDK. built because livekit.plugins.google has a bug in v1.5.x that crashes
# we call the Google SDK directly using run_in_executor to avoid the issue
class GoogleTTS(agents_tts.TTS):
    def __init__(self, voice_name="el-GR-Wavenet-A", language_code="el-GR", sample_rate=24000, speaking_rate=0.82):
        super().__init__(
            # tells LiveKit this TTS returns full audio at once, not in chunks
            capabilities=agents_tts.TTSCapabilities(streaming=False),
            # audio quality: 24000 Hz is CD-quality for voice
            sample_rate=sample_rate,
            # mono audio. one channel is enough for voice
            num_channels=1,
        )
        # which Google voice to use (e.g. Greek female Wavenet)
        self._voice_name = voice_name
        # language for the voice (e.g. "el-GR" for Greek)
        self._language_code = language_code
        # speed of speech - 0.82 is slightly slower than normal for clarity
        self._speaking_rate = speaking_rate # stored so that _GoogleTTSStream can read it
        # lazy import, only loads the SDK when an instance is actually created
        from google.cloud import texttospeech
        # saves the module so _GoogleTTSStream can access it 
        self._texttospeech = texttospeech
        # creates the authenticated Google TTS client using the credentials file
        self._client = texttospeech.TextToSpeechClient()

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> agents_tts.ChunkedStream:
        # called by livekit-agents each time it needs to speak a piece of text. returns a stream object that does the actual work. 
        return _GoogleTTSStream(tts=self, input_text=text, conn_options=conn_options)


class _GoogleTTSStream(agents_tts.ChunkedStream):
    def __init__(self, *, tts, input_text, conn_options, caption_event=None):
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._caption_event = caption_event

    async def _run(self, output_emitter: agents_tts.AudioEmitter) -> None:
        # wait for the caption to be published before starting audio synthesis
        # this ensures the subtitle appears before the voice starts speaking
        if self._caption_event is not None:
            try:
                # espera hasta 3 segundos a que EN: publique el caption
                # si no llega (pipeline secuencial de v1.5.7), procede igual
                await asyncio.wait_for(self._caption_event.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                logger.warning("caption event timeout — playing audio without EN:")
            else: 
                # caption was published — wait for frontend to receive and render it
                # before Irini starts speaking, so the student can read first
                await asyncio.sleep(0.8)
        # if self._caption_event is not None:
        #     await self._caption_event.wait()

        # runs the synchronous Google TTS call on a background thread so it
        # does not block the async event loop while waiting for Google's response
        tts: GoogleTTS = self._tts
        # shortcut to the texttospeech module stored on the parent
        texttospeech = tts._texttospeech

        # find any text in quotes and add a 350ms pause after it so phonetic sounds like "αα", "βε" and feel natural
        ssml_body = re.sub(r'"([^"]+)"', r'"\1"<break time="350ms"/>', self._input_text)
        # wrap the text in SSML <speak> tags so Google processes the <break> pauses
        synthesis_input = texttospeech.SynthesisInput(ssml=f"<speak>{ssml_body}</speak>")

        # run the blocking Google API call in a thread pool so the event loop stays free
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: tts._client.synthesize_speech(
                input=synthesis_input,
                voice=texttospeech.VoiceSelectionParams(
                    # lnguage of the voice (e.g. "el-GR" for Greek)
                    language_code=tts._language_code,
                    # specific voice model (e.g. Greek female Wavenet)
                    name=tts._voice_name,
                ),
                audio_config=texttospeech.AudioConfig(
                    # raw uncompressed audio, bestquality for real-time playback
                    audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                    # must match the sample_rate as declared in GoogleTTS.__init__
                    sample_rate_hertz=tts._sample_rate,
                    #speaking speed. differs per mode (0.82 for Greek, 0.95 for English).
                    speaking_rate=tts._speaking_rate,  # different speaking rate for different modes
                ),
            ),
        )

        # initialize tells the emitter the format, then push sends the audio bytes
        # declare the audio format to LiveKit before pushing any bytes
        output_emitter.initialize(
            # unique ID so LiveKit can trace this request in its logs
            request_id=str(uuid.uuid4()),
            sample_rate=tts._sample_rate,
            num_channels=1,
            mime_type="audio/wav",
        )
        # send the raw audio bytes to LiveKit to play to the student
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

class _GoogleTTSStream(agents_tts.ChunkedStream):
    def __init__(self, *, tts, input_text, conn_options):
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)

    async def _run(self, output_emitter: agents_tts.AudioEmitter) -> None:
        # small fixed delay so the partial caption renders before audio starts
        # replaces the old caption_event approach which caused deadlocks in
        # livekit-agents v1.5.7 (sequential pipeline: stream runs to completion
        # before the next synthesize() is called, so EN: never arrived in time)
        await asyncio.sleep(0.3)

        # runs the synchronous Google TTS call on a background thread so it
        # does not block the async event loop while waiting for Google's response
        tts: GoogleTTS = self._tts
        # shortcut to the texttospeech module stored on the parent
        texttospeech = tts._texttospeech

        # find any text in quotes and add a 350ms pause after it so phonetic sounds like "αα", "βε" feel natural
        ssml_body = re.sub(r'"([^"]+)"', r'"\1"<break time="350ms"/>', self._input_text)
        # wrap the text in SSML <speak> tags so Google processes the <break> pauses
        synthesis_input = texttospeech.SynthesisInput(ssml=f"<speak>{ssml_body}</speak>")

        # run the blocking Google API call in a thread pool so the event loop stays free
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: tts._client.synthesize_speech(
                input=synthesis_input,
                voice=texttospeech.VoiceSelectionParams(
                    # language of the voice (e.g. "el-GR" for Greek)
                    language_code=tts._language_code,
                    # specific voice model (e.g. Greek female Wavenet)
                    name=tts._voice_name,
                ),
                audio_config=texttospeech.AudioConfig(
                    # raw uncompressed audio, best quality for real-time playback
                    audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                    # must match the sample_rate as declared in GoogleTTS.__init__
                    sample_rate_hertz=tts._sample_rate,
                    # speaking speed. differs per mode (0.82 for Greek, 0.95 for English).
                    speaking_rate=tts._speaking_rate,
                ),
            ),
        )

        # initialize tells the emitter the format, then push sends the audio bytes
        # declare the audio format to LiveKit before pushing any bytes
        output_emitter.initialize(
            # unique ID so LiveKit can trace this request in its logs
            request_id=str(uuid.uuid4()),
            sample_rate=tts._sample_rate,
            num_channels=1,
            mime_type="audio/wav",
        )
        # send the raw audio bytes to LiveKit to play to the student
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
#   3. immediately publishes a Greek-only caption so the subtitle appears before audio starts
#   4. once EN: arrives, republishes the full caption with the English translation
#   5. passes only the Greek text down to _GoogleTTSStream so the voice stays in Greek

class CaptionisingGoogleTTS(GoogleTTS):

    def __init__(self, room: rtc.Room, **kwargs):
        # pass all GoogleTTS config (voice, language, rate) up to the parent
        super().__init__(**kwargs)
        # store the room so _send_caption can publish data to the frontend
        self._room = room
        # accumulates all greek sentences in this response before publishing the caption
        self._greek_buffer: str = ""
        # accumulates all english sentences as they arrive after EN:
        self._english_buffer: str = ""
        # True after EN: arrives, so continuation english sentences are caught
        self._in_english: bool = False
        self._caption_task: asyncio.Task | None = None
        # _caption_event removed — caused deadlocks in v1.5.7 sequential pipeline

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> agents_tts.ChunkedStream:
        # log every chunk that arrives so we can debug timing issues
        logger.info(f"synthesize received: {repr(text)}")
        # split the LLM response into the greek and english parts
        greek, english = parse_response(text)

        if text.strip().startswith("GR:"):
            # new response. reset buffers
            self._greek_buffer = greek
            self._english_buffer = ""
            self._in_english = False
            if english:
                # GR: and EN: arrived in the same chunk, schedule caption immediately
                self._english_buffer = english
                self._in_english = True
                self._schedule_caption()
            else:
                # publish partial caption (Greek only) immediately so subtitle
                # appears before the voice starts — English arrives with EN: later
                asyncio.ensure_future(self._send_partial_caption(greek))
        elif text.strip().startswith("EN:"):
            # english translation started, schedule caption with all accumulated greek
            self._english_buffer = english
            self._in_english = True
            if self._greek_buffer:
                self._schedule_caption()
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        elif self._in_english:
            # accumulate continuation english sentences and reschedule so the last chunk wins
            self._english_buffer += " " + text.strip()
            self._schedule_caption()
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        elif self._greek_buffer and greek and _has_greek(greek):
            # middle greek sentence, accumulate into the buffer
            self._greek_buffer += " " + greek
            # if this chunk also contains EN: (combined by sentence splitter), schedule now
            if english:
                self._english_buffer = english
                self._in_english = True
                self._schedule_caption()
        if not greek or not _has_greek(greek):
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        # no caption_event — audio plays immediately after the fixed 0.3s delay in _run
        return _GoogleTTSStream(tts=self, input_text=greek, conn_options=conn_options)

    def _schedule_caption(self) -> None:
        # cancel any pending caption task and reschedule, the last english chunk always wins
        if self._caption_task and not self._caption_task.done():
            self._caption_task.cancel()
        word_count = len(self._greek_buffer.split())
        display_ms = max(4000, int(word_count * 500))
        self._caption_task = asyncio.ensure_future(
            self._send_caption(self._greek_buffer, display_ms)
        )

    async def _send_partial_caption(self, greek: str) -> None:
        """Publish Greek-only caption immediately so subtitle appears before EN: arrives."""
        try:
            # short delay so the subtitle renders just before audio starts
            await asyncio.sleep(0.1)
            word_count = len(greek.split())
            display_ms = max(4000, int(word_count * 500))
            # publish with empty english — frontend shows Greek only until full caption arrives
            caption_data = json.dumps({
                "greek": greek,
                "english": "",
                "display_ms": display_ms,
            }).encode()
            # publish the partial caption over the LiveKit data channel
            await self._room.local_participant.publish_data(
                caption_data,
                topic="captions",
            )
        except Exception as e:
            logger.error(f"Error publishing partial caption: {e}")

    async def _send_caption(self, greek: str, display_ms: int) -> None:
        try:
            # brief debounce so any continuation english sentences can accumulate before publishing
            await asyncio.sleep(0.35)
            # strip any embedded GR:/EN: tags that the LLM accidentally put inside the EN: translation
            clean_english = re.sub(r'\s*(GR:|EN:).*$', '', self._english_buffer, flags=re.DOTALL).strip()
            # always read the latest buffer — more english may have arrived during the wait
            caption_data = json.dumps({
                "greek": greek,
                "english": clean_english,
                "display_ms": display_ms,
            }).encode()
            # publish the caption over the LiveKit data channel so the frontend can display it
            await self._room.local_participant.publish_data(
                caption_data,
                topic="captions",
            )
        except asyncio.CancelledError:
            pass  # this task was superseded by a newer english chunk, expected

# NahuatlTTS wraps GoogleTTS to intercept the LLM text before synthesis.
# It works the same way as CaptionisingGoogleTTS but for English instead of Greek:
#   1. parses the NAHUATL:/SPEECH: format from the LLM response
#   2. speaks only the SPEECH part using an English-language voice
#   3. publishes both the nahuatl word and english text to the LiveKit data channel
#      so the frontend can display the nahuatl word prominently above the translation
class NahuatlTTS(GoogleTTS):

    def __init__(self, room: rtc.Room, **kwargs):
        # pass all GoogleTTS config (voice, language, rate) up to the parent
        super().__init__(**kwargs)
        # store the room so _send_caption can publish data to the frontend
        self._room = room
        # holds the current Nahuatl word so overflow sentences can reuse it in their caption
        self._pending_nahuatl_word = ""

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> agents_tts.ChunkedStream:
        # log every chunk that arrives so we can debug timing issues
        logger.info(f"[Nahuatl] synthesize received: {repr(text)}")
        # split the LLM response into the Nahuatl word and the English speech
        nahuatl_word, speech = _parse_nahuatl_response(text)

        # only publish a caption if this chunk explicitly started with NAHUATL:
        # overflow sentences that arrive without the tag are spoken but don't
        # create a caption, same pattern as CaptionisingGoogleTTS with GR:
        if text.strip().startswith("NAHUATL:") and speech:
            # new word arrived so save it so overflow chunks below can attach to it
            self._pending_nahuatl_word = nahuatl_word
            # calculate how long to show the caption (minimum 4 seconds, 450ms per word)
            word_count = len(speech.split())
            display_ms = max(4000, int(word_count * 450))
            # fire off the caption without waiting, the audio can start immediately 
            asyncio.ensure_future(self._send_caption(nahuatl_word, speech, display_ms))
        elif self._pending_nahuatl_word and speech:
            # LiveKit's sentence splitter broke the response into multiple chunks,
            # reuse the saved Nahuatl word so the cation stays attached to the right word 
            word_count = len(speech.split())
            display_ms = max(4000, int(word_count * 450))
            asyncio.ensure_future(self._send_caption(self._pending_nahuatl_word, speech, display_ms))

        # speak only the English translation - the Nahuatl word is display-only in the caption
        # fall back to a silent space if speech is empty to avoid crashing the TTS
        return _GoogleTTSStream(tts=self, input_text=speech if speech else " ", conn_options=conn_options)

    async def _send_caption(self, nahuatl_word: str, speech: str, display_ms: int) -> None:
        # publish a single complete message with both the nahuatl word and english text.
        # the frontend reads nahuatl_word to display it prominently (like greek in the
        # greek mode), and english for the explanation below it

        # package the Nahuatl word and English explanation into a single JSON message 
        caption_data = json.dumps({
            # displayed prominently on the frontend (like the Greek text in Greek mode)
            "nahuatl_word": nahuatl_word,
            # displayed below as the explanation
            "english": speech,
            # how long the frontend should display this caption in milliseconds
            "display_ms": display_ms,
        }).encode()
        # publish the caption over the LiveKit data channel so the frontend can display it
        await self._room.local_participant.publish_data(
            caption_data,
            # topic lets the frontend filter only caption messages
            topic="captions",
        )

# Claude always responds in the format: GR: [greek text] EN: [english translation]
# CaptionisingGoogleTTS strips the format before sending to TTS
# and sends both parts to the frontend as captions via the data channel.
# Responses are limited to 2-3 sentences so captions remain readable.
SYSTEM_PROMPT = """
You are Ειρήνη (Irini), an expert Koine Greek tutor with deep knowledge of
the New Testament, the Septuagint, and Hellenistic literature.

You understand both English and Greek from your students, but you ALWAYS respond
in Koine Greek only for the spoken part. Your students will read English subtitles.

IMPORTANT: Every response must follow this exact format:
GR: [your response in Koine Greek]
EN: [English translation of exactly what you said in Greek]

Example:
GR: Χαῖρε! Τί θέλεις μαθεῖν σήμερον;
EN: Greetings! What do you wish to learn today?

Never deviate from this format. Never add any other text outside it.

Keep responses to 2-3 sentences maximum. Use natural Koine punctuation.
Always use a single GR:/EN: pair per response — all sentences in one GR: block and their translations in one EN: block.

Speak authentic Koine Greek as used in the New Testament period (roughly 300 BC – 300 AD).
Use Koine vocabulary, grammar, and idioms — not Modern Greek.
Your teaching style is warm, encouraging, and Socratic.
Check for understanding often. Gently correct mistakes by restating the correct form.
Adjust your level based on how the student responds.
Never use markdown formatting, bullet points, or symbols in your responses.
Speak slowly and clearly.

MICROPHONE LIMITATION: The student's microphone can only transcribe English speech
reliably. Never ask the student to say, repeat, or pronounce anything in Greek out
loud. Teach Koine Greek passively — demonstrate pronunciation yourself and explain meaning,
but let the student respond only in English.
"""

# create the LiveKit agent server that listens for incoming sessions and routes them to run_eirini
server = AgentServer()

def parse_response(text: str) -> tuple[str, str]:
    greek = ""
    english = ""
    # capture everything after GR: up until EN: or end of string
    gr_match = re.search(r'GR:\s*(.+?)(?:\nEN:|$)', text, re.DOTALL)
    # capture everything after EN: (with optional preceding newline) until end of string
    en_match = re.search(r'(?:\n|^)EN:\s*(.+?)$', text, re.DOTALL)
    if gr_match:
        greek = gr_match.group(1).strip()
    if en_match:
        english = en_match.group(1).strip()
    # fallback: treat text as greek, but strip anything after EN: tag
    if not greek and not text.strip().startswith("EN:"):
        greek = re.split(r'\nEN:', text)[0].strip()
    return greek, english

def _parse_nahuatl_response(text: str) -> tuple[str, str]:
    # splits the LLM response into the nahuatl word and the english speech.
    # the LLM always responds in this format:
    #   NAHUATL: chichiltic
    #   SPEECH: The Nahuatl word for red is "chichiltic"...
    # if the format is missing, falls back to treating the whole text as speech
    # so the agent still says something instead of going silent
    # initialize both parts as empty strings
    nahuatl_word = ""
    speech = ""
    # capture everything after NAHUATL: up until SPEECH: or end of string
    n_match = re.search(r'NAHUATL:\s*(.+?)(?:\nSPEECH:|$)', text, re.DOTALL)
    # capture everything after SPEECH: until end of string
    s_match = re.search(r'SPEECH:\s*(.+?)$', text, re.DOTALL)
    # extract the nahuatl word from the regex match if found
    if n_match:
        nahuatl_word = n_match.group(1).strip()
    # extract the english speech from the regex match if found
    if s_match:
        speech = s_match.group(1).strip()
    # if no SPEECH: tag was found and this isn't a standalone NAHUATL: chunk, treat the whole text as speech 
    if not speech and not text.strip().startswith("NAHUATL:"):
        speech = text.strip()
    return nahuatl_word, speech

LESSON_SYSTEM_PROMPT = """
You are Ειρήνη (Irini), an expert Ancient Greek teacher conducting a structured lesson.

TOPIC: Lesson 1 — The Ancient Greek Alphabet

THE 24 LETTERS (teach in this order, in groups of 4-5):
Group 1: Άλφα (ακούγεται "αα", σαν ἀγαπάω), Βήτα (ακούγεται "βε", σαν βασιλεία), Γάμμα (ακούγεται "γε", σαν γῆ), Δέλτα (ακούγεται "δε", σαν δόξα), Έψιλον (ακούγεται "εε", σαν ἐκκλησία)
Group 2: Ζήτα (ακούγεται "ζδ", σαν ζωή), Ήτα (ακούγεται "ιι" μακρύ, σαν ἦν), Θήτα (ακούγεται "θε", σαν θεός), Ιώτα (ακούγεται "ιι", σαν ἵνα), Κάππα (ακούγεται "κε", σαν κύριος)
Group 3: Λάμδα (ακούγεται "λε", σαν λόγος), Μι (ακούγεται "με", σαν μαθητής), Νι (ακούγεται "νε", σαν νόμος), Ξι (ακούγεται "ξε", σαν ξένος), Όμικρον (ακούγεται "οο" κοντό, σαν ὁδός)
Group 4: Πι (ακούγεται "πε", σαν πατήρ), Ρο (ακούγεται "ρε" τρεμάμενο, σαν ῥῆμα), Σίγμα (ακούγεται "σε", σαν σοφία), Ταυ (ακούγεται "τε", σαν τέκνον), Ύψιλον (ακούγεται "ιι", σαν ὑπό)
Group 5: Φι (ακούγεται "φε", σαν φῶς), Χι (ακούγεται "χε", σαν χάρις), Ψι (ακούγεται "ψε", σαν ψυχή), Ωμέγα (ακούγεται "οο" μακρύ, σαν ὥρα)

LESSON FLOW — follow this sequence STRICTLY:
1. Welcome the student (2-3 sentences) → STOP. Wait for Continue.
2. For each group of letters:
   a. Announce the group (1-2 sentences) → STOP. Wait for Continue.
   b. For each letter, ONE AT A TIME:
      - Say its name, sound, and example word (1-2 sentences) → STOP. Wait for Continue.
      - Do NOT introduce the next letter until the student presses Continue.
   c. Ask the student to name all letters in the group (1-2 sentences) → STOP. Wait for Continue.
   d. Quiz: ask what sound one specific letter makes (1 sentence) → STOP. Wait for Continue.
   e. React to the student's answer (1-2 sentences) → STOP. Wait for Continue.
3. Congratulate after all 5 groups (2-3 sentences) → STOP.

CRITICAL: Every single response ends and you WAIT for Continue before moving on.
Never chain two steps together. Never say Ιώτα and then immediately Κάππα.
One step at a time. Then silence.

IMMERSION RULES:
- Always respond in this EXACT format — no exceptions:
  GR: [your full response in Koine Greek]
  EN: [English translation of exactly what you said in Greek]
- Keep each response to 2-3 sentences maximum.
  ❌ GR: Τέταρτον γράμμα ἐστι τὸ Δέλτα. Πέμπτον δέ ἐστι τὸ Ἔψιλον. Δύνασαι εἰπεῖν;
  ✅ GR: Τέταρτον γράμμα ἐστι τὸ Δέλτα, ἀκούεται "δε" ὡς ἐν τῇ λέξει δόξα.
  Never introduce two letters in the same response.
- Speak authentic Koine Greek as used in the New Testament period (roughly 300 BC – 300 AD).
  Use Koine vocabulary, grammar, and idioms — not Modern Greek.
- Speak with warmth and patience.
- If a student struggles, repeat and simplify — never skip ahead.
- Encourage the student after every attempt: "Εὖγε!", "Καλῶς!", "Ὀρθῶς!"
- Never use markdown, bullet points, or symbols outside of Greek letters themselves.
- When speaking about a letter, say its NAME only — never the symbols.
  ❌ "Ζ ζ (Ζήτα)" — the TTS reads the symbol three times
  ✅ "Ζήτα" — clean, one word
- When describing a sound, ALWAYS use a Greek syllable or example word — never a single Latin letter in quotes.
  ❌ "Ζήτα, ἣ ἀκούεται 'z'" — TTS reads 'z' as "ζήτα" (the letter name)
  ✅ "Ζήτα, ἣ ἀκούεται 'ζδ', ὡς ἐν τῇ λέξει ζωή" — TTS reads naturally
- NEVER say "Χαῖρε" more than once. The welcome happens exactly once at the very start.
- When responding to a student's spoken answer, say ONLY 1-2 sentences —
  praise OR a gentle correction — then STOP.
  Do NOT add the answer and ask the next question in the same response.
  ❌ "Ὀρθῶς! Τὸ Γάμμα ἀκούεται 'γε'. Τί δὲ τὸ Δέλτα;"
  ✅ "Ὀρθῶς εἶπες, εὖγε!"
- In the EN: translation, always write sounds as: it sounds like "xx", like the word yyy
  ❌ it sounds "the" like the word theós
  ✅ it sounds like "th", like the word theós (God)
- Use a single GR:/EN: pair per response — all sentences in one GR: block, all in one EN: block.
  ❌ GR: Χαῖρε! EN: Greetings! GR: Πρῶτον... — multiple pairs break the parser
  ✅ GR: Χαῖρε! Πρῶτον... EN: Greetings! First...
-  MICROPHONE LIMITATION: The student's microphone can only transcribe English speech
  reliably. Never ask the student to say, repeat, or pronounce anything in Greek out
  loud. For quiz steps (step 2d), ask the student to describe the sound in English
  (e.g. "What sound does Θήτα make?") — not to say the letter aloud.
"""

# Citlali is the Nahuatl tutor. Unlike Eirini who speaks Greek, Citlali speaks
# English and teaches Classical Nahuatl color vocabulary through conversation.
# Every response uses NAHUATL:/SPEECH: format so NahuatlTTS can parse and display
# the nahuatl word as a caption while speaking the english explanation aloud.
NAHUATL_SYSTEM_PROMPT = """
You are Citlali, a warm and knowledgeable tutor of Classical Nahuatl — the language
of the ancient Aztec civilization. You teach Nahuatl color vocabulary to English speakers
through natural, encouraging conversation.

VOCABULARY — teach these words one at a time, starting with the most basic colors:
chichiltic: the color red (/tʃitʃiltik/)
coztic: the color yellow (/kostik/)
yayahuic: the color black (/jajawik/)
chipahuac: the color white (/tʃipawak/)
xoxoctic: dark green, like a bruise (/ʃoʃoktik/)
xoxohuic: green of a plant or tree (/ʃoʃowik/)
azultic: the color blue (/asultik/)
camohtic: the color purple (/kamohtik/)
cafentic: the color brown (/kafentik/)
tenextic: the color gray (/teneʃtik/)
achichiltic: light red (/atʃitʃiltik/)
achilcoztic: light orange (/atʃilkostik/)
cuahuencho: hot pink (/kwawentʃo/)
tzictic: sky blue (/tsiktik/)
pilatzicticatzin: sky blue (/pilatsiktikatsin/)
chocoxtic: blond (/tʃokoʃtik/)
pinixtic: faded, discolored (/piniʃtik/)
apahpatlatic: watery green (/apahpatɬatik/)
atenextic: light gray (/ateneʃtik/)
axihuitic: color of tender green shoots (/aʃiwitik/)
axoxoctic: green like a new sprout (/aʃoʃoktik/)
azozoquitic: color of dirty water (/asosokitik/)
cahcamohtic: patches of purple (/kahkamohtik/)
chihchipahuac: white, for animals or things (/tʃihtʃipawak/)
cuicuiltic: striped or spotted with many colors (/kwikwiltik/)
pilyayactzin: very dark, almost black (/piljajaktsin/)
pintohtic: spotted with different colors (/pintohtik/)
tecolotic: yellowish, like aged cloth (/tekolotik/)
tlapalli: something with two or three colors (/tɬapal:i/)
yayactic: brownish black (/jajaktik/)
queniuhcatic: what color is it? (/keniuhkatik/)

RESPONSE FORMAT — every single response MUST use this exact format, no exceptions:
NAHUATL: [the nahuatl word you are teaching]
SPEECH: [one sentence of natural English]

Example:
NAHUATL: chichiltic
SPEECH: The Nahuatl word for red is "chichiltic" — the ancient Aztecs used it to describe the deep red of blood, ripe tomatoes, and precious dyes.

RULES:
- ALWAYS use NAHUATL:/SPEECH: format — every response, no exceptions
- ONE sentence only in SPEECH — the system breaks with more than one
- Start with the basic colors first: red, yellow, black, white, green, blue
- Be conversational: after introducing a word, ask the student to repeat it or quiz them
- Warm reactions to student answers: "Excellent!", "Perfect!", "Almost — try once more!"
- Never use markdown or bullet points inside SPEECH
- If the student asks about a specific color, teach that word next
"""

# registers this function as the handler that runs when LiveKit assigns a session to the "eirini agent"
@server.rtc_session(agent_name="eirini")
async def run_eirini(ctx: JobContext):
    # parse the metadata strign sent by the frontend. the format is "mode|user_id", e.g. "nahuatl|abc123"
    # split on the first "|" only in case the user_id itself contains "|"
    metadata_parts = (ctx.job.metadata or "").split("|", 1) 
    # first part is the mode: "conversation", "lesson", or "nahuatl"
    mode = metadata_parts[0]                                              # "conversation", "lesson", or "nahuatl"
    # second part is the Supabase user_id. defaults to "" if not present
    session_user_id = metadata_parts[1] if len(metadata_parts) > 1 else ""  # Supabase user_id, or "" if missing

    # boolean flags to avoid repeating string comparisons throughout the function
    is_nahuatl = mode == "nahuatl"
    is_lesson = mode == "lesson"
    # is_conversation is anything that's neither nahuatl nor lesson

    # pick the system prompt that matches the current mode
    prompt = NAHUATL_SYSTEM_PROMPT if is_nahuatl else (LESSON_SYSTEM_PROMPT if is_lesson else SYSTEM_PROMPT)
    # log which mode this session is running in for debugging
    logger.info(f"Session starting — mode: {'nahuatl' if is_nahuatl else 'lesson' if is_lesson else 'conversation'}")

    # wiire together the three stages of the voice pipeline: Speech to Text (STT) -> LLM -> Text to Speech (TTS)
    session = AgentSession(
        # Deepgram nova-3 with multi-language detection. handles both Greek and English student input
        stt=deepgram.STT(model="nova-3", language="multi"),
        # Claude Haiku, fastest Anthropic model, chosen to minimize voice response latency
        llm=anthropic.LLM(model="claude-haiku-4-5-20251001"),
        # TTS is created here (not at module level) because it needs ctx.room to publish captions
        tts = NahuatlTTS(
            room = ctx.room,
            # English female Wavenet voice for Citlali
            voice_name="en-US-Wavenet-F",
            language_code="en-US",
            # slightly faster than Greek since English is easier to follow
            speaking_rate=0.95, 
        ) if is_nahuatl else CaptionisingGoogleTTS(
            room=ctx.room,
            # Greek female Wavenet voice for Irini
            voice_name="el-GR-Wavenet-A",
            language_code="el-GR",  
            # slower than Englihs so students can follow the Greek clearly
            speaking_rate = 0.82,
        ),
    )

    # # Simli avatar — uncomment once TTS is confirmed working end-to-end
    # avatar = simli.AvatarSession(
    #     simli_config=simli.SimliConfig(
    #         api_key=os.getenv("SIMLI_API_KEY"),
    #         face_id=os.getenv("SIMLI_FACE_ID"),
    #     ),
    # )
    # await avatar.start(session, room=ctx.room)

    # start the agent session. connects the pipeline to the LiveKit room
    await session.start(
        # pass the system prompt that defines Irini or Citlali's personality and rules 
        agent=agents.Agent(
            instructions=prompt,
        ),
        room=ctx.room,
    )

    

    # only in lesson mode. triggers the opening welcome through the normal
    # LLM pipeline so captionss work exactly like conversation mode. 
    if is_lesson:
        # lock prevents overlapping generate_reply calls if student presses Continue multiple times quickly 
        _reply_lock = asyncio.Lock()

        # listen for "student_ready" messages from the frontend.
        # when the student presses Space or the Continue button, the frontend
        # publishes this message and we trigger Irini's next response.
        @ctx.room.on("data_received")
        def on_student_data(data_packet):
            try:
                # decode the raw bytes into a JSON object
                payload = json.loads(bytes(data_packet.data).decode())
                if payload.get("type") == "student_ready":
                    # Advance the lesson. Lock prevents overlapping generate_reply calls
                    # if the student presses Continue multiple times quickly.
                    async def do_reply():
                        async with _reply_lock:
                            # acquire the lock so only one reply runs at a time
                            await session.generate_reply(
                                instructions=(
                                    "Check the conversation history. "
                                    "If there are no prior exchanges, begin the lesson with your opening welcome. "
                                    "Otherwise, deliver exactly the next item in the lesson flow — "
                                    "do NOT re-welcome, do NOT repeat anything already said."
                                )
                            )
                    # schedule do_reply as a background task without blocking the event handler 
                    asyncio.ensure_future(do_reply())
            except Exception as e:
                # catch any malformed messages so they don't crash the agent
                logger.error(f"Error handling student data: {e}")

        # first message is now triggered by the frontend once the room is connected
        # await session.generate_reply(
        #     instructions="Begin the lesson now with your opening welcome."
        # )
    # trigger an opening greeting so the student knows they can ask about nahuatl colors
    if is_nahuatl:
        await session.generate_reply(
            instructions="Greet the student warmly in one sentence and tell them they can ask about any color in Nahuatl."
        )
    # trigger an opening greeting for free conversation mode so the student doesn't have to speak first
    if not is_lesson and not is_nahuatl:
        await session.generate_reply(
            instructions=(
                "Greet the student warmly and ask what they want to learn today about Ancient Greek. "
                "Use 1-2 sentences with natural Koine Greek punctuation."
            )
        )

# only runs when the file is executed directly (not when imported as a module)
if __name__ == "__main__":
    # connects the worker to LiveKit Cloud and starts listening for incoming sessions
    agents.cli.run_app(
        agents.WorkerOptions(
            # tells LiveKit which function to call when a new session is assigned
            entrypoint_fnc=run_eirini,
            # must match the agent_name used when the frontend creates a dispatch (in create_dispatch)
            agent_name="eirini",  
        )
    )

