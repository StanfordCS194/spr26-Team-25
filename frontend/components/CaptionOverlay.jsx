"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import WordInfoPanel from "./WordInfoPanel";

const CAPTION_DISPLAY_MS = 6000;

// Use an env variable so this works in both dev and production.
// Add NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 to your frontend .env
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";