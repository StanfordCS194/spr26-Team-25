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
        if text.strip().startswith("NAHUATL:") and speech:
            # new word arrived so save it so overflow chunks below can attach to it
            self._pending_nahuatl_word = nahuatl_word
            # calculate how long to show the caption (minimum 4 seconds, 450ms per word)
            word_count = len(speech.split())
            display_ms = max(4000, int(word_count * 450))
            # send the English speech as the caption
            asyncio.ensure_future(self._send_caption(nahuatl_word, speech, display_ms))
        elif self._pending_nahuatl_word and speech:
            # LiveKit's sentence splitter broke the response into multiple chunks
            word_count = len(speech.split())
            display_ms = max(4000, int(word_count * 450))
            asyncio.ensure_future(self._send_caption(self._pending_nahuatl_word, speech, display_ms))

        # speak the English explanation with Spanish-accented voice
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

# QuechuaTTS works the same as CaptionisingGoogleTTS but uses QU:/EN: tags
# and publishes "quechua" + "english" fields to the frontend.
# Since Quechua uses Latin script (not Greek characters), we use a self._in_quechua
# flag instead of _has_greek() to track which sentences to speak aloud.
class QuechuaTTS(GoogleTTS):

    def __init__(self, room: rtc.Room, **kwargs):
        super().__init__(**kwargs)
        self._room = room
        self._quechua_buffer: str = ""
        self._english_buffer: str = ""
        self._in_english: bool = False
        # True between QU: and EN: so continuation sentences are spoken
        self._in_quechua: bool = False
        self._caption_task: asyncio.Task | None = None

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> agents_tts.ChunkedStream:
        logger.info(f"[Quechua] synthesize received: {repr(text)}")
        quechua, english = _parse_quechua_response(text)

        if text.strip().startswith("QU:"):
            # new response — reset all buffers and start accumulating Quechua
            self._quechua_buffer = quechua
            self._english_buffer = ""
            self._in_english = False
            self._in_quechua = True
            if english:
                # QU: and EN: arrived together in one chunk
                self._english_buffer = english
                self._in_english = True
                self._in_quechua = False
                self._schedule_caption()
            else:
                # publish Quechua-only caption immediately so subtitle shows before audio
                asyncio.ensure_future(self._send_partial_caption(quechua))
        elif text.strip().startswith("EN:"):
            # English translation arrived — stop speaking, schedule full caption
            self._english_buffer = english
            self._in_english = True
            self._in_quechua = False
            if self._quechua_buffer:
                self._schedule_caption()
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        elif self._in_english:
            # continuation English sentence. accumulate and reschedule
            self._english_buffer += " " + text.strip()
            self._schedule_caption()
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        elif self._in_quechua and quechua:
            # continuation Quechua sentence. accumulate and speak
            self._quechua_buffer += " " + quechua
            if english:
                self._english_buffer = english
                self._in_english = True
                self._in_quechua = False
                self._schedule_caption()

        # speak the Quechua text if we're in Quechua mode, otherwise stay silent
        if not quechua or not self._in_quechua:
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        return _GoogleTTSStream(tts=self, input_text=quechua, conn_options=conn_options)

    def _schedule_caption(self) -> None:
        # Cancel any in-flight caption task from the previous sentence —
        # we don't want a stale caption to fire after the new one is already showing.
        if self._caption_task and not self._caption_task.done():
            self._caption_task.cancel()

        # Give slower readers more time: 500 ms per word, minimum 4 seconds.
        word_count = len(self._quechua_buffer.split())
        display_ms = max(4000, int(word_count * 500))

        # Fire the full (Quechua + English) caption as a background task.
        # We don't await it here so synthesize() can keep streaming audio
        # while the caption is being assembled and published.
        self._caption_task = asyncio.ensure_future(
            self._send_caption(self._quechua_buffer, display_ms)
        )

    async def _send_partial_caption(self, quechua: str) -> None:
        """Publish Quechua-only caption immediately so subtitle appears before EN: arrives."""
        try:
            # Brief yield so the event loop can flush the audio chunk first —
            # subtitle and audio should feel simultaneous, not subtitle-first.
            await asyncio.sleep(0.1)

            word_count = len(quechua.split())
            display_ms = max(4000, int(word_count * 500))

            # english is empty string — frontend should show a loading state or
            # just the Quechua line until the full caption arrives.
            caption_data = json.dumps({
                "quechua": quechua,
                "english": "",
                "display_ms": display_ms,
            }).encode()
            await self._room.local_participant.publish_data(caption_data, topic="captions")
        except Exception as e:
            logger.error(f"[Quechua] Error publishing partial caption: {e}")

    async def _send_caption(self, quechua: str, display_ms: int) -> None:
        try:
            # Wait long enough for EN: to finish accumulating in _english_buffer
            # before we snapshot it. 350 ms is generous for typical sentence lengths.
            await asyncio.sleep(0.35)

            # Strip any leftover QU:/EN: tag fragments that bled into the buffer —
            # the frontend should only ever receive clean display text.
            clean_english = re.sub(r'\s*(QU:|EN:).*$', '', self._english_buffer, flags=re.DOTALL).strip()

            caption_data = json.dumps({
                "quechua": quechua,
                "english": clean_english,
                "display_ms": display_ms,
            }).encode()
            await self._room.local_participant.publish_data(caption_data, topic="captions")
        except asyncio.CancelledError:
            # _schedule_caption cancelled us because a new sentence arrived —
            # silently discard so the newer caption wins.
            pass

# OldNorseTTS works the same as QuechuaTTS but uses ON:/EN: tags
# and publishes "norse" + "english" fields to the frontend.
# Since Old Norse uses Latin script (not Greek characters), we use a self._in_norse
# flag instead of _has_greek() to track which sentences to speak aloud.
class OldNorseTTS(GoogleTTS):

    def __init__(self, room: rtc.Room, **kwargs):
        # pass all GoogleTTS config (voice, language, rate) up to the parent
        super().__init__(**kwargs)
        # store the room so _send_caption can publish data to the frontend
        self._room = room
        # accumulates all Old Norse sentences in this response before publishing the caption
        self._norse_buffer: str = ""
        # accumulates all english sentences as they arrive after EN:
        self._english_buffer: str = ""
        # True after EN: arrives, so continuation english sentences are caught
        self._in_english: bool = False
        # True between ON: and EN: so continuation sentences are spoken
        self._in_norse: bool = False
        self._caption_task: asyncio.Task | None = None

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> agents_tts.ChunkedStream:
        # log every chunk that arrives so we can debug timing issues
        logger.info(f"[OldNorse] synthesize received: {repr(text)}")
        # split the LLM response into the Old Norse and English parts
        norse, english = _parse_old_norse_response(text)

        if text.strip().startswith("ON:"):
            # new response, reset all buffers and start accumulating Old Norse
            self._norse_buffer = norse
            self._english_buffer = ""
            self._in_english = False
            self._in_norse = True
            if english:
                # ON: and EN: arrived together in one chunk
                self._english_buffer = english
                self._in_english = True
                self._in_norse = False
                self._schedule_caption()
            else:
                # publish Old Norse only caption immediately so subtitle shows before audio
                asyncio.ensure_future(self._send_partial_caption(norse))
        elif text.strip().startswith("EN:"):
            # English translation arrived, stop speaking and schedule full caption
            self._english_buffer = english
            self._in_english = True
            self._in_norse = False
            if self._norse_buffer:
                self._schedule_caption()
            # return silence so the voice does not read out the EN: line
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        elif self._in_english:
            # continuation English sentence, accumulate and reschedule
            self._english_buffer += " " + text.strip()
            self._schedule_caption()
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        elif self._in_norse and norse:
            # continuation Old Norse sentence, accumulate and speak
            self._norse_buffer += " " + norse
            if english:
                # EN: arrived in the same chunk as a continuation Norse sentence
                self._english_buffer = english
                self._in_english = True
                self._in_norse = False
                self._schedule_caption()

        # stay silent if there is no Norse text or we are past the ON: block
        if not norse or not self._in_norse:
            return _GoogleTTSStream(tts=self, input_text=" ", conn_options=conn_options)
        return _GoogleTTSStream(tts=self, input_text=norse, conn_options=conn_options)

    def _schedule_caption(self) -> None:
        # cancel any in-flight caption task so the newest english chunk always wins
        if self._caption_task and not self._caption_task.done():
            self._caption_task.cancel()
        # give slower readers more time: 500ms per word, minimum 4 seconds
        word_count = len(self._norse_buffer.split())
        display_ms = max(4000, int(word_count * 500))
        # fire the full caption as a background task so synthesize() keeps streaming audio
        self._caption_task = asyncio.ensure_future(
            self._send_caption(self._norse_buffer, display_ms)
        )

    async def _send_partial_caption(self, norse: str) -> None:
        # publish Old Norse only caption immediately so subtitle appears before EN: arrives
        try:
            # brief yield so the event loop can flush the audio chunk first
            await asyncio.sleep(0.1)
            word_count = len(norse.split())
            display_ms = max(4000, int(word_count * 500))
            # english is empty string, frontend shows just the Norse line until full caption arrives
            caption_data = json.dumps({
                "norse": norse,
                "english": "",
                "display_ms": display_ms,
            }).encode()
            await self._room.local_participant.publish_data(caption_data, topic="captions")
        except Exception as e:
            logger.error(f"[OldNorse] Error publishing partial caption: {e}")

    async def _send_caption(self, norse: str, display_ms: int) -> None:
        try:
            # wait long enough for EN: to finish accumulating in _english_buffer
            await asyncio.sleep(0.35)
            # strip any leftover ON:/EN: tag fragments that bled into the buffer
            clean_english = re.sub(r'\s*(ON:|EN:).*$', '', self._english_buffer, flags=re.DOTALL).strip()
            caption_data = json.dumps({
                "norse": norse,
                "english": clean_english,
                "display_ms": display_ms,
            }).encode()
            await self._room.local_participant.publish_data(caption_data, topic="captions")
        except asyncio.CancelledError:
            # _schedule_caption cancelled us because a new sentence arrived, expected
            pass


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
    # splits the LLM response into the nahuatl word and English speech.
    # the LLM always responds in this format:
    #   NAHUATL: chichiltic
    #   SPEECH: "Chichiltic" — the ancient Aztecs used this word...
    # if the format is missing, falls back to treating the whole text as speech
    # so the agent still says something instead of going silent
    nahuatl_word = ""
    speech = ""
    # capture everything after NAHUATL: up until SPEECH: or end of string
    n_match = re.search(r'NAHUATL:\s*(.+?)(?:\nSPEECH:|$)', text, re.DOTALL)
    # capture everything after SPEECH: until end of string
    s_match = re.search(r'SPEECH:\s*(.+)', text, re.DOTALL)
    if n_match:
        nahuatl_word = n_match.group(1).strip()
    if s_match:
        speech = s_match.group(1).strip()
    # if no SPEECH: tag was found and this isn't a standalone NAHUATL: chunk, treat the whole text as speech
    if not speech and not text.strip().startswith("NAHUATL:"):
        speech = text.strip()
    return nahuatl_word, speech

def _parse_quechua_response(text: str) -> tuple[str, str]:
    # same pattern as parse_response but uses QU:/EN: tags instead of GR:/EN:
    quechua = ""
    english = ""
    qu_match = re.search(r'QU:\s*(.+?)(?:\nEN:|$)', text, re.DOTALL)
    en_match = re.search(r'(?:\n|^)EN:\s*(.+?)$', text, re.DOTALL)
    if qu_match:
        quechua = qu_match.group(1).strip()
    if en_match:
        english = en_match.group(1).strip()
    # fallback: treat text as quechua if no QU: tag and not starting with EN:
    if not quechua and not text.strip().startswith("EN:"):
        quechua = re.split(r'\nEN:', text)[0].strip()
    return quechua, english

def _parse_old_norse_response(text: str) -> tuple[str, str]:
    # splits the LLM response into the Old Norse text and English translation.
    # the LLM always responds in this format:
    #   ON: Heill! Hvat heitir þú?
    #   EN: Greetings! What is your name?
    # if the format is missing, falls back to treating the whole text as Old Norse
    norse = ""
    english = ""
    # capture everything after ON: up until EN: or end of string
    on_match = re.search(r'ON:\s*(.+?)(?:\nEN:|$)', text, re.DOTALL)
    # capture everything after EN: until end of string
    en_match = re.search(r'(?:\n|^)EN:\s*(.+?)$', text, re.DOTALL)
    if on_match:
        norse = on_match.group(1).strip()
    if en_match:
        english = en_match.group(1).strip()
    # fallback: treat text as Old Norse if no ON: tag and not starting with EN:
    if not norse and not text.strip().startswith("EN:"):
        norse = re.split(r'\nEN:', text)[0].strip()
    return norse, english

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
SPEECH: ["word" — one sentence in English, saying the Nahuatl word first then explaining it]

Example:
NAHUATL: chichiltic
SPEECH: "Chichiltic" — the ancient Aztecs used this word to describe the deep red of blood and ripe tomatoes.

RULES:
- ALWAYS use NAHUATL:/SPEECH: format — every response, no exceptions
- ONE sentence only in SPEECH — the system breaks with more
- Always say the Nahuatl word first at the start of SPEECH, then explain it in English
- Start with the basic colors first: red, yellow, black, white, green, blue
- Be conversational: after introducing a word, ask the student to repeat it or quiz them
- Warm reactions to student answers: "Excellent!", "Perfect!", "Almost — try once more!"
- Never use markdown or bullet points inside SPEECH
- If the student asks about a specific color, teach that word next
- For your very first response, introduce yourself briefly in SPEECH and teach the first color word — never use a Nahuatl greeting word in the NAHUATL: field

"""

QUECHUA_SYSTEM_PROMPT = """
You are Ñusta, a warm and knowledgeable tutor of Ayacucho-Chanka Quechua —
the language of the ancient Inca civilization. You teach Quechua through
natural, encouraging conversation.

You understand English from your students, but you ALWAYS respond in Quechua only.
Your students will read English subtitles separately — never switch to English.

Keep sentences short and clear. Use common, high-frequency words.
Be encouraging and patient. Gently correct mistakes by restating the correct form.

RESPONSE FORMAT — every response MUST use this exact format, no exceptions:
QU: [your response in Quechua]
EN: [English translation of exactly what you said in Quechua]

Example:
QU: Allillanchu! Imatam sutikiyki?
EN: Hello! What is your name?

RULES:
- Always use a single QU:/EN: pair — all sentences in one QU: block, all in one EN: block
- Keep responses to 2-3 sentences maximum
- Never use markdown, bullet points, or symbols inside QU: or EN:
- Never switch to English even if the student speaks English to you
- MICROPHONE LIMITATION: The student's microphone transcribes English reliably.
  Never ask the student to say anything in Quechua out loud.
"""

OLD_NORSE_SYSTEM_PROMPT = """
You are Sigríðr, a warm and knowledgeable tutor of Old Norse — the language
of the Vikings and the Eddic sagas. You teach Old Norse through natural,
encouraging conversation.

You understand English from your students, but you ALWAYS respond in Old Norse only.
Your students will read English subtitles separately — never switch to English.

Keep sentences short and clear. Use common, high-frequency words.
Be encouraging and patient. Gently correct mistakes by restating the correct form.

RESPONSE FORMAT — every response MUST use this exact format, no exceptions:
ON: [your response in Old Norse]
EN: [English translation of exactly what you said in Old Norse]

Example:
ON: Heill! Hvat heitir þú?
EN: Greetings! What is your name?

RULES:
- Always use a single ON:/EN: pair, all sentences in one ON: block, all in one EN: block
- Keep responses to 2-3 sentences maximum
- Never use markdown, bullet points, or symbols inside ON: or EN:
- Never switch to English even if the student speaks English to you
- Use authentic West Norse as found in the Eddic sagas and Heimskringla
- MICROPHONE LIMITATION: The student's microphone transcribes English reliably.
  Never ask the student to say anything in Old Norse out loud.
"""

# registers this function as the handler that runs when LiveKit assigns a session to the "eirini" agent
@server.rtc_session(agent_name="eirini")
async def run_eirini(ctx: JobContext):
    # parse the metadata string sent by the frontend. the format is "mode|user_id", e.g. "nahuatl|abc123"
    # split on the first "|" only in case the user_id itself contains "|"
    metadata_parts = (ctx.job.metadata or "").split("|", 1)
    # first part is the mode: "conversation", "lesson", "nahuatl", or "quechua"
    mode = metadata_parts[0]
    # second part is the Supabase user_id. defaults to "" if not present
    session_user_id = metadata_parts[1] if len(metadata_parts) > 1 else ""

    # boolean flags to avoid repeating string comparisons throughout the function
    is_old_norse = mode == "old_norse"
    is_nahuatl = mode == "nahuatl"
    is_lesson   = mode == "lesson"
    is_quechua  = mode == "quechua"
    # is_conversation is anything that is neither nahuatl, quechua, nor lesson

    # pick the system prompt that matches the current mode
    prompt = (NAHUATL_SYSTEM_PROMPT   if is_nahuatl   else
              QUECHUA_SYSTEM_PROMPT    if is_quechua   else
              OLD_NORSE_SYSTEM_PROMPT  if is_old_norse else
              LESSON_SYSTEM_PROMPT     if is_lesson    else
              SYSTEM_PROMPT)

    # log which mode this session is running in for debugging
    logger.info(f"Session starting — mode: {mode}")

    # wire together the three stages of the voice pipeline: STT -> LLM -> TTS
    session = AgentSession(
        # Deepgram nova-3 with multi-language detection. handles both Greek and English student input
        stt=deepgram.STT(model="nova-3", language="multi"),
        # Claude Haiku, fastest Anthropic model, chosen to minimize voice response latency
        llm=anthropic.LLM(model="claude-haiku-4-5-20251001"),
        # TTS is created here (not at module level) because it needs ctx.room to publish captions.
        # Quechua uses es-US-Standard-A (Spanish phonetics approximate Quechua sounds) at a slower
        # rate since learners need more time to process each syllable.
        tts=(
            OldNorseTTS(
                room=ctx.room,
                # English voice since no Old Norse voice exists on Google TTS
                # British English is the closest phonetically to Old Norse consonants
                # voice_name="en-GB-Wavenet-B",
                # language_code="en-GB",

                # # try German man voice
                # voice_name="de-DE-Wavenet-B",
                # language_code="de-DE",
                
                # try German woman voice
                voice_name="de-DE-Wavenet-C",
                language_code="de-DE",

                # slightly slower than default so students can follow the unfamiliar sounds
                speaking_rate=0.85,
            ) if is_old_norse else
            QuechuaTTS(
                room=ctx.room,
                voice_name="es-US-Standard-A",
                language_code="es-US",
                # slightly slower than Nahuatl — Quechua consonant clusters are harder to follow
                speaking_rate=0.85,
            ) if is_quechua else
            NahuatlTTS(
                room=ctx.room,
                # Spanish phonetics are closer to Nahuatl than any other available voice
                voice_name="es-US-Standard-A",
                language_code="es-US",
                # slightly faster than Greek since English subtitles are easier to follow
                speaking_rate=0.90,
            ) if is_nahuatl else
            CaptionisingGoogleTTS(
                room=ctx.room,
                # Greek female Wavenet voice for Eirini
                voice_name="el-GR-Wavenet-A",
                language_code="el-GR",
                # slower than English so students can follow the Greek clearly
                speaking_rate=0.82,
            )
        ),
    )

    # # Simli avatar — uncomment once TTS is confirmed working end-to-end
    avatar = simli.AvatarSession(
        simli_config=simli.SimliConfig(
            api_key=os.getenv("SIMLI_API_KEY"),
            face_id=os.getenv("SIMLI_FACE_ID"),
        ),
    )
    await avatar.start(session, room=ctx.room)

    # start the agent session. connects the pipeline to the LiveKit room
    await session.start(
        # pass the system prompt that defines Eirini / Citlali / Ñusta's personality and rules
        agent=agents.Agent(instructions=prompt),
        room=ctx.room,
    )

    # only in lesson mode. triggers the opening welcome through the normal
    # LLM pipeline so captions work exactly like conversation mode.
    if is_lesson:
        # lock prevents overlapping generate_reply calls if the student presses Continue multiple times quickly
        _reply_lock = asyncio.Lock()

        # listen for "student_ready" messages from the frontend.
        # when the student presses Space or the Continue button, the frontend
        # publishes this message and we trigger Eirini's next response.
        @ctx.room.on("data_received")
        def on_student_data(data_packet):
            try:
                # decode the raw bytes into a JSON object
                payload = json.loads(bytes(data_packet.data).decode())
                if payload.get("type") == "student_ready":
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
        await session.generate_reply(
            instructions="Begin the lesson now with your opening welcome."
        )

    # trigger an opening greeting so the student knows they can ask about Nahuatl colors
    if is_nahuatl:
        await session.generate_reply(
            instructions="Greet the student warmly in one sentence and tell them they can ask about any color in Nahuatl."
        )

    # trigger an opening greeting for Quechua — Ñusta introduces herself and invites conversation
    if is_quechua:
        await session.generate_reply(
            instructions="Greet the student warmly in Quechua and invite them to practice conversation."
        )

    # trigger an opening greeting for Old Norse, Sigridr introduces herself and invites conversation
    if is_old_norse:
        await session.generate_reply(
            instructions="Greet the student warmly in Old Norse and invite them to practice conversation."
        )

    # trigger an opening greeting for free conversation mode so the student doesn't have to speak first
    if not is_lesson and not is_nahuatl and not is_quechua and not is_old_norse:
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

