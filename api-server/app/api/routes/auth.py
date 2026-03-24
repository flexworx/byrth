"""Authentication endpoints — login with optional TOTP MFA."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import pyotp

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    decode_token,
    verify_password,
    get_current_user,
)
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


# --- Request/Response Models ---

class LoginRequest(BaseModel):
    email: str
    password: str
    totp_code: str | None = None


class LoginResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    user: dict | None = None
    mfa_required: bool = False
    mfa_token: str | None = None


class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    message: str


class MFAVerifyRequest(BaseModel):
    totp_code: str


class MFALoginRequest(BaseModel):
    mfa_token: str
    totp_code: str


# --- Login ---

@router.post("/login", response_model=LoginResponse)
async def login(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user. If MFA is enabled, returns mfa_token for second step."""
    result = await db.execute(
        select(User).where(User.email == req.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # If MFA is enabled, check for TOTP code
    if user.mfa_enabled and user.mfa_secret:
        if req.totp_code:
            # Verify TOTP inline (single-step login with code)
            totp = pyotp.TOTP(user.mfa_secret)
            if not totp.verify(req.totp_code, valid_window=1):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid TOTP code",
                )
        else:
            # Return a short-lived MFA token for the second step
            mfa_token = create_access_token(
                data={"sub": str(user.id), "mfa_pending": True},
                expires_delta=timedelta(minutes=5),
            )
            return LoginResponse(
                mfa_required=True,
                mfa_token=mfa_token,
            )

    user.last_login = datetime.now(timezone.utc)

    token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "name": user.username,
            "roles": [user.role],
        }
    )

    return LoginResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.username,
            "role": user.role,
            "mfa_enabled": user.mfa_enabled,
        },
    )


@router.post("/mfa/login", response_model=LoginResponse)
async def mfa_login(
    req: MFALoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Complete MFA login with mfa_token + TOTP code."""
    payload = decode_token(req.mfa_token)
    if not payload.get("mfa_pending"):
        raise HTTPException(status_code=400, detail="Invalid MFA token")

    user_id = payload.get("sub")
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=401, detail="User not found or MFA not configured")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(req.totp_code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")

    user.last_login = datetime.now(timezone.utc)

    token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "name": user.username,
            "roles": [user.role],
        }
    )

    return LoginResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.username,
            "role": user.role,
            "mfa_enabled": user.mfa_enabled,
        },
    )


# --- MFA Setup ---

@router.post("/mfa/setup", response_model=MFASetupResponse)
async def mfa_setup(
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a TOTP secret and provisioning URI for authenticator app setup."""
    result = await db.execute(
        select(User).where(User.id == user_data["sub"])
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled. Disable it first.")

    # Generate new TOTP secret
    secret = pyotp.random_base32()
    user.mfa_secret = secret
    await db.flush()

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name="Roosk NexGen Platform",
    )

    return MFASetupResponse(
        secret=secret,
        provisioning_uri=provisioning_uri,
        message="Scan the QR code with your authenticator app, then verify with /mfa/verify",
    )


@router.post("/mfa/verify")
async def mfa_verify(
    req: MFAVerifyRequest,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP code to finalize MFA enrollment."""
    result = await db.execute(
        select(User).where(User.id == user_data["sub"])
    )
    user = result.scalar_one_or_none()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup not initiated. Call /mfa/setup first.")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(req.totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code. Try again.")

    user.mfa_enabled = True
    await db.flush()

    return {"status": "mfa_enabled", "message": "MFA is now enabled for your account."}


@router.post("/mfa/disable")
async def mfa_disable(
    req: MFAVerifyRequest,
    user_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable MFA. Requires current TOTP code for verification."""
    result = await db.execute(
        select(User).where(User.id == user_data["sub"])
    )
    user = result.scalar_one_or_none()
    if not user or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA is not enabled.")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(req.totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code.")

    user.mfa_enabled = False
    user.mfa_secret = None
    await db.flush()

    return {"status": "mfa_disabled", "message": "MFA has been disabled."}
