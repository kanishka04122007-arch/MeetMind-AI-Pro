import os
import logging
from pymongo import MongoClient
from dotenv import load_dotenv

# Ensure environment variables are loaded from backend/.env
load_dotenv(override=True)
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path, override=True)

logger = logging.getLogger("uvicorn.error")

MONGO_URI = os.getenv("MONGO_URL") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "meetmind_ai")
print("MONGO_URL =", os.getenv("MONGO_URL"))
print("MONGO_URI =", os.getenv("MONGO_URI"))
print("FINAL_URI =", MONGO_URI)
print("DB_NAME =", DB_NAME)

try:
    import certifi
    ca_file = certifi.where()
except Exception:
    ca_file = None

_client = None

def get_db():
    global _client
    if _client is None:
        logger.info(f"Connecting to MongoDB Atlas at {MONGO_URI.split('@')[-1] if '@' in MONGO_URI else 'localhost'}...")
        client_kwargs = {
            "serverSelectionTimeoutMS": 15000,
            "connectTimeoutMS": 15000,
            "socketTimeoutMS": 20000,
        }
        if ca_file and ("mongodb+srv://" in MONGO_URI or "ssl=true" in MONGO_URI.lower() or "tls=true" in MONGO_URI.lower()):
            client_kwargs["tlsCAFile"] = ca_file
        _client = MongoClient(MONGO_URI, **client_kwargs)
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
