"""AI Diagnostic Assistant API Endpoints for ChargeGuard AI Pro."""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import DiagnosticConversation, User
from app.schemas import AssistantMessageRequest, AssistantMessageResponse
from app.services.assistant_service import ai_assistant_service
from app.core.security import get_current_user

router = APIRouter(prefix="/assistant", tags=["AI Diagnostic Assistant"])


@router.post("/chat", response_model=AssistantMessageResponse, summary="Send Message to AI Assistant")
async def chat_with_assistant(
    payload: AssistantMessageRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Interact with the context-aware ChargeGuard AI Diagnostic Assistant.
    Retrieves real sensor measurements, health scores, and active alerts from the database.
    """
    user_id = current_user.id if current_user else None
    result = await ai_assistant_service.answer_question(
        db=db,
        query=payload.query,
        session_id=payload.session_id,
        test_id=payload.test_id,
        device_id=payload.device_id,
        cable_id=payload.cable_id,
        user_id=user_id
    )
    return AssistantMessageResponse(**result)


@router.get("/history", summary="Fetch Assistant Conversation History")
def get_chat_history(
    session_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve recent diagnostic conversation history."""
    query = db.query(DiagnosticConversation)
    if session_id:
        query = query.filter(DiagnosticConversation.session_id == session_id)
    records = query.order_by(DiagnosticConversation.created_at.desc()).limit(limit).all()

    return [
        {
            "id": r.id,
            "session_id": r.session_id,
            "query": r.query,
            "response": r.response,
            "created_at": r.created_at.isoformat()
        }
        for r in records
    ]
