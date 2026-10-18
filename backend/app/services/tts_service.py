import logging
from typing import Optional
import openai
from backend.app.config.settings import settings

logger = logging.getLogger(__name__)


async def synthesize_speech(text: str) -> Optional[bytes]:
    """
    Synthesizes speech using OpenAI TTS ('tts-1', 'alloy' voice),
    returning raw MP3 audio bytes, or None if API key is not configured
    or audio synthesis fails (triggering client Web Speech API fallback).
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return None

    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text[:1000]  # Cap length for fast low-latency streaming
        )
        return response.content
    except Exception as e:
        logger.warning(f"OpenAI TTS synthesis error, signaling fallback: {e}")
        return None
