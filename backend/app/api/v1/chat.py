"""
backend/app/api/v1/chat.py
============================
POST /api/v1/chat  — EcoChat conversational assistant endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.watsonx_service import ask

router = APIRouter(prefix="/chat", tags=["EcoChat"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The user's question or message to EcoChat.",
        examples=["Which bin should I use for a glass bottle?"],
    )


class ChatResponse(BaseModel):
    reply: str = Field(..., description="EcoChat's answer.")
    source: str = Field(
        ...,
        description="'watsonx.ai' when powered by IBM Granite, 'Local Fallback' otherwise.",
    )


# ---------------------------------------------------------------------------
# POST /api/v1/chat
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask EcoChat a waste management question",
    description=(
        "Send a plain-text message to EcoChat. "
        "Responses are powered by **IBM watsonx.ai (Granite 13B Chat)** when credentials "
        "are configured, or by the built-in expert knowledge base otherwise. "
        "The `source` field in the response always tells you which engine answered."
    ),
)
def chat(body: ChatRequest) -> ChatResponse:
    try:
        result = ask(body.message)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"EcoChat encountered an unexpected error: {exc}",
        )
    return ChatResponse(reply=result.answer, source=result.source)
