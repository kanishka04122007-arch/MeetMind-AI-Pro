from fastapi import APIRouter, HTTPException, status, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import logging
from typing import Optional
from bson import ObjectId

from services.classifier_service import classify_meeting_intelligence, SUPPORTED_CATEGORIES
from database import get_classified_meetings_collection, get_classification_collection, get_summaries_collection, get_extracted_text_collection, get_transcripts_collection
from services.jwt_auth import verify_and_decode_token, get_current_user_id, security

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

class MeetingRequest(BaseModel):
    text: Optional[str] = Field(None, description="Meeting transcript or extracted text to classify")
    summary: Optional[str] = Field(None, description="Meeting summary to classify")
    transcript: Optional[str] = Field(None, description="Audio transcript to classify")
    file_id: Optional[str] = Field(None, description="Linked document or meeting ID")
    title: Optional[str] = Field(None, description="Title of the meeting or document")

class MeetingResponse(BaseModel):
    category: str = Field(..., description="Predicted category from supported taxonomy")
    confidence: int = Field(..., description="Dynamically calculated confidence percentage (e.g. 96)")
    reason: str = Field(..., description="Explanation why the category was selected")
    source: str = Field("Generated from current summary.", description="Attribution source")
    id: Optional[str] = Field(None, description="MongoDB generated document ID")
    created_at: Optional[str] = Field(None, description="Timestamp when classification was recorded")
    title: Optional[str] = Field(None, description="Title of the classified document")

@router.post(
    "/classify",
    response_model=MeetingResponse,
    status_code=status.HTTP_200_OK,
    summary="Classify and save meeting transcript with dynamic confidence and reason",
    description="Analyzes summary or transcript using Groq NLP intelligence, predicts category, calculates confidence %, writes reason, and stores into MongoDB classification collection."
)
def classify(
    request: MeetingRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    user_id = str(current_user_id).strip()
    user_match = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }

    content = (request.summary or request.text or request.transcript or "").strip()
    title = (request.title or "").strip()
    file_id = (request.file_id or "").strip()
    source = "Generated from current summary."

    # If content is missing, automatically load active content from MongoDB for THIS user
    if not content:
        summaries_col = get_summaries_collection()
        latest_summary = summaries_col.find_one(user_match, sort=[("_id", -1)])
        if latest_summary and latest_summary.get("summary"):
            content = latest_summary["summary"]
            title = title or latest_summary.get("title", "")
            file_id = file_id or str(latest_summary.get("meeting_id", ""))
            source = "Generated from current summary."

    if not content:
        ext_col = get_extracted_text_collection()
        latest_ext = ext_col.find_one(user_match, sort=[("_id", -1)])
        if latest_ext and latest_ext.get("text"):
            content = latest_ext["text"]
            title = title or latest_ext.get("fileName", "")
            file_id = file_id or str(latest_ext.get("_id", ""))
            source = "Generated from extracted document text."

    if not content:
        trans_col = get_transcripts_collection()
        latest_tr = trans_col.find_one(user_match, sort=[("_id", -1)])
        if latest_tr and latest_tr.get("transcript"):
            content = latest_tr["transcript"]
            title = title or latest_tr.get("fileName", "")
            file_id = file_id or str(latest_tr.get("_id", ""))
            source = "Generated from audio transcript."

    if not content or len(content.strip()) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No document text, transcript, or summary available to classify. Please upload a PDF or Audio recording first."
        )

    # Step 1: Run AI / NLP prediction to get category, dynamic confidence %, and explanatory reason
    try:
        category, confidence, reason = classify_meeting_intelligence(content, title=title)
    except Exception as err:
        logger.error(f"[classifier] Classification failed: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification failed: {str(err)}"
        )

    # Step 2: Persist into MongoDB collections 'classification' and 'classified_meetings' with user_id
    created_at = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user_id,
        "category": category,
        "confidence": confidence,
        "reason": reason,
        "source": source,
        "title": title or "Executive Document Session",
        "file_id": file_id,
        "content_excerpt": content[:1200],
        "created_at": created_at
    }

    inserted_id = None
    try:
        class_col = get_classification_collection()
        res = class_col.insert_one(record)
        inserted_id = str(res.inserted_id)

        # Also mirror to classified_meetings for schema compatibility
        get_classified_meetings_collection().insert_one({
            "user_id": user_id,
            "transcript": content[:2000],
            "category": category,
            "confidence": confidence,
            "reason": reason,
            "created_at": created_at
        })
        logger.info(f"[classifier] Saved classification record {inserted_id} into MongoDB for user {user_id}: {category} ({confidence}%)")
    except Exception as db_err:
        logger.warning(f"[classifier] Could not persist classification to MongoDB: {db_err}")

    return MeetingResponse(
        category=category,
        confidence=confidence,
        reason=reason,
        source=source,
        id=inserted_id,
        created_at=created_at,
        title=title or "Executive Document Session"
    )

@router.get(
    "/classify/latest",
    response_model=MeetingResponse,
    status_code=status.HTTP_200_OK,
    summary="Get latest meeting classification from MongoDB for authenticated user"
)
def get_latest_classification(current_user_id: str = Depends(get_current_user_id)):
    user_id = str(current_user_id).strip()
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No classification records found in database."
        )

    user_match = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }

    class_col = get_classification_collection()
    doc = class_col.find_one(user_match, sort=[("_id", -1)])
    if not doc:
        # Check classified_meetings fallback
        cm_col = get_classified_meetings_collection()
        doc = cm_col.find_one(user_match, sort=[("_id", -1)])

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No classification records found in database."
        )

    return MeetingResponse(
        category=doc.get("category", "Educational"),
        confidence=int(doc.get("confidence", 95)),
        reason=doc.get("reason", "Content classified based on detected course notes and technical keywords."),
        source=doc.get("source", "Generated from current summary."),
        id=str(doc.get("_id", "")),
        created_at=doc.get("created_at"),
        title=doc.get("title")
    )

