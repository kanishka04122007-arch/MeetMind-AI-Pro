import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(override=True)
print("GROQ KEY:", os.getenv("GROQ_API_KEY"), flush=True)

from routes.classifier import router as classifier_router
from routes.auth import router as auth_router
from routes.documents import router as documents_router
from routes.meetings import router as meetings_router
from routes.history import router as history_router

app = FastAPI(
    title="MeetMind AI",
    description="AI-powered Meeting Intelligence & Classification API",
    version="1.0.0"
)

# Enable CORS for local development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(
    auth_router,
    prefix="/api/auth",
    tags=["Authentication"]
)

app.include_router(
    documents_router,
    prefix="/api/documents",
    tags=["Documents & PDF"]
)

app.include_router(
    meetings_router,
    prefix="/api/meetings",
    tags=["Meetings & Audio Transcription"]
)

app.include_router(
    classifier_router,
    prefix="/api/ml",
    tags=["Meeting Classification"]
)

app.include_router(
    history_router,
    prefix="/api/history",
    tags=["Meeting History"]
)

from routes.dashboard import router as dashboard_router, compute_user_stats
app.include_router(
    dashboard_router,
    prefix="/api/dashboard",
    tags=["Dashboard Statistics"]
)

from routes.meetings import (
    generate_summary,
    get_latest_summary,
    SummaryRequest,
    SummaryResponse,
    generate_action_items,
    get_latest_action_items,
    get_action_items_by_meeting_id,
    ActionItemsRequest,
    ActionItemsResponse
)
from fastapi.security import HTTPAuthorizationCredentials
from services.jwt_auth import security, verify_and_decode_token, get_current_user_id
from fastapi import Security, Depends
from typing import Optional

@app.post("/api/summary", response_model=SummaryResponse, tags=["Meeting Summary"])
async def api_summary_endpoint(
    req: SummaryRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    return await generate_summary(req, current_user_id)

@app.get("/api/summary/latest", response_model=SummaryResponse, tags=["Meeting Summary"])
def api_summary_latest_endpoint(current_user_id: str = Depends(get_current_user_id)):
    return get_latest_summary(current_user_id)

@app.get("/api/stats", tags=["Meeting Stats"])
def api_stats_endpoint(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    if credentials and credentials.credentials:
        try:
            payload = verify_and_decode_token(credentials.credentials)
            user_id = payload.get("user_id") or payload.get("sub")
            if user_id:
                return compute_user_stats(str(user_id))
        except Exception:
            pass
    return compute_user_stats("anonymous")

@app.post("/api/action-items", response_model=ActionItemsResponse, tags=["Action Items"])
async def api_action_items_endpoint(
    req: ActionItemsRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    return await generate_action_items(req, current_user_id)

@app.get("/api/action-items/latest", response_model=ActionItemsResponse, tags=["Action Items"])
def api_action_items_latest_endpoint(current_user_id: str = Depends(get_current_user_id)):
    return get_latest_action_items(current_user_id)

@app.get("/api/action-items/{meeting_id}", response_model=ActionItemsResponse, tags=["Action Items"])
def api_action_items_by_id_endpoint(meeting_id: str, current_user_id: str = Depends(get_current_user_id)):
    return get_action_items_by_meeting_id(meeting_id, current_user_id)


@app.get("/", tags=["Health Check"])
def read_root():
    return {
        "status": "healthy",
        "service": "MeetMind AI Backend",
        "version": "1.0.0",
        "endpoints": [
            "/api/auth/login",
            "/api/auth/register",
            "/api/documents/upload",
            "/api/documents/{id}/extract",
            "/api/documents",
            "/api/meetings/upload",
            "/api/meetings/{id}/transcribe",
            "/api/meetings/{id}/summary",
            "/api/meetings/summary",
            "/api/summary",
            "/api/meetings",
            "/api/ml/classify"
        ]
    }

@app.get("/api/health", tags=["Health Check"])
def api_health():
    return {"status": "ok", "message": "MeetMind AI API is healthy and operational"}
