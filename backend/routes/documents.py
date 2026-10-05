import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from bson import ObjectId
import pdfplumber

from database import (
    get_documents_collection,
    get_files_collection,
    get_extracted_text_collection
)
from services.ocr_service import (
    extract_ocr_from_pdf,
    is_placeholder_text
)
from services.jwt_auth import verify_and_decode_token, get_current_user_id, security

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class PDFDocumentResponse(BaseModel):
    id: str
    _id: str
    title: str
    fileName: str
    file_size: Optional[int] = 0
    extracted_text: Optional[str] = ""
    text: Optional[str] = ""
    content: Optional[str] = ""
    page_count: Optional[int] = 0
    word_count: Optional[int] = 0
    char_count: Optional[int] = 0
    status: str = "processed"
    created_at: Optional[str] = None
    uploadDate: Optional[str] = None

class ExtractResponse(BaseModel):
    text: str
    extracted_text: Optional[str] = None
    content: Optional[str] = None
    page_count: Optional[int] = 0
    word_count: Optional[int] = 0
    char_count: Optional[int] = 0
    status: str = "success"
    message: str = "Document text extracted successfully"

def extract_text_from_pdf(file_path: str, force_ocr: bool = False) -> tuple[str, int, int, int]:
    """
    Extracts text, page count, word count, char count from a PDF file.
    Uses robust multi-tier fallback:
      1. pdfplumber (layout-preserving text extraction)
      2. pypdf (fast, robust text extraction)
      3. pypdfium2 (Chromium engine, handles complex fonts without poppler)
      4. Safe OCR fallback (only if ENABLE_HEAVY_OCR=true, guarded against Render OOM)
    Guaranteed never to raise an unhandled exception or crash the server.
    """
    text_parts = []
    page_count = 0
    full_text = ""

    if not force_ocr:
        # Tier 1: pdfplumber
        try:
            with pdfplumber.open(file_path) as pdf:
                page_count = len(pdf.pages)
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        text_parts.append(page_text.strip())
            logger.info(f"pdfplumber extracted {len(text_parts)} page(s) with text from {file_path}")
        except Exception as e:
            logger.warning(f"pdfplumber extraction failed or not applicable: {e}")

        # Tier 2: pypdf fallback
        if not text_parts or not "".join(text_parts).strip():
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                if page_count == 0:
                    page_count = len(reader.pages)
                for page in reader.pages:
                    t = page.extract_text()
                    if t and t.strip():
                        text_parts.append(t.strip())
                logger.info(f"pypdf fallback extracted {len(text_parts)} page(s) with text")
            except Exception as e2:
                logger.warning(f"pypdf fallback extraction failed: {e2}")

        # Tier 3: pypdfium2 fallback (lightweight Chromium PDF engine, handles tricky fonts)
        if not text_parts or not "".join(text_parts).strip():
            try:
                import pypdfium2 as pdfium
                pdf = pdfium.PdfDocument(file_path)
                if page_count == 0:
                    page_count = len(pdf)
                for page in pdf:
                    text_page = page.get_textpage()
                    t = text_page.get_text_range()
                    if t and t.strip():
                        text_parts.append(t.strip())
                logger.info(f"pypdfium2 fallback extracted {len(text_parts)} page(s) with text")
            except Exception as e3:
                logger.warning(f"pypdfium2 fallback extraction failed: {e3}")

        full_text = "\n\n".join(text_parts).strip()

    # Tier 4: OCR Fallback (strictly guarded by ENABLE_HEAVY_OCR to prevent 512MB RAM OOM crashes)
    enable_heavy_ocr = os.getenv("ENABLE_HEAVY_OCR", "false").lower() in ("true", "1", "yes")
    needs_ocr = force_ocr or len(full_text) < 100 or is_placeholder_text(full_text)

    if needs_ocr:
        if enable_heavy_ocr:
            logger.info(
                f"PDF text below 100 chars (len={len(full_text)}) and ENABLE_HEAVY_OCR=true. "
                f"Attempting safe OCR extraction..."
            )
            try:
                ocr_text, ocr_pages, ocr_words, ocr_chars = extract_ocr_from_pdf(file_path)
                if ocr_text and len(ocr_text.strip()) > 0:
                    logger.info(f"OCR successfully extracted {ocr_words} words ({ocr_chars} chars)")
                    return ocr_text, max(page_count, ocr_pages), ocr_words, ocr_chars
            except Exception as ocr_err:
                logger.error(f"OCR extraction failed gracefully: {ocr_err}")
        else:
            logger.info(
                f"PDF text is sparse (<100 chars, len={len(full_text)}). "
                f"Heavy OCR skipped to protect Render 512MB RAM limits and prevent 502 Bad Gateway. "
                f"Document will be saved with native extracted text."
            )

    # Remove placeholder text if present
    if is_placeholder_text(full_text):
        full_text = ""

    page_count = max(page_count, 1)
    words = full_text.split()
    return full_text, page_count, len(words), len(full_text)

@router.post("/upload", response_model=PDFDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Production-hardened PDF upload endpoint:
    - Safe file size & format validation
    - Multi-tier text extraction (pdfplumber -> pypdf -> pypdfium2 -> safe OCR)
    - Granular MongoDB error handling with clear 503/500 diagnostic responses
    - Structured logging for easy troubleshooting on Render
    """
    user_id = str(current_user_id).strip()
    logger.info(f"==> [UPLOAD] Incoming PDF upload request from user '{user_id}' for file: '{file.filename}'")

    # 1. Validate file presence & extension
    if not file or not file.filename:
        logger.warning("[UPLOAD] Rejected: Missing file payload or filename.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided in the upload request."
        )

    if not file.filename.lower().endswith(".pdf"):
        logger.warning(f"[UPLOAD] Rejected non-PDF file: {file.filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents (.pdf) are allowed."
        )

    # 2. Read and validate file content & size
    try:
        file_content = await file.read()
    except Exception as read_err:
        logger.error(f"[UPLOAD] Failed to read uploaded file: {read_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file content: {str(read_err)}"
        )

    file_size = len(file_content)
    if file_size == 0:
        logger.warning("[UPLOAD] Rejected: Uploaded PDF is empty (0 bytes).")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF file is empty (0 bytes)."
        )

    # Max 50 MB limit
    if file_size > 50 * 1024 * 1024:
        logger.warning(f"[UPLOAD] Rejected: File size {file_size} exceeds 50MB limit.")
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="PDF file exceeds the 50MB maximum upload limit."
        )

    # 3. Save file safely to disk
    safe_title = title.strip() if title and title.strip() else os.path.splitext(file.filename)[0]
    unique_suffix = uuid.uuid4().hex[:8]
    clean_base = os.path.basename(file.filename)
    stored_filename = f"{unique_suffix}_{clean_base}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)

    try:
        with open(file_path, "wb") as f:
            f.write(file_content)
        logger.info(f"[UPLOAD] File successfully saved to disk: {file_path} ({file_size} bytes)")
    except Exception as io_err:
        logger.error(f"[UPLOAD] Disk write error at {file_path}: {io_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server could not write file to storage: {str(io_err)}"
        )

    # 4. Extract text safely (pdfplumber -> pypdf -> pypdfium2 -> safe OCR)
    try:
        extracted_text, page_count, word_count, char_count = extract_text_from_pdf(file_path)
        logger.info(
            f"[UPLOAD] Extraction complete: {page_count} page(s), "
            f"{word_count} word(s), {char_count} char(s)"
        )
    except Exception as ext_err:
        logger.error(f"[UPLOAD] Extraction encountered error, continuing with empty text: {ext_err}", exc_info=True)
        extracted_text = ""
        page_count = 1
        word_count = 0
        char_count = 0

    now_iso = datetime.now(timezone.utc).isoformat()

    # 5. Persist to MongoDB 'documents' collection with detailed error handling
    doc_record = {
        "user_id": user_id,
        "title": safe_title,
        "fileName": file.filename,
        "filename": file.filename,
        "stored_filename": stored_filename,
        "file_path": file_path,
        "file_size": file_size,
        "page_count": page_count,
        "word_count": word_count,
        "char_count": char_count,
        "status": "processed",
        "uploadDate": now_iso,
        "extracted_text": extracted_text,
        "text": extracted_text,
        "content": extracted_text,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    try:
        docs_col = get_documents_collection()
        insert_result = docs_col.insert_one(doc_record)
        doc_id = str(insert_result.inserted_id)
        logger.info(f"[UPLOAD] Document saved in MongoDB 'documents' collection with ID: {doc_id}")
    except Exception as db_err:
        logger.error(f"[UPLOAD] MongoDB insert failed: {db_err}", exc_info=True)
        err_type = type(db_err).__name__
        err_msg = str(db_err)
        if "Timeout" in err_type or "ServerSelection" in err_type or "timeout" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Database connection timed out. Please check that MongoDB Atlas is reachable "
                    "and that Network Access IP Access List allows 0.0.0.0/0 (required for Render deployments)."
                )
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while saving document: {err_msg}"
        )

    # 6. Secondary record in 'files' collection (isolated so secondary issues do not fail upload)
    try:
        files_col = get_files_collection()
        files_col.insert_one({
            "_id": insert_result.inserted_id,
            "id": doc_id,
            "file_id": doc_id,
            "fileName": file.filename,
            "fileType": "pdf",
            "status": "Completed",
            "uploadedAt": now_iso,
            "file_name": file.filename,
            "file_type": "pdf",
            "filename": file.filename,
            "type": "pdf",
            "title": safe_title,
            "extracted_text": extracted_text,
            "text": extracted_text,
            "content": extracted_text,
            "page_count": page_count,
            "word_count": word_count,
            "char_count": char_count,
            "uploaded_at": now_iso,
            "uploaded_by": user_id,
            "user_id": user_id
        })
        logger.info(f"[UPLOAD] Synced record to 'files' collection.")
    except Exception as f_err:
        logger.warning(f"[UPLOAD] Secondary insert into 'files' failed (non-critical): {f_err}")

    # 7. Secondary record in 'extracted_text' collection
    if extracted_text:
        try:
            extracted_col = get_extracted_text_collection()
            extracted_col.insert_one({
                "user_id": user_id,
                "doc_id": doc_id,
                "file_id": doc_id,
                "fileName": file.filename,
                "text": extracted_text,
                "page_count": page_count,
                "word_count": word_count,
                "char_count": char_count,
                "createdAt": now_iso
            })
            logger.info(f"[UPLOAD] Synced record to 'extracted_text' collection.")
        except Exception as e_err:
            logger.warning(f"[UPLOAD] Secondary insert into 'extracted_text' failed (non-critical): {e_err}")

    logger.info(f"<== [UPLOAD] Success! Document '{file.filename}' (ID: {doc_id}) ready for user '{user_id}'.")

    return PDFDocumentResponse(
        id=doc_id,
        _id=doc_id,
        title=safe_title,
        fileName=file.filename,
        file_size=file_size,
        extracted_text=extracted_text,
        text=extracted_text,
        content=extracted_text,
        page_count=page_count,
        word_count=word_count,
        char_count=char_count,
        status="processed",
        created_at=now_iso,
        uploadDate=now_iso
    )


@router.get("/latest", response_model=PDFDocumentResponse)
def get_latest_document(current_user_id: str = Depends(get_current_user_id)):
    user_id = str(current_user_id).strip()
    if not user_id:
        raise HTTPException(status_code=404, detail="No documents found for this user")

    user_filter = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }

    docs_col = get_documents_collection()
    doc = docs_col.find_one(user_filter, sort=[("created_at", -1), ("_id", -1)])
    if not doc:
        files_col = get_files_collection()
        pdf_query = {"$and": [{"fileType": "pdf"}, user_filter]}
        fdoc = files_col.find_one(pdf_query, sort=[("uploadedAt", -1), ("_id", -1)])
        if not fdoc:
            raise HTTPException(status_code=404, detail="No documents found for this user")
        doc = fdoc

    doc_id = str(doc["_id"])
    text = doc.get("extracted_text") or doc.get("text") or doc.get("content") or ""
    if is_placeholder_text(text):
        text = ""

    if not text:
        extracted_col = get_extracted_text_collection()
        ext_doc = extracted_col.find_one({"$and": [{"$or": [{"doc_id": doc_id}, {"file_id": doc_id}]}, user_filter]}, sort=[("_id", -1)])
        if ext_doc and ext_doc.get("text") and not is_placeholder_text(ext_doc.get("text")):
            text = ext_doc["text"]

    words = doc.get("word_count") or (len(text.split()) if text else 0)
    page_count = doc.get("page_count") or 1
    char_count = doc.get("char_count") or len(text)

    return PDFDocumentResponse(
        id=doc_id,
        _id=doc_id,
        title=doc.get("title", doc.get("fileName", "Untitled Document")),
        fileName=doc.get("fileName", doc.get("file_name", "document.pdf")),
        file_size=doc.get("file_size", 0),
        extracted_text=text,
        text=text,
        content=text,
        page_count=page_count,
        word_count=words,
        char_count=char_count,
        status=doc.get("status", "processed"),
        created_at=doc.get("created_at", doc.get("uploadDate", doc.get("uploadedAt", ""))),
        uploadDate=doc.get("uploadDate", doc.get("created_at", doc.get("uploadedAt", "")))
    )

@router.post("/{doc_id}/extract", response_model=ExtractResponse)
def extract_document_text(doc_id: str, current_user_id: str = Depends(get_current_user_id)):
    user_id = str(current_user_id).strip()
    user_filter = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }
    docs_col = get_documents_collection()

    try:
        obj_id = ObjectId(doc_id)
        doc = docs_col.find_one({"$and": [{"_id": obj_id}, user_filter]})
    except Exception:
        doc = docs_col.find_one({"$and": [{"id": doc_id}, user_filter]})

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID {doc_id} not found."
        )

    cached_text = doc.get("extracted_text") or doc.get("text") or doc.get("content") or ""
    # If cached text has less than 100 characters or is placeholder, re-extract with OCR
    needs_ocr = (
        not cached_text
        or len(cached_text.strip()) < 100
        or is_placeholder_text(cached_text)
    )

    if not needs_ocr:
        word_count = doc.get("word_count") or len(cached_text.split())
        page_count = doc.get("page_count") or 1
        char_count = doc.get("char_count") or len(cached_text)
        return ExtractResponse(
            text=cached_text,
            extracted_text=cached_text,
            content=cached_text,
            page_count=page_count,
            word_count=word_count,
            char_count=char_count,
            status="success",
            message="Document text extracted successfully"
        )

    file_path = doc.get("file_path")
    if not file_path or not os.path.exists(file_path):
        # Look for file in UPLOAD_DIR by fileName
        fileName = doc.get("fileName") or doc.get("filename")
        if fileName:
            candidates = [
                os.path.join(UPLOAD_DIR, fileName),
                os.path.join(UPLOAD_DIR, doc.get("stored_filename", ""))
            ]
            for c in candidates:
                if os.path.exists(c):
                    file_path = c
                    break

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Underlying PDF file was not found on server disk."
        )

    # Perform extraction with OCR mode
    extracted_text, page_count, word_count, char_count = extract_text_from_pdf(file_path, force_ocr=True)
    now_iso = datetime.now(timezone.utc).isoformat()

    # Save extracted OCR text in MongoDB with user_id
    docs_col.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "extracted_text": extracted_text,
            "text": extracted_text,
            "content": extracted_text,
            "page_count": page_count,
            "word_count": word_count,
            "char_count": char_count,
            "updated_at": now_iso
        }}
    )

    files_col = get_files_collection()
    files_col.update_one(
        {"$and": [{"$or": [{"_id": doc["_id"]}, {"id": doc_id}, {"file_id": doc_id}]}, user_filter]},
        {"$set": {
            "extracted_text": extracted_text,
            "text": extracted_text,
            "content": extracted_text,
            "page_count": page_count,
            "word_count": word_count,
            "char_count": char_count,
            "updated_at": now_iso
        }}
    )

    if extracted_text:
        extracted_col = get_extracted_text_collection()
        extracted_col.update_one(
            {"$and": [{"$or": [{"doc_id": doc_id}, {"file_id": doc_id}]}, user_filter]},
            {"$set": {
                "user_id": user_id,
                "doc_id": doc_id,
                "file_id": doc_id,
                "fileName": doc.get("fileName", "document.pdf"),
                "text": extracted_text,
                "page_count": page_count,
                "word_count": word_count,
                "char_count": char_count,
                "updatedAt": now_iso
            }},
            upsert=True
        )

    return ExtractResponse(
        text=extracted_text,
        extracted_text=extracted_text,
        content=extracted_text,
        page_count=page_count,
        word_count=word_count,
        char_count=char_count,
        status="success",
        message="Document text extracted successfully"
    )

@router.get("/{doc_id}", response_model=PDFDocumentResponse)
def get_document_by_id(doc_id: str, current_user_id: str = Depends(get_current_user_id)):
    user_id = str(current_user_id).strip()
    user_filter = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }
    docs_col = get_documents_collection()
    try:
        obj_id = ObjectId(doc_id)
        doc = docs_col.find_one({"$and": [{"_id": obj_id}, user_filter]})
    except Exception:
        doc = docs_col.find_one({"$and": [{"id": doc_id}, user_filter]})

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID {doc_id} not found."
        )
    actual_id = str(doc["_id"])
    text = doc.get("extracted_text") or doc.get("text") or doc.get("content") or ""
    if is_placeholder_text(text):
        text = ""
    words = doc.get("word_count") or (len(text.split()) if text else 0)
    page_count = doc.get("page_count") or 1
    char_count = doc.get("char_count") or len(text)

    return PDFDocumentResponse(
        id=actual_id,
        _id=actual_id,
        title=doc.get("title", doc.get("fileName", "Untitled Document")),
        fileName=doc.get("fileName", "document.pdf"),
        file_size=doc.get("file_size", 0),
        extracted_text=text,
        text=text,
        content=text,
        page_count=page_count,
        word_count=words,
        char_count=char_count,
        status=doc.get("status", "processed"),
        created_at=doc.get("created_at", doc.get("uploadDate", "")),
        uploadDate=doc.get("uploadDate", doc.get("created_at", ""))
    )

@router.get("", response_model=List[PDFDocumentResponse])
@router.get("/", response_model=List[PDFDocumentResponse])
def list_documents(current_user_id: str = Depends(get_current_user_id)):
    user_id = str(current_user_id).strip()
    if not user_id:
        return []

    user_filter = {
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        ]
    }

    docs_col = get_documents_collection()
    results = []
    for doc in docs_col.find(user_filter).sort([("created_at", -1), ("_id", -1)]).limit(20):
        doc_id = str(doc["_id"])
        text = doc.get("extracted_text") or doc.get("text") or doc.get("content") or ""
        if is_placeholder_text(text):
            text = ""
        words = doc.get("word_count") or (len(text.split()) if text else 0)
        page_count = doc.get("page_count") or 1
        char_count = doc.get("char_count") or len(text)

        results.append(PDFDocumentResponse(
            id=doc_id,
            _id=doc_id,
            title=doc.get("title", doc.get("fileName", "Untitled Document")),
            fileName=doc.get("fileName", "document.pdf"),
            file_size=doc.get("file_size", 0),
            extracted_text=text,
            text=text,
            content=text,
            page_count=page_count,
            word_count=words,
            char_count=char_count,
            status=doc.get("status", "processed"),
            created_at=doc.get("created_at", doc.get("uploadDate", "")),
            uploadDate=doc.get("uploadDate", doc.get("created_at", ""))
        ))
    return results
