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
                # no metadata, agent uses SYSTEM_PROMPT (free conversation)
            )
        )

    return {
        "token": token.to_jwt(),
        "url": os.environ["LIVEKIT_URL"],
        "room": room_name,
    }

@router.get("/livekit-token-lesson")
async def get_livekit_token_lesson():
    # generate a unique room and participant name for this lesson session
    # "lesson" prefix distinguishes these rooms from free-conversation rooms
    # in the LiveKit dashboard, making it easy to see which type of session is running
    room_name = f"lesson-{uuid.uuid4().hex[:8]}"
    participant_name = f"student-{uuid.uuid4().hex[:6]}"

    # create a token that lets this participant join the room
    # identical to the conversation token, only the room name changes
    token = AccessToken(
        api_key=os.environ["LIVEKIT_API_KEY"],
        api_secret=os.environ["LIVEKIT_API_SECRET"],
    ).with_identity(participant_name).with_grants(
        VideoGrants(room_join=True, room=room_name)
    )

    # dispatch eirini-lesson instead of eirini. this routes to the
    # run_eirini_lesson handler in agent.py which uses LESSON_SYSTEM_PROMPT
    async with LiveKitAPI(
        url=os.environ["LIVEKIT_URL"],
        api_key=os.environ["LIVEKIT_API_KEY"],
        api_secret=os.environ["LIVEKIT_API_SECRET"],
    ) as lk:
        await lk.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                agent_name="eirini",
                room=room_name,
                metadata="lesson" # signals lesson mode to the agent handler
            )
        )

    return {
        "token": token.to_jwt(),
        "url": os.environ["LIVEKIT_URL"],
        "room": room_name,
    }

@router.get("/livekit-token-nahuatl")
async def get_livekit_token_nahuatl():
    # "nahuatl-" prefix distinguishes these rooms from greek conversation/lesson rooms
    # in the LiveKit dashboard, making it easy to see which type of session is running
    room_name = f"nahuatl-{uuid.uuid4().hex[:8]}"
    participant_name = f"student-{uuid.uuid4().hex[:6]}"

    # create a token that lets this participant join the room
    # identical to the other token endpoints, only the room name and metadata change
    token = AccessToken(
        api_key=os.environ["LIVEKIT_API_KEY"],
        api_secret=os.environ["LIVEKIT_API_SECRET"],
    ).with_identity(participant_name).with_grants(
        VideoGrants(room_join=True, room=room_name)
    )

    # dispatch the eirini agent to this room with metadata="nahuatl"
    # the agent handler in agent.py reads this metadata to select NahuatlTTS
    # and NAHUATL_SYSTEM_PROMPT instead of the greek voice and prompts
    async with LiveKitAPI(
        url=os.environ["LIVEKIT_URL"],
        api_key=os.environ["LIVEKIT_API_KEY"],
        api_secret=os.environ["LIVEKIT_API_SECRET"],
    ) as lk:
        await lk.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                agent_name="eirini",
                room=room_name,
                metadata="nahuatl"  # signals nahuatl mode to run_eirini in agent.py
            )
        )

    return {
        "token": token.to_jwt(),
        "url": os.environ["LIVEKIT_URL"],
        "room": room_name,
    }