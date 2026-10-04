import os
import time
import json
import hmac
import hashlib
import base64
from typing import Optional
from fastapi import HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

JWT_SECRET = os.getenv("JWT_SECRET", "meetmind_ai_jwt_secret_key_2026_super_secure")

security = HTTPBearer(auto_error=False)

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def base64url_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4)) if (len(data) % 4) != 0 else ""
    return base64.urlsafe_b64decode(data + padding)

def create_access_token(user_id: str, email: str, name: str, expires_in_seconds: int = 604800) -> str:
    """
    Creates a standard HMAC-SHA256 signed JWT token valid for 7 days by default.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": str(user_id),
        "sub": str(user_id),
        "email": email,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in_seconds
    }

    header_b64 = base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_and_decode_token(token: str) -> dict:
    """
    Verifies JWT signature and expiry. Returns decoded payload.
    Robustly strips quotes, spaces, and duplicate 'Bearer ' prefixes.
    """
    if not token or not isinstance(token, str):
        raise ValueError("Token is missing or empty")

    raw_token = token.strip().strip('"').strip("'")
    # Robustly strip repeated 'Bearer ' prefixes if present
    while raw_token.lower().startswith("bearer "):
        raw_token = raw_token[7:].strip()
    raw_token = raw_token.strip().strip('"').strip("'")

    if raw_token.lower() in ("undefined", "null", "[object object]", "none", ""):
        raise ValueError(f"Invalid token: received placeholder '{raw_token}'")

    parts = raw_token.split(".")
    if len(parts) != 3:
        raise ValueError(f"Invalid token structure (expected 3 parts, got {len(parts)})")

    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(base64url_encode(expected_sig), signature_b64):
        raise ValueError("Invalid JWT signature")

    payload_bytes = base64url_decode(payload_b64)
    payload = json.loads(payload_bytes.decode("utf-8"))

    if "exp" in payload and payload["exp"] < time.time():
        raise ValueError("Token has expired")

    return payload

def get_current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> str:
    """
    Dependency that extracts the logged-in user_id from the Bearer JWT token.
    Raises HTTP 401 if missing, invalid, or expired.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer JWT token in the Authorization header.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        payload = verify_and_decode_token(credentials.credentials)
        user_id = payload.get("user_id") or payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: user_id missing from payload",
                headers={"WWW-Authenticate": "Bearer"}
            )
        return str(user_id)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(val_err)}",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )
