import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger("uvicorn.error")


env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path, override=True)
else:
    load_dotenv(override=True)
print("GROQ KEY:", "SET" if os.getenv("GROQ_API_KEY") else "MISSING", flush=True)

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

# CORS configuration supporting localhost:5174, localhost:5173, and Render domains
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
    "https://meetmind-ai-pro.onrender.com",
]

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    clean_front = frontend_url.strip().rstrip("/")
    if clean_front not in allowed_origins:
        allowed_origins.append(clean_front)

cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    for o in cors_origins_env.split(","):
        clean_o = o.strip().rstrip("/")
        if clean_o and clean_o not in allowed_origins:
            allowed_origins.append(clean_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "type": type(exc).__name__,
            "path": str(request.url.path)
        },
        headers={
            "Access-Control-Allow-Origin": origin if origin else "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

