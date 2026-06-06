"""
AI Assistant chat endpoint for the frontend.

Provides a simple chat completion endpoint that uses the configured
LLM provider (DeepSeek/OpenAI/Anthropic/Gemini/Qwen) from environment variables.
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

# Default system prompt in Russian
DEFAULT_SYSTEM_PROMPT = (
    "Ты — ИИ-ассистент компании ПРОМЕБЕЛЬ. "
    "Помогаешь управлять закупками и оптимизировать процессы снабжения. "
    "Отвечай на русском языке. Будь полезным, конкретным и профессиональным."
)


@router.post("/chat", response_model=AssistantResponse)
async def chat_with_assistant(
    request: AssistantRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Chat with the AI assistant using the configured LLM provider.

    Tries providers in order: DeepSeek → OpenAI → Qwen → Anthropic → Gemini.
    Requires at least one LLM API key to be configured.
    """
    system_msg = request.system_prompt or DEFAULT_SYSTEM_PROMPT

    # 1. Try DeepSeek (OpenAI-compatible API)
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    deepseek_base = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
    if deepseek_key and len(deepseek_key) > 10:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=deepseek_key,
                base_url=deepseek_base + "/v1",
                timeout=60
            )
            model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

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
                logger.info(f"DeepSeek responded successfully (model={model})")
                return AssistantResponse(response=content)
        except Exception as e:
            logger.warning(f"DeepSeek chat failed: {e}")

    # 2. Try OpenAI
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key and openai_key != "your_openai_api_key_here" and len(openai_key) > 10:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key, timeout=30)
            model = os.getenv("OPENAI_MODEL", "gpt-4o")

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

    # 3. Try Qwen (OpenAI-compatible via DashScope)
    qwen_key = os.getenv("QWEN_API_KEY", "").strip()
    qwen_base = os.getenv("QWEN_BASE_URL", "").strip()
    if qwen_key and len(qwen_key) > 10:
        try:
            from openai import OpenAI
            base_url = qwen_base + "/v1" if qwen_base else "https://dashscope.aliyuncs.com/compatible-mode/v1"
            client = OpenAI(
                api_key=qwen_key,
                base_url=base_url,
                timeout=30
            )
            model = os.getenv("QWEN_MODEL", "qwen-plus")

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
                logger.info(f"Qwen responded successfully (model={model})")
                return AssistantResponse(response=content)
        except Exception as e:
            logger.warning(f"Qwen chat failed: {e}")

    # 4. Try Anthropic
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if anthropic_key and anthropic_key != "your_anthropic_api_key_here" and len(anthropic_key) > 10:
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=anthropic_key, timeout=30)
            model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

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

    # 5. Try Gemini
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key and gemini_key != "your_gemini_api_key_here" and len(gemini_key) > 10:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")

            model = genai.GenerativeModel(
                model_name,
                system_instruction=system_msg,
            )

            chat_history = []
            for msg in request.messages[:-1]:
                chat_history.append({
                    "role": "user" if msg.role == "user" else "model",
                    "parts": [msg.content],
                })

            last_msg = request.messages[-1].content if request.messages else "Привет"
            chat = model.start_chat(history=chat_history)
            response = chat.send_message(last_msg)

            if response.text:
                return AssistantResponse(response=response.text)
        except Exception as e:
            logger.warning(f"Gemini chat failed: {e}")

    return AssistantResponse(
        response="ИИ-ассистент временно недоступен. Для работы требуется настроить "
                 "API-ключ LLM (DeepSeek, OpenAI, Qwen, Anthropic или Gemini) в файле .env."
    )

