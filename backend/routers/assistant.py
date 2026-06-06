"""
AI Assistant chat endpoint for the frontend.

Provides a simple chat completion endpoint that uses the configured
LLM provider (OpenAI/Anthropic/Gemini) from environment variables.
"""
import os
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional

from backend.auth import get_current_active_user
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/assistant", tags=["AI Assistant"])


class ChatMessage(BaseModel):
    role: str
    content: str


class AssistantRequest(BaseModel):
    messages: List[ChatMessage]
    system_prompt: Optional[str] = None


class AssistantResponse(BaseModel):
    response: str


@router.post("/chat", response_model=AssistantResponse)
async def chat_with_assistant(
    request: AssistantRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Chat with the AI assistant using the configured LLM provider.

    Tries OpenAI first, then falls back to Anthropic/Gemini.
    Requires at least one LLM API key to be configured.
    """
    # Try OpenAI
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key and openai_key != "your_openai_api_key_here" and len(openai_key) > 10:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key, timeout=30)
            model = os.getenv("OPENAI_MODEL", "gpt-4o")

            system_msg = request.system_prompt or (
                "Ты — ИИ-ассистент компании ПРОМЕБЕЛЬ. "
                "Помогаешь управлять закупками и оптимизировать процессы снабжения. "
                "Отвечай на русском языке."
            )

            api_messages = [{"role": "system", "content": system_msg}]
            for msg in request.messages[-20:]:
                api_messages.append({"role": msg.role, "content": msg.content})

            completion = client.chat.completions.create(
                model=model,
                messages=api_messages,
                temperature=0.7,
                max_tokens=2048,
            )

            content = None
            if completion.choices:
                choice = completion.choices[0]
                if choice.message and choice.message.content:
                    content = choice.message.content
            if content:
                return AssistantResponse(response=content)
        except Exception as e:
            logger.warning(f"OpenAI chat failed: {e}")

    # Try Anthropic
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if anthropic_key and anthropic_key != "your_anthropic_api_key_here" and len(anthropic_key) > 10:
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=anthropic_key, timeout=30)
            model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

            system_msg = request.system_prompt or (
                "Ты — ИИ-ассистент компании ПРОМЕБЕЛЬ. "
                "Помогаешь управлять закупками и оптимизировать процессы снабжения. "
                "Отвечай на русском языке."
            )

            api_messages = []
            for msg in request.messages[-20:]:
                api_messages.append({"role": msg.role, "content": msg.content})

            response = client.messages.create(
                model=model,
                system=system_msg,
                messages=api_messages,
                max_tokens=2048,
                temperature=0.7,
            )

            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text
            if content:
                return AssistantResponse(response=content)
        except Exception as e:
            logger.warning(f"Anthropic chat failed: {e}")

    # Try Gemini
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key and gemini_key != "your_gemini_api_key_here" and len(gemini_key) > 10:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")

            system_msg = request.system_prompt or (
                "Ты — ИИ-ассистент компании ПРОМЕБЕЛЬ. "
                "Помогаешь управлять закупками и оптимизировать процессы снабжения. "
                "Отвечай на русском языке."
            )

            model = genai.GenerativeModel(
                model_name,
                system_instruction=system_msg,
            )

            chat_history = []
            for msg in request.messages[-20:]:
                chat_history.append({
                    "role": "user" if msg.role == "user" else "model",
                    "parts": [msg.content],
                })

            # Use the last message as the prompt
            last_msg = request.messages[-1].content if request.messages else "Привет"
            chat = model.start_chat(history=chat_history[:-1])
            response = chat.send_message(last_msg)

            if response.text:
                return AssistantResponse(response=response.text)
        except Exception as e:
            logger.warning(f"Gemini chat failed: {e}")

    return AssistantResponse(
        response="ИИ-ассистент временно недоступен. Для работы требуется настроить "
                 "API-ключ LLM (OpenAI, Anthropic или Gemini) в файле .env."
    )
