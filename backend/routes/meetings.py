import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends, Security
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from bson import ObjectId

from database import (
    get_db,
    get_files_collection,
    get_transcripts_collection,
    get_meetings_collection,
    get_summaries_collection,
    get_action_items_collection,
    get_extracted_text_collection,
    get_documents_collection
)
from services.jwt_auth import get_current_user_id, verify_and_decode_token, security
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "audio")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4"}

MIME_TYPE_MAPPING = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/x-m4a",
    ".mp4": "video/mp4"
}

class AudioUploadResponse(BaseModel):
    message: str = "Audio uploaded successfully"
    file_id: str
    filename: str
    status: str = "uploaded"
    # Backward compatibility fields for frontend UI:
    id: Optional[str] = None
    _id: Optional[str] = None
    fileName: Optional[str] = None
    title: Optional[str] = None

class MeetingAudioItemResponse(BaseModel):
    id: str
    _id: str
    title: str
    fileName: str
    file_path: Optional[str] = None
    status: str = "uploaded"
    created_at: Optional[str] = None

@router.post(
    "/upload",
    response_model=AudioUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload audio file and store metadata in MongoDB 'files' collection",
    description="Accepts MP3, WAV, M4A, or MP4 file, saves physical file under backend/uploads/audio/, and stores metadata into MongoDB 'files' collection."
)
async def upload_audio(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user_id: str = Depends(get_current_user_id)
):
    print("AUDIO UPLOAD STARTED", flush=True)

    # Validate file extension
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Only MP3, WAV, M4A, and MP4 are supported."
        )

    # Determine content-type / MIME
    content_type = file.content_type
    if not content_type or content_type == "application/octet-stream":
        content_type = MIME_TYPE_MAPPING.get(ext, "audio/mpeg")

    # Generate unique stored filename using UUID
    unique_stored_filename = f"{uuid.uuid4()}-{file.filename}"
    physical_path = os.path.join(UPLOAD_DIR, unique_stored_filename)
    relative_path = f"uploads/audio/{unique_stored_filename}"

    # Save physical audio file to disk
    try:
        file_content = await file.read()
        with open(physical_path, "wb") as f:
            f.write(file_content)
        print(f"FILE SAVED: {physical_path}", flush=True)
    except Exception as save_err:
        logger.error(f"Failed to write audio file to disk: {save_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file on disk: {str(save_err)}"
        )

    # Insert file metadata into MongoDB 'files' collection
    print("MONGODB INSERT STARTED", flush=True)
    now_iso = datetime.now(timezone.utc).isoformat()

    file_document = {
        "user_id": current_user_id,
        "original_filename": file.filename,
        "stored_filename": unique_stored_filename,
        "file_type": "audio",
        "content_type": content_type,
        "file_path": relative_path,
        "status": "uploaded",
        "created_at": now_iso,
        # Backward-compatibility fields:
        "fileName": file.filename,
        "filename": file.filename,
        "fileType": "audio",
        "uploadedAt": now_iso,
        "title": title or file.filename
    }

    try:
        files_col = get_files_collection()
        insert_result = files_col.insert_one(file_document)
        inserted_id = str(insert_result.inserted_id)
        print(f"MONGODB INSERT SUCCESS: {inserted_id}", flush=True)
    except Exception as db_err:
        print(f"MONGODB INSERT FAILED: {str(db_err)}", flush=True)
        logger.error(f"MongoDB insert failed: {db_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database insertion failed: {str(db_err)}"
        )

    return AudioUploadResponse(
        message="Audio uploaded successfully",
        file_id=inserted_id,
        filename=file.filename,
        status="uploaded",
        id=inserted_id,
        _id=inserted_id,
        fileName=file.filename,
        title=title or file.filename
    )

@router.get("", response_model=List[MeetingAudioItemResponse])
@router.get("/", response_model=List[MeetingAudioItemResponse])
def list_audio_files(current_user_id: str = Depends(get_current_user_id)):
    """
    List audio files uploaded by the authenticated user from MongoDB 'files' collection.
    """
    files_col = get_files_collection()
    results = []
    user_id_str = str(current_user_id).strip()
    user_match = {
        "$or": [
            {"user_id": user_id_str},
            {"user_id": ObjectId(user_id_str)} if ObjectId.is_valid(user_id_str) else {"user_id": user_id_str}
        ]
    }
    query = {
        "$and": [
            user_match,
            {
                "$or": [
                    {"file_type": "audio"},
                    {"fileType": "audio"},
                    {"fileName": {"$regex": r"\.(mp3|wav|m4a|mp4)$", "$options": "i"}},
                    {"filename": {"$regex": r"\.(mp3|wav|m4a|mp4)$", "$options": "i"}}
                ]
            }
        ]
    }
    for f in files_col.find(query).sort("created_at", -1).limit(25):
        f_id = str(f["_id"])
        results.append(MeetingAudioItemResponse(
            id=f_id,
            _id=f_id,
            title=f.get("title", f.get("original_filename", f.get("fileName", "Audio File"))),
            fileName=f.get("original_filename", f.get("fileName", "audio.mp3")),
            file_path=f.get("file_path", ""),
            status=f.get("status", "uploaded"),
            created_at=f.get("created_at", f.get("uploadedAt", ""))
        ))
    return results

class TranscribeResponse(BaseModel):
    message: str = "Transcript generated successfully"
    file_id: str
    transcript_text: str
    transcript: Optional[str] = None
    duration: Optional[float] = 0.0
    status: str = "completed"

_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            _whisper_model = whisper.load_model("base")
        except Exception as e:
            logger.warning(f"Could not load Whisper model: {e}")
            _whisper_model = None
    return _whisper_model

@router.post(
    "/{file_id}/transcribe",
    response_model=TranscribeResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate transcript for uploaded audio file using Whisper AI",
    description="Loads audio corresponding to file_id, transcribes with Whisper AI, and persists transcript in MongoDB."
)
async def transcribe_audio(
    file_id: str,
    current_user_id: str = Depends(get_current_user_id)
):
    user_id = str(current_user_id).strip()
    user_match = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }

    files_col = get_files_collection()
    transcripts_col = get_transcripts_collection()
    meetings_col = get_meetings_collection()

    file_doc = None
    try:
        file_doc = files_col.find_one({"$and": [{"_id": ObjectId(file_id)}, user_match]})
    except Exception:
        pass

    if not file_doc:
        file_doc = files_col.find_one({"$and": [{"id": file_id}, user_match]})
    if not file_doc:
        file_doc = files_col.find_one({"$and": [{"file_id": file_id}, user_match]})
    if not file_doc:
        file_doc = meetings_col.find_one({"$and": [{"_id": file_id}, user_match]})

    if not file_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file record with ID '{file_id}' not found."
        )

    # Return cached transcript if already generated
    cached_text = file_doc.get("transcript_text") or file_doc.get("transcript")
    if cached_text:
        return TranscribeResponse(
            message="Transcript generated successfully",
            file_id=file_id,
            transcript_text=cached_text,
            transcript=cached_text,
            duration=file_doc.get("duration", 0.0),
            status="completed"
        )

    # Locate audio file on disk
    physical_path = None
    file_path = file_doc.get("file_path")
    if file_path:
        if os.path.isabs(file_path) and os.path.exists(file_path):
            physical_path = file_path
        elif os.path.exists(os.path.join(BASE_DIR, file_path)):
            physical_path = os.path.join(BASE_DIR, file_path)

    if not physical_path:
        stored_filename = file_doc.get("stored_filename")
        if stored_filename:
            candidate = os.path.join(UPLOAD_DIR, stored_filename)
            if os.path.exists(candidate):
                physical_path = candidate

    if not physical_path or not os.path.exists(physical_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical audio file was not found on server disk."
        )

    transcript_text = ""
    duration = 0.0

    try:
        model = get_whisper_model()
        if model is not None:
            transcribe_res = model.transcribe(physical_path, fp16=False)
            transcript_text = transcribe_res.get("text", "").strip()
    except Exception as whisper_err:
        logger.error(f"Whisper transcription failed: {whisper_err}", exc_info=True)

    # If audio contains no detected speech:
    if not transcript_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No speech could be detected in the uploaded audio file."
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    # Update in 'files' collection
    files_col.update_one(
        {"_id": file_doc["_id"]},
        {"$set": {
            "transcript": transcript_text,
            "transcript_text": transcript_text,
            "status": "completed",
            "transcribed_at": now_iso
        }}
    )

    # Record in 'transcripts' collection
    clean_user_id = str(user_id or file_doc.get("user_id") or "").strip()
    filename = file_doc.get("fileName") or file_doc.get("original_filename") or file_doc.get("filename") or "audio.mp3"
    transcripts_col.insert_one({
        "file_id": file_id,
        "fileName": filename,
        "transcript": transcript_text,
        "createdAt": now_iso,
        "user_id": clean_user_id
    })

    # Record/update in 'meetings' collection
    meetings_col.update_one(
        {"_id": str(file_doc["_id"])},
        {"$set": {
            "file_id": file_id,
            "user_id": clean_user_id,
            "title": file_doc.get("title", filename),
            "filename": filename,
            "file_path": physical_path,
            "status": "completed",
            "transcript_text": transcript_text,
            "duration": duration,
            "updated_at": now_iso
        }},
        upsert=True
    )

    return TranscribeResponse(
        message="Transcript generated successfully",
        file_id=file_id,
        transcript_text=transcript_text,
        transcript=transcript_text,
        duration=duration,
        status="completed"
    )

class SummaryRequest(BaseModel):
    file_id: Optional[str] = None
    transcript_text: Optional[str] = None
    transcript: Optional[str] = None
    text: Optional[str] = None
    title: Optional[str] = None

class SummaryResponse(BaseModel):
    message: str = "Summary generated successfully"
    file_id: Optional[str] = None
    meeting_id: Optional[str] = None
    source_type: str = "pdf"
    source_text: Optional[str] = None
    title: Optional[str] = None
    summary: str
    key_points: List[str]
    word_count: int = 0
    created_at: Optional[str] = None
    status: str = "completed"

class ActionItemModel(BaseModel):
    task: str
    priority: str = "High"
    owner: str = "Student"

class ActionItemsRequest(BaseModel):
    summary: Optional[str] = None
    meeting_id: Optional[str] = None
    title: Optional[str] = None
    transcript_text: Optional[str] = None

class ActionItemsResponse(BaseModel):
    message: str = "Action items generated successfully"
    meeting_id: Optional[str] = None
    tasks: List[ActionItemModel]
    count: int = 0
    created_at: Optional[str] = None
    source: str = "Generated from current meeting summary"
    title: Optional[str] = None

def generate_groq_summary(content: str, title: Optional[str] = None) -> Optional[tuple[str, List[str]]]:
    """
    Calls Groq API to generate a professional, structured executive summary
    STRICTLY derived from the uploaded document text or transcript.
    """
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not groq_api_key:
        print("[GROQ] ERROR: GROQ_API_KEY is not set in .env", flush=True)
        return None

    words = content.split()
    print("--------------------------------------------------", flush=True)
    print("Calling Groq API...", flush=True)
    print("Document title:", title or "Untitled Document", flush=True)
    print("Word count:", len(words), flush=True)
    print("First 200 characters:", repr(content[:200]), flush=True)
    print("--------------------------------------------------", flush=True)

    system_prompt = (
        "You are an expert AI document and meeting intelligence analyst.\n"
        "Generate a professional, structured executive summary STRICTLY and EXCLUSIVELY based on the provided document content.\n"
        "Format each section header with markdown: ### 1. Executive Overview, ### 2. Key Discussion Points, ### 3. Important Decisions, ### 4. Technical Topics, ### 5. Risks and Challenges, ### 6. Next Steps.\n"
        "Under sections 2 to 6, use bullet points (• ) for each distinct insight.\n"
        "Strict Rule: Do NOT invent, assume, or inject external topics, technologies, or generic filler. All facts must come directly from the document."
    )

    user_prompt = f"""Summarize the following document.

Document Content:
{content[:14000]}

Generate:
1. Executive Overview
2. Key Discussion Points
3. Important Decisions
4. Technical Topics
5. Risks and Challenges
6. Next Steps
"""

    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }

    # Models requested: GPT OSS 120B, GPT OSS 20B, Qwen 3.8 27B
    candidate_models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

    import requests

    for model_name in candidate_models:
        try:
            print(f"[GROQ] Attempting summarization with model: {model_name}...", flush=True)
            body = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 1500
            }

            resp = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=body, timeout=45)
            if resp.status_code == 200:
                result = resp.json()
                summary_text = result["choices"][0]["message"]["content"].strip()
                print(f"[GROQ] Successfully generated summary with model: {model_name}", flush=True)
                print(f"[GROQ] Output word count: {len(summary_text.split())}", flush=True)

                # Extract bullet lines as key points
                lines = [line.strip().lstrip("-*•0123456789. ") for line in summary_text.splitlines() if line.strip().startswith(("-", "*", "•"))]
                points = [l for l in lines if len(l) > 10][:10]
                if not points:
                    points = [p.strip() for p in summary_text.split("\n\n") if len(p.strip()) > 15][:6]
                return summary_text, points
            else:
                print(f"[GROQ] Model {model_name} returned {resp.status_code}: {resp.text[:120]}", flush=True)
        except Exception as e:
            print(f"[GROQ] Request error for {model_name}: {e}", flush=True)

    return None

@router.post(
    "/summary",
    response_model=SummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate summary from latest PDF/Audio content using Groq AI and persist in MongoDB"
)
async def generate_summary(
    req: SummaryRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    user_id = str(current_user_id).strip()
    user_match = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }

    from services.ocr_service import is_placeholder_text

    files_col = get_files_collection()
    meetings_col = get_meetings_collection()
    summaries_col = get_summaries_collection()
    extracted_col = get_extracted_text_collection()
    transcripts_col = get_transcripts_collection()
    docs_col = get_documents_collection()

    transcript_text = req.transcript_text or req.text or req.transcript or ""
    if is_placeholder_text(transcript_text):
        transcript_text = ""

    title = req.title
    file_id = req.file_id
    source_type = "pdf"

    # Step 1: If file_id is provided and text is missing, search matching MongoDB records for this user
    if file_id and not transcript_text:
        # Check extracted_text collection
        doc = None
        try:
            doc = extracted_col.find_one({"$and": [{"$or": [{"_id": ObjectId(file_id) if ObjectId.is_valid(file_id) else None}, {"file_id": file_id}, {"id": file_id}]}, user_match]})
        except Exception:
            pass
        if doc and doc.get("text") and not is_placeholder_text(doc.get("text")):
            transcript_text = doc["text"]
            source_type = "pdf"
            title = title or doc.get("fileName") or "Document Text"

        # Check documents collection
        if not transcript_text:
            try:
                doc = docs_col.find_one({"$and": [{"$or": [{"_id": ObjectId(file_id) if ObjectId.is_valid(file_id) else None}, {"id": file_id}]}, user_match]})
            except Exception:
                pass
            if doc:
                t = doc.get("extracted_text") or doc.get("text") or doc.get("content") or ""
                if t and not is_placeholder_text(t):
                    transcript_text = t
                    source_type = "pdf"
                    title = title or doc.get("title") or doc.get("fileName")
                elif doc.get("file_path") and os.path.exists(doc.get("file_path")):
                    from services.ocr_service import extract_ocr_from_pdf
                    try:
                        ocr_t, _, _, _ = extract_ocr_from_pdf(doc["file_path"])
                        if ocr_t:
                            transcript_text = ocr_t
                            source_type = "pdf"
                            title = title or doc.get("title") or doc.get("fileName")
                    except Exception as e:
                        logger.warning(f"Could not OCR document for summary: {e}")

        # Check transcripts collection
        if not transcript_text:
            try:
                tr = transcripts_col.find_one({"$and": [{"$or": [{"_id": ObjectId(file_id) if ObjectId.is_valid(file_id) else None}, {"file_id": file_id}]}, user_match]})
            except Exception:
                pass
            if tr and tr.get("transcript"):
                transcript_text = tr["transcript"]
                source_type = "audio"
                title = title or tr.get("fileName") or "Audio Transcript"

        # Check files & meetings collection
        if not transcript_text:
            try:
                f = files_col.find_one({"$and": [{"$or": [{"_id": ObjectId(file_id) if ObjectId.is_valid(file_id) else None}, {"id": file_id}]}, user_match]})
            except Exception:
                pass
            if f:
                t = f.get("transcript_text") or f.get("transcript") or f.get("extracted_text") or ""
                if t and not is_placeholder_text(t):
                    transcript_text = t
                    source_type = "audio" if f.get("file_type") == "audio" or f.get("fileType") == "audio" else "pdf"
                    title = title or f.get("title") or f.get("fileName")

    # Step 2: AUTOMATICALLY FETCH LATEST CONTENT FROM MONGODB IF STILL MISSING (SCOPED TO USER)
    if not transcript_text or len(transcript_text.strip()) < 5:
        # Priority 1: Check latest extracted PDF text from MongoDB for THIS user
        for p in extracted_col.find(user_match).sort([("_id", -1)]).limit(10):
            t = p.get("text") or ""
            if t and not is_placeholder_text(t) and len(t.strip()) > 20:
                transcript_text = t
                source_type = "pdf"
                title = title or p.get("fileName") or "Uploaded PDF Document"
                file_id = file_id or str(p["_id"])
                break

        # Priority 2: Check latest document from documents collection for THIS user
        if not transcript_text:
            for d in docs_col.find(user_match).sort([("_id", -1)]).limit(10):
                t = d.get("extracted_text") or d.get("text") or d.get("content") or ""
                if t and not is_placeholder_text(t) and len(t.strip()) > 20:
                    transcript_text = t
                    source_type = "pdf"
                    title = title or d.get("title") or d.get("fileName")
                    file_id = file_id or str(d["_id"])
                    break
                elif d.get("file_path") and os.path.exists(d.get("file_path")):
                    from services.ocr_service import extract_ocr_from_pdf
                    try:
                        ocr_t, _, _, _ = extract_ocr_from_pdf(d["file_path"])
                        if ocr_t:
                            transcript_text = ocr_t
                            source_type = "pdf"
                            title = title or d.get("title") or d.get("fileName")
                            file_id = file_id or str(d["_id"])
                            break
                    except Exception:
                        pass

        # Priority 3: Check latest transcript from transcripts collection for THIS user
        if not transcript_text:
            latest_tr = transcripts_col.find_one(user_match, sort=[("_id", -1)])
            if latest_tr and latest_tr.get("transcript") and len(latest_tr["transcript"].strip()) > 10:
                transcript_text = latest_tr["transcript"]
                source_type = "audio"
                title = title or latest_tr.get("fileName") or "Audio Recording"
                file_id = file_id or str(latest_tr["_id"])

    # If no text found anywhere, do NOT use fake fallback!
    if not transcript_text or len(transcript_text.strip()) < 5:
        raise HTTPException(
            status_code=400,
            detail="No document text or transcript available in database. Please upload a PDF or Audio recording first."
        )

    # Step 3: Run AI Summarization strictly via Groq API
    groq_result = generate_groq_summary(transcript_text, title=title)
    if not groq_result:
        raise HTTPException(
            status_code=502,
            detail="Unable to generate AI summary using Groq models. Please try again."
        )

    formatted_summary, key_points = groq_result

    now_iso = datetime.now(timezone.utc).isoformat()
    word_count = len(formatted_summary.split())
    effective_meeting_id = str(file_id or ObjectId())

    # Step 4: Persist in MongoDB 'summaries' collection with user_id
    summary_record = {
        "meeting_id": effective_meeting_id,
        "source_type": source_type,
        "title": title or "Executive Meeting Summary",
        "summary": formatted_summary,
        "key_points": key_points,
        "source_text": transcript_text[:5000],
        "word_count": word_count,
        "created_at": now_iso,
        "user_id": user_id
    }

    try:
        summaries_col.insert_one(summary_record)
        logger.info(f"Summary successfully saved into MongoDB 'summaries' for user {user_id}, meeting_id: {effective_meeting_id}")
    except Exception as e:
        logger.warning(f"Could not persist summary to MongoDB: {e}")

    # Also update file or meeting record if file_id exists
    if file_id:
        try:
            if ObjectId.is_valid(file_id):
                files_col.update_one({"$and": [{"_id": ObjectId(file_id)}, user_match]}, {"$set": {"summary": formatted_summary, "summarized_at": now_iso}})
            else:
                files_col.update_one({"$and": [{"id": file_id}, user_match]}, {"$set": {"summary": formatted_summary, "summarized_at": now_iso}})
        except Exception:
            pass

    return SummaryResponse(
        message="Summary generated successfully",
        file_id=effective_meeting_id,
        meeting_id=effective_meeting_id,
        source_type=source_type,
        source_text=transcript_text,
        title=title or "Executive Meeting Summary",
        summary=formatted_summary,
        key_points=key_points,
        word_count=word_count,
        created_at=now_iso,
        status="completed"
    )

@router.get(
    "/summary/latest",
    response_model=SummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get latest AI summary for the authenticated user"
)
def get_latest_summary(current_user_id: str = Depends(get_current_user_id)):
    user_id = str(current_user_id).strip()
    user_filter = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }
    summaries_col = get_summaries_collection()
    doc = summaries_col.find_one(user_filter, sort=[("_id", -1)])
    if not doc or not doc.get("summary"):
        raise HTTPException(status_code=404, detail="No summaries found in database")
    return SummaryResponse(
        message="Latest summary retrieved",
        file_id=str(doc.get("meeting_id", "")),
        meeting_id=str(doc.get("meeting_id", "")),
        source_type=doc.get("source_type", "pdf"),
        source_text=doc.get("source_text", ""),
        title=doc.get("title", "Executive Meeting Summary"),
        summary=doc.get("summary", ""),
        key_points=doc.get("key_points", []),
        word_count=doc.get("word_count", 0),
        created_at=doc.get("created_at"),
        status="completed"
    )

@router.post(
    "/{file_id}/summary",
    response_model=SummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate summary for specific meeting file"
)
async def generate_summary_by_id(
    file_id: str,
    req: Optional[SummaryRequest] = None,
    current_user_id: str = Depends(get_current_user_id)
):
    merged_req = req or SummaryRequest()
    if not merged_req.file_id:
        merged_req.file_id = file_id
    return await generate_summary(merged_req, current_user_id)

# ================= ACTION ITEMS GENERATION & MONGODB SAVING =================
@router.post(
    "/action-items",
    response_model=ActionItemsResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate structured action items from meeting summary and save to MongoDB"
)
async def generate_action_items(
    req: ActionItemsRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    user_id = str(current_user_id).strip()
    user_match = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }

    summaries_col = get_summaries_collection()
    actions_col = get_action_items_collection()
    extracted_col = get_extracted_text_collection()
    transcripts_col = get_transcripts_collection()
    docs_col = get_documents_collection()

    summary_text = (req.summary or "").strip()
    meeting_id = (req.meeting_id or "").strip()
    title = (req.title or "").strip()
    transcript_text = (req.transcript_text or "").strip()

    # If meeting_id provided, look up associated summary or text for THIS user
    if meeting_id and not summary_text:
        try:
            s_doc = summaries_col.find_one({
                "$and": [
                    {"$or": [{"_id": ObjectId(meeting_id) if ObjectId.is_valid(meeting_id) else None}, {"meeting_id": meeting_id}]},
                    user_match
                ]
            })
            if s_doc and s_doc.get("summary"):
                summary_text = s_doc["summary"]
                title = title or s_doc.get("title")
        except Exception:
            pass

    # If still empty, check latest summary from MongoDB summaries collection for THIS user
    if not summary_text:
        latest_summary = summaries_col.find_one(user_match, sort=[("_id", -1)])
        if latest_summary and latest_summary.get("summary"):
            summary_text = latest_summary.get("summary", "")
            title = title or latest_summary.get("title", "")
            meeting_id = meeting_id or latest_summary.get("meeting_id", "") or str(latest_summary.get("_id", ""))

    # If still no summary, fall back to extracted text or transcript for THIS user
    content_for_action = summary_text or transcript_text
    if not content_for_action:
        latest_ext = extracted_col.find_one(user_match, sort=[("_id", -1)])
        if latest_ext and latest_ext.get("text"):
            content_for_action = latest_ext.get("text", "")
            title = title or latest_ext.get("fileName", "")
            meeting_id = meeting_id or str(latest_ext.get("_id", ""))

    if not content_for_action:
        latest_tr = transcripts_col.find_one(user_match, sort=[("_id", -1)])
        if latest_tr and latest_tr.get("transcript"):
            content_for_action = latest_tr.get("transcript", "")
            title = title or latest_tr.get("fileName", "")
            meeting_id = meeting_id or str(latest_tr.get("_id", ""))

    if not content_for_action or len(content_for_action.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="No document text or summary available. Please upload a PDF or Audio recording first."
        )

    # Extract 5-10 real actionable tasks derived strictly from the content using Groq
    tasks: List[ActionItemModel] = []
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    effective_title = title or "Document Content"

    if groq_api_key:
        import requests, json, re

        action_prompt = f"""You are an expert AI productivity and educational task analyst.
Extract between 5 and 10 specific, concrete, meaningful action items/tasks directly derived from this document summary or transcript.

Context & Rules:
1. Tailor every task directly to the actual subject matter of the document:
   - If the content is Computer Science/Engineering/Course Notes (e.g., DBMS, Java, Operating Systems, Machine Learning, Data Structures, Networks):
     Tasks MUST be concrete academic/learning deliverables such as:
     • Studying core concepts (e.g., ER models, normalization, OOP principles, exception handling)
     • Practicing code exercises, queries, or problem sets (e.g., SQL joins, transaction management, inheritance programs)
     • Completing lab assignments, record books, or review exercises
     Assign "owner": "Student"
   - If the content is Personal Branding, Career, or Business Strategy:
     Tasks MUST be specific branding actions (e.g., optimizing LinkedIn profile, defining value proposition, drafting thought-leadership content, networking outreach).
     Assign "owner": "Student" or "Professional"
   - If the content is an Organizational/Project Meeting:
     Tasks MUST be the actual commitments, features, or deadlines agreed upon in the meeting.
     Assign "owner" to the specific role or person mentioned in the discussion.
2. STRICT NEGATIVE CONSTRAINTS:
   - NEVER output generic IT template tasks (e.g., 'Deploy production application container', 'QA testing', 'MongoDB schema verification', 'Frontend engineering review') UNLESS they are explicitly discussed in the source content.
   - NEVER use corporate team names like 'Development Team', 'QA Team', 'Database Team', 'Product Management' unless they explicitly appear in the source text.
3. Every task must be a concise, clear action sentence (8 to 20 words).
4. Assign "priority" as "High", "Medium", or "Low" based on importance in the text.
5. Return ONLY a valid JSON array of 5 to 10 objects:
[
  {{
    "task": "Study ER Model concepts and relational schema design",
    "priority": "High",
    "owner": "Student"
  }}
]

Source Document Title: {effective_title}
Source Content:
{content_for_action[:3800]}
"""

        candidate_models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
        forbidden_phrases = [
            "deploy production application",
            "mongodb schema verification",
            "frontend engineering review",
            "execute comprehensive api endpoint"
        ]

        for model_name in candidate_models:
            try:
                resp = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model_name,
                        "messages": [{"role": "user", "content": action_prompt}],
                        "temperature": 0.2,
                        "max_tokens": 1000
                    },
                    timeout=25
                )
                if resp.status_code == 200:
                    raw_out = resp.json()["choices"][0]["message"]["content"].strip()
                    # Strip any markdown code fences ```json ... ```
                    clean_json = re.sub(r"^```[a-zA-Z]*\n?", "", raw_out)
                    clean_json = re.sub(r"```$", "", clean_json).strip()
                    start_idx = clean_json.find("[")
                    end_idx = clean_json.rfind("]")
                    if start_idx != -1 and end_idx != -1:
                        parsed = json.loads(clean_json[start_idx:end_idx+1])
                        for pt in parsed:
                            if isinstance(pt, dict) and pt.get("task"):
                                task_text = str(pt.get("task")).strip()
                                is_forbidden = any(fp in task_text.lower() for fp in forbidden_phrases) and not any(fp in content_for_action.lower() for fp in forbidden_phrases)
                                if is_forbidden:
                                    continue
                                raw_owner = str(pt.get("owner", "Student")).strip()
                                if raw_owner in ["Development Team", "QA Team", "Database Team", "Product Management"] and raw_owner not in content_for_action:
                                    raw_owner = "Student"
                                tasks.append(ActionItemModel(
                                    task=task_text,
                                    priority=str(pt.get("priority", "High")),
                                    owner=raw_owner or "Student"
                                ))
                    if len(tasks) >= 4:
                        break
            except Exception as act_err:
                logger.warning(f"Groq action items attempt with {model_name} failed: {act_err}")

    # Fallback strictly extracted from the content lines if Groq failed
    if not tasks and content_for_action:
        candidate_lines = [
            line.strip().lstrip("-*•0123456789. ")
            for line in content_for_action.splitlines()
            if (line.strip().startswith(("-", "*", "•")) or (len(line.strip()) > 5 and line.strip()[0].isdigit() and "." in line[:3]))
            and len(line.strip().lstrip("-*•0123456789. ")) > 15
        ]
        priority_cycle = ["High", "High", "Medium", "Medium", "Low", "Medium", "Low"]
        for i, item in enumerate(candidate_lines[:8]):
            clean_item = item.strip()
            first_word = clean_item.split()[0].lower() if clean_item.split() else ""
            if first_word not in ["study", "review", "practice", "complete", "prepare", "implement", "analyze", "create"]:
                clean_item = f"Study and review {clean_item[0].lower() + clean_item[1:] if len(clean_item) > 1 else clean_item}"
            tasks.append(ActionItemModel(
                task=clean_item,
                priority=priority_cycle[i % len(priority_cycle)],
                owner="Student"
            ))

    now_iso = datetime.now(timezone.utc).isoformat()
    effective_meeting_id = str(meeting_id or ObjectId())

    # 1. Save each individual action item with user_id
    for t in tasks:
        actions_col.insert_one({
            "user_id": user_id,
            "meeting_id": effective_meeting_id,
            "title": effective_title,
            "task": t.task,
            "priority": t.priority,
            "assigned_to": t.owner,
            "owner": t.owner,
            "source_type": "meeting",
            "source_title": effective_title,
            "created_at": now_iso
        })

    # 2. Save container document for get_latest_action_items with user_id
    action_doc = {
        "meeting_id": effective_meeting_id,
        "title": effective_title,
        "source": "Generated from current meeting summary",
        "tasks": [t.model_dump() for t in tasks],
        "created_at": now_iso,
        "count": len(tasks),
        "is_container": True,
        "user_id": user_id,
        "container_user_id": user_id
    }

    try:
        actions_col.insert_one(action_doc)
        logger.info(f"Real AI action items saved into MongoDB 'action_items' for user {user_id}, meeting_id: {effective_meeting_id}")
    except Exception as e:
        logger.warning(f"Could not persist action items to MongoDB: {e}")

    return ActionItemsResponse(
        message="Action items generated successfully",
        meeting_id=effective_meeting_id,
        tasks=tasks,
        count=len(tasks),
        created_at=now_iso,
        source="Generated from current meeting summary",
        title=effective_title
    )

@router.get(
    "/action-items/latest",
    response_model=ActionItemsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get latest AI-generated action items from MongoDB for authenticated user"
)
def get_latest_action_items(current_user_id: str = Depends(get_current_user_id)):
    user_id = str(current_user_id).strip()
    user_filter = {
        "$or": [
            {"container_user_id": user_id},
            {"user_id": user_id},
            {"container_user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }
    actions_col = get_action_items_collection()
    doc = actions_col.find_one({
        "tasks": {"$exists": True, "$ne": []},
        "$or": user_filter["$or"]
    }, sort=[("_id", -1)])
    if not doc or not doc.get("tasks"):
        raise HTTPException(status_code=404, detail="No action items found in database")
    tasks = [ActionItemModel(**t) for t in doc.get("tasks", [])]
    return ActionItemsResponse(
        message="Latest action items retrieved",
        meeting_id=str(doc.get("meeting_id", "")),
        tasks=tasks,
        count=len(tasks),
        created_at=doc.get("created_at"),
        source=doc.get("source", "Generated from current meeting summary"),
        title=doc.get("title")
    )

@router.get(
    "/action-items/{meeting_id}",
    response_model=ActionItemsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get action items by meeting ID from MongoDB for authenticated user"
)
def get_action_items_by_meeting_id(meeting_id: str, current_user_id: str = Depends(get_current_user_id)):
    user_id = str(current_user_id).strip()
    user_filter = {
        "$or": [
            {"container_user_id": user_id},
            {"user_id": user_id},
            {"container_user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }
    actions_col = get_action_items_collection()
    doc = actions_col.find_one(
        {
            "$and": [
                {"$or": [{"meeting_id": meeting_id}, {"_id": ObjectId(meeting_id) if ObjectId.is_valid(meeting_id) else None}]},
                user_filter
            ]
        },
        sort=[("_id", -1)]
    )
    if not doc or not doc.get("tasks"):
        raise HTTPException(status_code=404, detail="No action items found for this meeting.")
    tasks = [ActionItemModel(**t) for t in doc.get("tasks", [])]
    return ActionItemsResponse(
        message="Action items retrieved",
        meeting_id=str(doc.get("meeting_id", meeting_id)),
        tasks=tasks,
        count=len(tasks),
        created_at=doc.get("created_at"),
        source=doc.get("source", "Generated from current meeting summary"),
        title=doc.get("title")
    )

# ================= LIVE MONGODB DATABASE STATISTICS =================
@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="Get user-specific live MongoDB database statistics"
)
def get_live_database_stats(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    """
    Returns authentic live document counts directly from MongoDB collections scoped to the logged-in user.
    """
    from routes.dashboard import compute_user_stats
    user_id = None
    if credentials and hasattr(credentials, "credentials") and credentials.credentials:
        try:
            payload = verify_and_decode_token(credentials.credentials)
            user_id = payload.get("user_id") or payload.get("sub")
        except Exception:
            pass
    if user_id:
        return compute_user_stats(str(user_id))
    return compute_user_stats("anonymous")


