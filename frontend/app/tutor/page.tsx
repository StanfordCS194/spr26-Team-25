'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  VideoTrack,
  useDataChannel,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';

// shape of the token response from our backend
interface LiveKitToken {
  token: string;
  url: string;
  room: string;
}

// shape of caption data sent by the agent over the data channel
interface Caption {
  greek: string;
  english: string;
}

export default function TutorPage() {
  // holds the token and room info needed to connect to LiveKit
  const [tokenData, setTokenData] = useState<LiveKitToken | null>(null);

  // holds an error message if the token fetch fails
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // fetch a fresh token from the backend when the page loads
  // each token is tied to a unique room so every visit starts a new session
  useEffect(() => {
    fetch('https://spr26-team-25-production.up.railway.app/api/livekit-token')
      .then(res => res.json())
      .then(data => setTokenData(data))
      .catch(() => setError('Could not connect to the tutor. Please try again.'));
  }, []);

  // show an error message if the token fetch failed
  if (error) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  // show a loading state while waiting for the token
  if (!tokenData) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-stone-500">Connecting to Ειρήνη...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-900 flex flex-col items-center justify-center">
      {/* back button to return to the text chat */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 text-stone-400 hover:text-white text-sm"
      >
        ← Back to chat
      </button>

      {/* LiveKitRoom manages the WebRTC connection to the LiveKit server.
          It provides all the hooks used inside (useParticipants, useTracks, etc.)
          audio=true lets the student speak. video=false means we don't stream the student's camera. */}
      <LiveKitRoom
        token={tokenData.token}
        serverUrl={tokenData.url}
        connect={true}
        audio={true}
        video={false}
        className="w-full flex flex-col items-center"
      >
        {/* plays all incoming audio automatically, including Ειρήνη's voice */}
        <RoomAudioRenderer />

        {/* avatar video and captions are in a separate component
            because LiveKit hooks only work inside a LiveKitRoom */}
        <AvatarWithCaptions />
      </LiveKitRoom>
    </main>
  );
}

function AvatarWithCaptions() {
  // holds the most recent caption to display under the avatar
  const [caption, setCaption] = useState<Caption | null>(null);

  const participants = useParticipants();

  // useDataChannel listens for messages sent by the agent on the "captions" channel.
  // The agent sends a JSON object with greek and english text each time Ειρήνη speaks.
  useDataChannel('captions', (msg) => {
    try {
      // decode the raw bytes into a string and parse as JSON
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      setCaption(data);
      // clear the captions 4 seconds after the last message so they don't stay on screen forever
      setTimeout(() => setCaption(null), 4000);
    } catch {
      // ignore malformed messages
    }
  });

  // useTracks finds all camera video tracks in the room.
  // Simli publishes the avatar as a camera track so this is how we get the video feed.
  const avatarTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg px-4">
      {/* avatar video area — shows the lip-synced Ειρήνη streamed from Simli */}
      <div className="w-full aspect-video bg-stone-800 rounded-2xl overflow-hidden relative">
        {avatarTracks.length > 0 ? (
          // VideoTrack renders the video stream from Simli into this div
          <VideoTrack
            trackRef={avatarTracks[0]}
            className="w-full h-full object-cover"
          />
        ) : (
          // shown while the avatar is still loading or the agent hasn't joined yet
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-stone-500 text-sm">Waiting for Ειρήνη...</p>
          </div>
        )}
      </div>

      {/* captions area — Greek on top, English below, like YouTube subtitles.
          min-h prevents the layout from shifting when captions appear and disappear. */}
      <div className="w-full min-h-[80px] flex flex-col items-center justify-center text-center px-4">
        {caption ? (
          <>
            <p className="text-white text-xl font-medium">{caption.greek}</p>
            <p className="text-stone-400 text-base mt-1">{caption.english}</p>
          </>
        ) : (
          <p className="text-stone-600 text-sm">Speak to start the lesson</p>
        )}
      </div>
    </div>
  );
}