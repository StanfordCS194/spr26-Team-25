from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from routes.chat import router as chat_router
from routes.livekit import router as livekit_router # generates LiveKit tokens for the voice tutor
from routes.quechua_info import router as quechua_info_router
from routes.chat_packs import router as chat_packs_router  # NEW: pack based chat for non-Greek languages. for language packs
from supabase import create_client
import os

from routes.word_info import router as word_info_router

app = FastAPI(title="Chronos API")

# CORSMiddleware allows the frontend on Vercel to make HTTP requests to this backend (on Railway). Without this, browsers
# block cross-origin requests automatically. 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # allows any domain to call this API , change in future to actual frontend URL 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# register chat routes defined in routes/chat.py. All endpoints will be accessible under /api prefix
# e.g., /api/cht instead of just /chat
app.include_router(chat_router, prefix="/api")

# register LiveKit routes: voice tutor token generation
app.include_router(livekit_router, prefix="/api")

# register word info routes defined in routes/word_info.py. 
app.include_router(word_info_router, prefix="/api")

# register word info routes defined in routes/quechua_info.py
app.include_router(quechua_info_router, prefix="/api")

# register language pack based chat routes defined in routes/chat_packs.py
# accessible at /api/chat-packs, handles non-Greek languages like Ojibwe
app.include_router(chat_packs_router, prefix="/api")  # NEW

# initializes the Supabase client using the environment variables stored in Railway (backend). 
# os.environ["SUPABASE_URL"] reads the variable named "SUPABASE_URL" from te environment, which is safer than 
# hardcoding secrets directly in the code 
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

# Pydantic model that defines the shape of the request body for the onboarding endpoint.
# FastAPI uses this to automatically validate incoming JSON. If any field is missing or the wrong type,
# it returns a 422 error before our code even runs. 
class OnboardingResponse(BaseModel):
    experience: str      # e.g. "No, complete beginner"
    goal: str            # e.g. "Read philosophy (Plato, Aristotle)"
    time_commitment: str # e.g. "30–60 minutes"

# POST /onboarding is called by the front end when a user finishes the onboarding process.
# This saves their 3 answers to the onboarding_responses table in Supabase so that we can analyze
# what kinds of users are signing up (for the Customer Discovery assignment)
@app.post("/onboarding")
async def save_onboarding(data: OnboardingResponse):
    supabase.table("onboarding_responses").insert({
        "experience": data.experience,
        "goal": data.goal,
        "time_commitment": data.time_commitment,
        # note: we don't need to pass "id" or "created_at" —
        # Supabase fills those in automatically via DEFAULT values in the table schema
    }).execute()
    return {"status": "ok"}

# Health check endpoint. Railway and other platforms ping GET / to verify that the server is running. 
# Additionally useful to confirm a successful deploy. 
@app.get("/")
def root():
    return {"message": "Chronos API is running"}