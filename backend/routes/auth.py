from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import bcrypt
import logging
from database import get_users_collection
from services.jwt_auth import create_access_token

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    confirm_password: str = Field(None)

class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)

class UserInfo(BaseModel):
    id: str
    _id: str
    name: str
    email: str
    role: str = "user"

class AuthResponse(BaseModel):
    token: str
    access_token: str
    token_type: str = "bearer"
    message: str = "Success"
    welcome_message: str
    user: UserInfo

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        # Fallback in case of plain text passwords from testing
        return plain_password == hashed_password
    except Exception:
        return False

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(request: UserRegisterRequest):
    users_col = get_users_collection()
    normalized_email = request.email.strip().lower()

    existing_user = users_col.find_one({"email": normalized_email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    hashed_pw = hash_password(request.password)
    now_iso = datetime.now(timezone.utc).isoformat()

    new_user = {
        "name": request.name.strip(),
        "email": normalized_email,
        "password": hashed_pw,
        "createdAt": now_iso
    }

    result = users_col.insert_one(new_user)
    user_id = str(result.inserted_id)
    token = create_access_token(user_id=user_id, email=normalized_email, name=request.name.strip())

    user_info = UserInfo(
        id=user_id,
        _id=user_id,
        name=request.name.strip(),
        email=normalized_email,
        role="user"
    )

    return AuthResponse(
        token=token,
        access_token=token,
        token_type="bearer",
        message="Registration successful",
        welcome_message=f"Account created successfully! Welcome, {request.name.strip()}!",
        user=user_info
    )

@router.post("/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
def login(request: UserLoginRequest):
    users_col = get_users_collection()
    normalized_email = request.email.strip().lower()

    user = users_col.find_one({"email": normalized_email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please try again."
        )

    if not verify_password(request.password, user.get("password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please try again."
        )

    user_id = str(user["_id"])
    user_name = user.get("name", "User")
    token = create_access_token(user_id=user_id, email=normalized_email, name=user_name)

    user_info = UserInfo(
        id=user_id,
        _id=user_id,
        name=user_name,
        email=normalized_email,
        role="user"
    )

    return AuthResponse(
        token=token,
        access_token=token,
        token_type="bearer",
        message="Login successful",
        welcome_message=f"Welcome back, {user_name}!",
        user=user_info
    )
