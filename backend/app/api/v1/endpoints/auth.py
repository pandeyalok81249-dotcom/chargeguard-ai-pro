"""Authentication & User Management Endpoints for ChargeGuard AI Pro."""

from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User
from app.schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    PasswordResetRequest, PasswordResetConfirm, UserProfileUpdate
)
from app.core.security import (
    hash_password, verify_password, create_access_token,
    decode_token, get_current_user, require_auth, ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.core.datetime_utils import utc_now
from app.core.logging import logger

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Register User")
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account."""
    existing_user = db.query(User).filter(User.username == payload.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{payload.username}' is already registered."
        )

    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' is already registered."
        )

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        created_at=utc_now()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"User registered: {user.username} ({user.role})")
    return user


@router.post("/login", response_model=Token, summary="User Login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with username and password; returns JWT bearer token."""
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated."
        )

    user.last_login_at = utc_now()
    db.commit()

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "id": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    logger.info(f"User logged in successfully: {user.username}")
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse, summary="Get Current User Profile")
def get_me(current_user: User = Depends(require_auth)):
    """Retrieve profile of currently authenticated user."""
    return current_user


@router.put("/profile", response_model=UserResponse, summary="Update Profile")
def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update user profile or change password."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.email is not None:
        existing = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.")
        current_user.email = payload.email

    if payload.new_password:
        if not payload.current_password or not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is required to set new password.")
        current_user.hashed_password = hash_password(payload.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/forgot-password", summary="Request Password Reset")
def forgot_password(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    """Generate a password reset token for user account."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # Don't leak user existence
        return {"message": "If this email exists in our records, a reset token has been issued."}

    reset_token = create_access_token(
        data={"sub": user.username, "purpose": "password_reset"},
        expires_delta=timedelta(minutes=30)
    )
    logger.info(f"Password reset requested for {user.email}")
    return {
        "message": "Password reset token generated successfully.",
        "reset_token": reset_token
    }


@router.post("/reset-password", summary="Confirm Password Reset")
def reset_password(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Reset user password using valid reset token."""
    decoded = decode_token(payload.token)
    if not decoded or decoded.get("purpose") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

    username = decoded.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    logger.info(f"Password reset completed for {user.username}")
    return {"message": "Password has been successfully updated. You may now log in."}


@router.post("/logout", summary="Logout User")
def logout(current_user: Optional[User] = Depends(get_current_user)):
    """Acknowledge user logout."""
    if current_user:
        logger.info(f"User logged out: {current_user.username}")
    return {"message": "Successfully logged out."}
