import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Annotated, Optional

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlmodel import Session, select

from database import SessionDep
from models import ActivityLog, User

JWT_SECRET = os.getenv("JWT_SECRET", "campus-lost-found-secret-key-change-in-production")
PASSWORD_PEPPER = os.getenv("PASSWORD_PEPPER", "campus-lost-found-server-pepper-2026")
ACCESS_TOKEN_MINUTES = min(int(os.getenv("ACCESS_TOKEN_MINUTES", "15")), 15)
ACCESS_TOKEN_EXPIRE_SECONDS = ACCESS_TOKEN_MINUTES * 60
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))
REFRESH_TOKEN_EXPIRE_SECONDS = REFRESH_TOKEN_DAYS * 86400

try:
    from pwdlib import PasswordHash

    _password_hasher = PasswordHash.recommended()
except Exception:
    _password_hasher = None


def _apply_pepper(plain_password: str) -> str:
    """Combine plain-text password with server-side PASSWORD_PEPPER using HMAC-SHA256."""
    return hmac.new(
        PASSWORD_ER_BYTES := PASSWORD_PEPPER.encode("utf-8"),
        plain_password.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def hash_password(password: str) -> str:
    """Hash a password with the server-side pepper using Argon2 (or PBKDF2 fallback)."""
    peppered = _apply_pepper(password)
    if _password_hasher is not None:
        return "peppered$" + _password_hasher.hash(peppered)
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", peppered.encode("utf-8"), salt.encode("utf-8"), 200_000
    ).hex()
    return f"pbkdf2_peppered${salt}${digest}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify a password against its stored hash (supporting peppered and legacy hashes)."""
    if stored_hash.startswith("pbkdf2_peppered$"):
        parts = stored_hash.split("$")
        if len(parts) != 3:
            return False
        _, salt, expected_digest = parts
        peppered = _apply_pepper(plain_password)
        actual = hashlib.pbkdf2_hmac(
            "sha256", peppered.encode("utf-8"), salt.encode("utf-8"), 200_000
        ).hex()
        return hmac.compare_digest(actual, expected_digest)

    if stored_hash.startswith("peppered$") and _password_hasher is not None:
        raw_hash = stored_hash[len("peppered$") :]
        try:
            return _password_hasher.verify(_apply_pepper(plain_password), raw_hash)
        except Exception:
            return False

    if stored_hash.startswith("pbkdf2_sha256$"):
        parts = stored_hash.split("$")
        if len(parts) != 3:
            return False
        _, salt, expected_digest = parts
        actual = hashlib.pbkdf2_hmac(
            "sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 200_000
        ).hex()
        return hmac.compare_digest(actual, expected_digest)

    if _password_hasher is not None:
        try:
            return _password_hasher.verify(plain_password, stored_hash)
        except Exception:
            return False
    return False


def create_refresh_token_raw() -> str:
    """Generate a cryptographically random 32-byte refresh token string."""
    return secrets.token_urlsafe(32)


def hash_refresh_token(raw_token: str) -> str:
    """Return SHA-256 hex digest of a refresh token for database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(encoded: str) -> bytes:
    padding = "=" * (-len(encoded) % 4)
    return base64.urlsafe_b64decode(encoded + padding)


def create_access_token(
    user_id: int,
    email: str,
    role: str,
    expires_seconds: int = ACCESS_TOKEN_EXPIRE_SECONDS,
) -> str:
    """Create a short-lived signed HS256 JWT access token (<= 15 minutes)."""
    now = int(time.time())
    normalized_role = "admin" if role == "admin" else "user"
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": normalized_role,
        "iat": now,
        "exp": now + expires_seconds,
    }
    try:
        import jwt  # type: ignore

        return jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    except Exception:
        header_b64 = _b64url_encode(
            json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8")
        )
        payload_b64 = _b64url_encode(
            json.dumps(payload, separators=(",", ":")).encode("utf-8")
        )
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def decode_access_token(token: str) -> dict:
    """Decode and validate an HS256 JWT access token."""
    try:
        import jwt  # type: ignore

        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed token")
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(
            JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(actual_sig, expected_sig):
            raise ValueError("Invalid token signature")
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("Token expired")
        return payload


def get_client_info(request: Optional[Request]) -> tuple[str, str]:
    """Extract client IP address and User-Agent string from the HTTP request."""
    if request is None:
        return "127.0.0.1", "TestClient"
    forwarded = request.headers.get("x-forwarded-for")
    ip = (
        forwarded.split(",")[0].strip()
        if forwarded
        else (request.client.host if request.client else "127.0.0.1")
    )
    ua = request.headers.get("user-agent", "Unknown Browser")[:240]
    return ip, ua


def record_security_event(
    session: Session,
    request: Optional[Request],
    action: str,
    detail: str,
    user_id: Optional[int] = None,
    user_email: str = "anonymous",
) -> None:
    """Write a security or authentication event to the audit log."""
    ip, ua = get_client_info(request)
    entry = ActivityLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        entity_type="security",
        detail=detail[:490],
        ip_address=ip,
        user_agent=ua,
    )
    session.add(entry)
    session.commit()


def _extract_token(
    authorization: Optional[str] = Header(default=None),
    access_token_cookie: Optional[str] = Cookie(default=None, alias="access_token"),
) -> Optional[str]:
    if authorization is not None:
        scheme, _, param = authorization.partition(" ")
        if scheme.lower() != "bearer" or not param.strip():
            return "__MALFORMED__"
        return param.strip()
    if access_token_cookie:
        return access_token_cookie.strip()
    return None


def get_optional_user(
    request: Request,
    session: SessionDep,
    token: Annotated[Optional[str], Depends(_extract_token)] = None,
) -> Optional[User]:
    """Return the signed-in User if a valid token is supplied, or None if unauthenticated."""
    if not token:
        return None
    if token == "__MALFORMED__":
        record_security_event(
            session, request, "token_rejected", "Malformed Authorization header"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception as exc:
        record_security_event(
            session, request, "token_rejected", f"Rejected JWT on {request.url.path}: {exc}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        record_security_event(
            session, request, "token_rejected", f"Token sub={user_id} user not found"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.is_banned:
        record_security_event(
            session,
            request,
            "rbac_denied",
            f"Banned user blocked on {request.url.path}",
            user_id=user.id,
            user_email=user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account banned: {user.ban_reason or 'Suspended by administrator'}",
        )
    return user


def get_current_user(
    request: Request,
    session: SessionDep,
    user: Annotated[Optional[User], Depends(get_optional_user)],
) -> User:
    """Require an authenticated, non-banned user."""
    if user is None:
        record_security_event(
            session,
            request,
            "token_rejected",
            f"Missing authentication token for {request.method} {request.url.path}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


OptionalUserDep = Annotated[Optional[User], Depends(get_optional_user)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
