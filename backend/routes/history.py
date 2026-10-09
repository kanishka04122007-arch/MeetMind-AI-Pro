import os
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Security
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from bson import ObjectId

from database import (
    get_db,
    get_files_collection,
    get_documents_collection,
    get_meetings_collection,
    get_transcripts_collection,
    get_extracted_text_collection,
    get_summaries_collection,
    get_action_items_collection,
    get_classification_collection,
    get_classified_meetings_collection,
)
from services.jwt_auth import verify_and_decode_token, get_current_user_id, security

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

class ActionItemModel(BaseModel):
    task: str
    priority: str = "Medium"
    owner: str = "Student"

class HistoryMeetingItem(BaseModel):
    id: str
    title: str
    fileName: str
    fileType: str  # "pdf" | "audio"
    sourceType: str  # "PDF Document" | "Audio Meeting"
    uploadDate: str
    formattedDate: str
    status: str = "Completed"
    summaryStatus: str  # "Generated" | "Pending"
    transcriptStatus: str  # "Completed" | "Processing" | "Pending"
    category: str
    confidence: int = 95
    reason: Optional[str] = ""
    actionItemsCount: int = 0
    actionItems: List[ActionItemModel] = []
    summary: Optional[str] = ""
    keyPoints: List[str] = []
    transcript: Optional[str] = ""
    extractedText: Optional[str] = ""
    wordCount: int = 0
    pageCount: int = 0
    duration: float = 0.0
    is_live_recording: bool = False

class HistoryStats(BaseModel):
    totalMeetings: int
    totalPDFs: int
    totalAudio: int
    totalSummaries: int
    totalActionItems: int
    totalClassifications: int

def format_meeting_datetime(dt_str: str) -> str:
    """Formats ISO datetime string into: '03 Oct 2026 | 02:15 PM'"""
    if not dt_str:
        return "Recent Session"
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        if " " in clean_str and "T" not in clean_str:
            clean_str = clean_str.replace(" ", "T")
        dt = datetime.fromisoformat(clean_str)
        return dt.strftime("%d %b %Y | %I:%M %p")
    except Exception:
        return dt_str[:19].replace("T", " ")

def build_consolidated_history(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetches and correlates records across MongoDB collections:
    - files
    - documents
    - transcripts
    - extracted_text
    - summaries
    - action_items
    - classification
    - meetings
    """
    db = get_db()
    files_col = db["files"]
    docs_col = db["documents"]
    meetings_col = db["meetings"]
    transcripts_col = db["transcripts"]
    extracted_col = db["extracted_text"]
    summaries_col = db["summaries"]
    actions_col = db["action_items"]
    class_col = db["classification"]

    if not user_id:
        return []

    user_id_str = str(user_id).strip()
    user_query = {
        "$or": [
            {"user_id": user_id_str},
            {"user_id": ObjectId(user_id_str)} if ObjectId.is_valid(user_id_str) else {"user_id": user_id_str}
        ]
    }

    # 1. Pre-index Legacy / Single-Task Action Items by source title
    grouped_single_actions: Dict[str, List[Dict[str, str]]] = {}
    for a in actions_col.find(user_query):
        if a.get("tasks"):
            continue
        single_task = a.get("task")
        if single_task:
            key = (a.get("source_title") or a.get("title") or "").strip().lower()
            if key:
                if key not in grouped_single_actions:
                    grouped_single_actions[key] = []
                grouped_single_actions[key].append({
                    "task": single_task,
                    "priority": a.get("priority", "Medium"),
                    "owner": a.get("assigned_to", "Student")
                })

    records_map: Dict[str, Dict[str, Any]] = {}
    ordered_ids: List[str] = []

    # 2. Process primary 'files' collection
    for f in files_col.find(user_query).sort("_id", -1):
        fid = str(f["_id"])
        fn = f.get("fileName") or f.get("file_name") or f.get("filename") or "Document"
        raw_title = f.get("title") or fn
        title = raw_title.strip()
        ftype = "pdf" if (f.get("fileType") == "pdf" or f.get("file_type") == "pdf" or fn.lower().endswith(".pdf")) else "audio"
        upload_date = f.get("created_at") or f.get("uploadedAt") or f.get("uploaded_at") or f.get("uploadDate") or ""
        is_live = bool(f.get("is_live_recording") or f.get("source") == "live_recording")

        record = {
            "id": fid,
            "_id": fid,
            "title": title,
            "fileName": fn,
            "fileType": ftype,
            "sourceType": "Live Recording" if is_live else ("PDF Document" if ftype == "pdf" else "Audio Meeting"),
            "uploadDate": upload_date,
            "formattedDate": format_meeting_datetime(upload_date),
            "status": f.get("status", "Completed"),
            "extractedText": f.get("extracted_text") or f.get("text") or f.get("content") or "",
            "transcript": f.get("transcript_text") or f.get("transcript") or "",
            "summary": f.get("summary") or "",
            "keyPoints": [],
            "actionItems": [],
            "actionItemsCount": 0,
            "category": "Educational" if ftype == "pdf" else "Technical",
            "confidence": 95,
            "reason": "",
            "summaryStatus": "Generated" if f.get("summary") else "Pending",
            "transcriptStatus": "Completed" if (f.get("extracted_text") or f.get("transcript")) else "Pending",
            "wordCount": f.get("word_count", 0),
            "pageCount": f.get("page_count", 0),
            "duration": f.get("duration", 0.0),
            "is_live_recording": is_live,
        }
        records_map[fid] = record
        ordered_ids.append(fid)

    # 3. Check 'documents' collection for any missing PDFs or richer metadata
    for d in docs_col.find(user_query).sort("_id", -1):
        did = str(d["_id"])
        fn = d.get("fileName") or d.get("filename") or ""
        t = d.get("title") or fn

        target = records_map.get(did)
        if not target and fn:
            for rec in records_map.values():
                if rec["fileName"].lower() == fn.lower():
                    target = rec
                    break

        if not target:
            upload_date = d.get("uploadDate") or d.get("created_at") or ""
            text = d.get("extracted_text") or d.get("text") or ""
            record = {
                "id": did,
                "_id": did,
                "title": t,
                "fileName": fn,
                "fileType": "pdf",
                "sourceType": "PDF Document",
                "uploadDate": upload_date,
                "formattedDate": format_meeting_datetime(upload_date),
                "status": d.get("status", "Completed"),
                "extractedText": text,
                "transcript": "",
                "summary": "",
                "keyPoints": [],
                "actionItems": [],
                "actionItemsCount": 0,
                "category": "Educational",
                "confidence": 95,
                "reason": "",
                "summaryStatus": "Pending",
                "transcriptStatus": "Completed" if text else "Pending",
                "wordCount": d.get("word_count", len(text.split()) if text else 0),
                "pageCount": d.get("page_count", 1),
                "duration": 0.0,
            }
            records_map[did] = record
            ordered_ids.append(did)
        else:
            if not target["extractedText"]:
                target["extractedText"] = d.get("extracted_text") or d.get("text") or ""
            if not target["wordCount"] and d.get("word_count"):
                target["wordCount"] = d.get("word_count")
            if not target["pageCount"] and d.get("page_count"):
                target["pageCount"] = d.get("page_count")

    # 4. Check 'meetings' collection for any audio meetings
    for m in meetings_col.find(user_query).sort("_id", -1):
        mid = str(m["_id"])
        fn = m.get("filename") or m.get("fileName") or ""
        t = m.get("title") or fn
        fid = m.get("file_id")

        target = records_map.get(mid) or (records_map.get(fid) if fid else None)
        if not target and fn:
            for rec in records_map.values():
                if rec["fileName"].lower() == fn.lower():
                    target = rec
                    break

        upload_date = m.get("created_at") or m.get("updated_at") or ""
        tr_text = m.get("transcript_text") or m.get("transcript") or ""

        if not target:
            record = {
                "id": mid,
                "_id": mid,
                "title": t,
                "fileName": fn,
                "fileType": "audio",
                "sourceType": "Audio Meeting",
                "uploadDate": upload_date,
                "formattedDate": format_meeting_datetime(upload_date),
                "status": m.get("status", "Completed"),
                "extractedText": "",
                "transcript": tr_text,
                "summary": "",
                "keyPoints": [],
                "actionItems": [],
                "actionItemsCount": 0,
                "category": "Technical",
                "confidence": 95,
                "reason": "",
                "summaryStatus": "Pending",
                "transcriptStatus": "Completed" if tr_text else "Pending",
                "wordCount": len(tr_text.split()) if tr_text else 0,
                "pageCount": 0,
                "duration": m.get("duration", 0.0),
            }
            records_map[mid] = record
            ordered_ids.append(mid)
        else:
            if not target["transcript"] and tr_text:
                target["transcript"] = tr_text
                target["transcriptStatus"] = "Completed"
            if m.get("duration"):
                target["duration"] = m.get("duration")

    # 5. Augment from 'transcripts' and 'extracted_text' collections
    for tr in transcripts_col.find(user_query).sort("_id", -1):
        fid = tr.get("file_id")
        fn = tr.get("fileName")
        t_text = tr.get("transcript") or ""
        if not t_text:
            continue
        target = records_map.get(fid) if fid else None
        if not target and fn:
            for rec in records_map.values():
                if rec["fileName"].lower() == fn.lower() and rec["fileType"] == "audio":
                    target = rec
                    break
        if target:
            if not target["transcript"]:
                target["transcript"] = t_text
            target["transcriptStatus"] = "Completed"

    for ext in extracted_col.find(user_query).sort("_id", -1):
        fid = ext.get("file_id") or ext.get("doc_id")
        fn = ext.get("fileName")
        t_text = ext.get("text") or ""
        if not t_text:
            continue
        target = records_map.get(fid) if fid else None
        if not target and fn:
            for rec in records_map.values():
                if rec["fileName"].lower() == fn.lower() and rec["fileType"] == "pdf":
                    target = rec
                    break
        if target:
            if not target["extractedText"]:
                target["extractedText"] = t_text
            target["transcriptStatus"] = "Completed"

    # 6. Augment from 'summaries' collection
    for s in summaries_col.find(user_query).sort("_id", -1):
        mid = s.get("meeting_id")
        t = s.get("title")
        fn = s.get("fileName")
        sum_text = s.get("summary") or ""
        pts = s.get("key_points") or []
        cat = s.get("category")

        target = records_map.get(mid) if mid else None
        if not target and t:
            for rec in records_map.values():
                if rec["title"].strip().lower() == t.strip().lower():
                    target = rec
                    break
        if not target and fn:
            for rec in records_map.values():
                if rec["fileName"].lower() == fn.lower():
                    target = rec
                    break

        if target and sum_text:
            if not target["summary"]:
                target["summary"] = sum_text
            if not target["keyPoints"] and pts:
                target["keyPoints"] = pts
            if cat:
                target["category"] = cat
            target["summaryStatus"] = "Generated"
            if not target["wordCount"]:
                target["wordCount"] = s.get("word_count", len(sum_text.split()))

    # 7. Augment from 'action_items' collection
    for a in actions_col.find(user_query).sort("_id", -1):
        mid = a.get("meeting_id")
        t = a.get("title") or a.get("source_title")
        tasks = a.get("tasks") or []
        count = len(tasks) or a.get("count", 0)

        target = records_map.get(mid) if mid else None
        if not target and t:
            for rec in records_map.values():
                if rec["title"].strip().lower() == t.strip().lower():
                    target = rec
                    break

        if target and count > 0:
            if not target["actionItems"]:
                target["actionItems"] = [
                    ActionItemModel(
                        task=task.get("task", ""),
                        priority=task.get("priority", "Medium"),
                        owner=task.get("owner", "Student")
                    )
                    for task in tasks if isinstance(task, dict) and task.get("task")
                ]
                target["actionItemsCount"] = len(target["actionItems"])

    # Fallback for grouped single tasks if not set
    for rec in records_map.values():
        if rec["actionItemsCount"] == 0:
            key = rec["title"].strip().lower()
            if key in grouped_single_actions:
                tasks_list = [
                    ActionItemModel(task=item["task"], priority=item["priority"], owner=item["owner"])
                    for item in grouped_single_actions[key]
                ]
                rec["actionItems"] = tasks_list
                rec["actionItemsCount"] = len(tasks_list)

    # 8. Augment from 'classification' & 'classified_meetings'
    for c in class_col.find(user_query).sort("_id", -1):
        fid = c.get("file_id")
        t = c.get("title")
        cat = c.get("category")
        conf = c.get("confidence")
        reason = c.get("reason")

        target = records_map.get(fid) if fid else None
        if not target and t:
            for rec in records_map.values():
                if rec["title"].strip().lower() == t.strip().lower():
                    target = rec
                    break

        if target and cat:
            target["category"] = cat
            if conf:
                target["confidence"] = int(conf)
            if reason:
                target["reason"] = reason

    # 9. Deduplicate sessions by (fileName, fileType) keeping the most complete record
    final_list: List[Dict[str, Any]] = []
    seen: Dict[tuple, tuple[Dict[str, Any], int]] = {}

    for fid in ordered_ids:
        rec = records_map.get(fid)
        if not rec:
            continue
        key = (rec["fileName"].lower(), rec["fileType"])
        # Score completeness to select best version
        score = (
            (4 if rec["summary"] else 0) +
            (4 if rec["actionItemsCount"] > 0 else 0) +
            (2 if (rec["extractedText"] or rec["transcript"]) else 0) +
            (1 if rec["reason"] else 0)
        )
        if key not in seen:
            seen[key] = (rec, score)
        else:
            prev_rec, prev_score = seen[key]
            if score > prev_score:
                seen[key] = (rec, score)

    for rec, _ in seen.values():
        final_list.append(rec)

    # Sort latest first by uploadDate
    final_list.sort(key=lambda x: str(x.get("uploadDate", "")), reverse=True)
    return final_list

@router.get(
    "",
    response_model=List[HistoryMeetingItem],
    status_code=status.HTTP_200_OK,
    summary="Get all processed meeting records directly aggregated from MongoDB collections"
)
@router.get(
    "/",
    response_model=List[HistoryMeetingItem],
    status_code=status.HTTP_200_OK,
    summary="Get all processed meeting records directly aggregated from MongoDB collections"
)
def get_all_meetings_history(current_user_id: str = Depends(get_current_user_id)):
    """
    Retrieves and correlates actual processed meetings from:
    - files
    - documents
    - transcripts
    - extracted_text
    - summaries
    - action_items
    - classification
    """
    try:
        records = build_consolidated_history(user_id=current_user_id)
        return [HistoryMeetingItem(**r) for r in records]
    except Exception as e:
        logger.error(f"Failed to fetch meeting history from MongoDB: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch meeting history: {str(e)}"
        )

@router.get(
    "/stats",
    response_model=HistoryStats,
    status_code=status.HTTP_200_OK,
    summary="Get live MongoDB statistics for History dashboard"
)
def get_history_stats(current_user_id: str = Depends(get_current_user_id)):
    """
    Returns authentic live document counts directly from MongoDB collections scoped to current user.
    """
    user_id_str = str(current_user_id).strip()
    user_query = {
        "$or": [
            {"user_id": user_id_str},
            {"user_id": ObjectId(user_id_str)} if ObjectId.is_valid(user_id_str) else {"user_id": user_id_str}
        ]
    }

    db = get_db()
    summaries_col = db["summaries"]
    actions_col = db["action_items"]
    class_col = db["classification"]

    # Calculate real counts for current user
    all_history = build_consolidated_history(user_id=current_user_id)
    total_meetings = len(all_history)

    # Count distinct PDFs across files and documents
    total_pdfs = sum(1 for r in all_history if r.get("fileType") == "pdf")
    total_audio = sum(1 for r in all_history if r.get("fileType") == "audio")
    total_summaries = summaries_col.count_documents(user_query)
    total_action_items = actions_col.count_documents(user_query)
    total_classifications = class_col.count_documents(user_query)

    return HistoryStats(
        totalMeetings=total_meetings,
        totalPDFs=total_pdfs,
        totalAudio=total_audio,
        totalSummaries=total_summaries,
        totalActionItems=total_action_items,
        totalClassifications=total_classifications
    )

@router.get(
    "/{item_id}",
    response_model=HistoryMeetingItem,
    status_code=status.HTTP_200_OK,
    summary="Get single complete meeting record by ID"
)
def get_meeting_record_by_id(item_id: str, current_user_id: str = Depends(get_current_user_id)):
    records = build_consolidated_history(user_id=current_user_id)
    for r in records:
        if r["id"] == item_id or r["_id"] == item_id:
            return HistoryMeetingItem(**r)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Meeting with ID '{item_id}' not found in MongoDB."
    )

@router.delete(
    "/{item_id}",
    status_code=status.HTTP_200_OK,
    summary="Permanently delete a meeting and all associated records from all MongoDB collections"
)
def delete_meeting_record(item_id: str, current_user_id: str = Depends(get_current_user_id)):
    """
    Removes related records belonging to the authenticated user from:
    - files
    - documents
    - transcripts
    - extracted_text
    - summaries
    - action_items
    - classification
    - classified_meetings
    - meetings
    """
    db = get_db()
    files_col = db["files"]
    docs_col = db["documents"]
    transcripts_col = db["transcripts"]
    extracted_col = db["extracted_text"]
    summaries_col = db["summaries"]
    actions_col = db["action_items"]
    class_col = db["classification"]
    cm_col = db["classified_meetings"]
    meetings_col = db["meetings"]

    user_id_str = str(current_user_id).strip()
    user_match = {
        "$or": [
            {"user_id": user_id_str},
            {"user_id": ObjectId(user_id_str)} if ObjectId.is_valid(user_id_str) else {"user_id": user_id_str}
        ]
    }

    # Locate identifiers for deletion - only if owned by user
    target = None
    if ObjectId.is_valid(item_id):
        target = files_col.find_one({"_id": ObjectId(item_id), **user_match}) or docs_col.find_one({"_id": ObjectId(item_id), **user_match})
    if not target:
        target = files_col.find_one({"id": item_id, **user_match}) or docs_col.find_one({"id": item_id, **user_match})
    if not target:
        target = meetings_col.find_one({"_id": item_id, **user_match}) or meetings_col.find_one({"file_id": item_id, **user_match})
    if not target:
        target = summaries_col.find_one({"meeting_id": item_id, **user_match})

    if not target:
        exists_elsewhere = (
            (files_col.find_one({"_id": ObjectId(item_id)}) or docs_col.find_one({"_id": ObjectId(item_id)})) if ObjectId.is_valid(item_id) else None
        ) or files_col.find_one({"id": item_id}) or meetings_col.find_one({"_id": item_id})
        if exists_elsewhere:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this meeting record."
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID '{item_id}' not found."
        )

    # Prepare delete criteria
    obj_id = ObjectId(item_id) if ObjectId.is_valid(item_id) else None
    file_name = target.get("fileName") or target.get("filename") if target else None
    title = target.get("title") if target else None

    id_queries: List[Dict[str, Any]] = [{"id": item_id}, {"file_id": item_id}, {"meeting_id": item_id}]
    if obj_id:
        id_queries.append({"_id": obj_id})
    if file_name:
        id_queries.append({"fileName": file_name})
        id_queries.append({"filename": file_name})
    if title:
        id_queries.append({"title": title})

    del_filter = {"$and": [user_match, {"$or": id_queries}]}

    deleted_counts = {}
    try:
        deleted_counts["files"] = files_col.delete_many(del_filter).deleted_count
        deleted_counts["documents"] = docs_col.delete_many(del_filter).deleted_count
        deleted_counts["transcripts"] = transcripts_col.delete_many(del_filter).deleted_count
        deleted_counts["extracted_text"] = extracted_col.delete_many(del_filter).deleted_count
        deleted_counts["summaries"] = summaries_col.delete_many(del_filter).deleted_count
        deleted_counts["action_items"] = actions_col.delete_many(del_filter).deleted_count
        deleted_counts["classification"] = class_col.delete_many(del_filter).deleted_count
        deleted_counts["meetings"] = meetings_col.delete_many(del_filter).deleted_count

        logger.info(f"Deleted meeting records for {item_id}: {deleted_counts}")
        return {
            "success": True,
            "message": "Meeting and all associated records permanently removed from MongoDB.",
            "deleted_counts": deleted_counts
        }
    except Exception as e:
        logger.error(f"Error deleting meeting record {item_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete meeting records from database: {str(e)}"
        )
