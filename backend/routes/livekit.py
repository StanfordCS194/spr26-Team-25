import os
import uuid
from fastapi import APIRouter
from livekit.api import AccessToken, VideoGrants, LiveKitAPI, CreateAgentDispatchRequest

router = APIRouter()

@router.get("/livekit-token")
async def get_livekit_token():
    # generate a unique room and participant name for this session
    room_name = f"tutor-{uuid.uuid4().hex[:8]}"
    participant_name = f"student-{uuid.uuid4().hex[:6]}"

    # create a token that lets this participant join the room
    token = AccessToken(
        api_key=os.environ["LIVEKIT_API_KEY"],
        api_secret=os.environ["LIVEKIT_API_SECRET"],
    ).with_identity(participant_name).with_grants(
        VideoGrants(room_join=True, room=room_name)
    )

    # tell the LiveKit server to dispatch the agent to this room
    async with LiveKitAPI(
        url=os.environ["LIVEKIT_URL"],
        api_key=os.environ["LIVEKIT_API_KEY"],
        api_secret=os.environ["LIVEKIT_API_SECRET"],
    ) as lk:
        await lk.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                agent_name="eirini",
                room=room_name,
            )
        )

    return {
        "token": token.to_jwt(),
        "url": os.environ["LIVEKIT_URL"],
        "room": room_name,
    }