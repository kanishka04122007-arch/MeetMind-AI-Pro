import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URL") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "meetmind_ai")

_client = None

def get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
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
