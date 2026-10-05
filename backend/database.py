import os
import logging
from pymongo import MongoClient

logger = logging.getLogger("uvicorn.error")

MONGO_URI = os.getenv("MONGO_URL") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "meetmind_ai")
print("MONGO_URL =", os.getenv("MONGO_URL"))
print("MONGO_URI =", os.getenv("MONGO_URI"))
print("FINAL_URI =", MONGO_URI)
print("DB_NAME =", DB_NAME)

_client = None

def get_db():
    global _client
    if _client is None:
        # Avoid hanging on Render if Atlas is unreachable or IP whitelist blocks Render
        logger.info(f"Connecting to MongoDB at {MONGO_URI.split('@')[-1] if '@' in MONGO_URI else 'localhost'}...")
        _client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000
        )
    return _client[DB_NAME]

def get_classified_meetings_collection():
    return get_db()["classified_meetings"]

def get_users_collection():
    return get_db()["users"]

def get_documents_collection():
    return get_db()["documents"]

def get_files_collection():
    return get_db()["files"]

def get_transcripts_collection():
    return get_db()["transcripts"]

def get_meetings_collection():
    return get_db()["meetings"]

def get_extracted_text_collection():
    return get_db()["extracted_text"]

def get_summaries_collection():
    return get_db()["summaries"]

def get_action_items_collection():
    return get_db()["action_items"]

def get_classification_collection():
    return get_db()["classification"]
