from fastapi import APIRouter, Response, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from backend.app.services.tts_service import synthesize_speech

router = APIRouter(prefix="/api/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str


@router.post("")
async def generate_speech(payload: TTSRequest):
    if not payload.text:
        raise HTTPException(status_code=400, detail="Text is required for TTS")

    audio_bytes = await synthesize_speech(payload.text)

    if not audio_bytes:
        # Signal client to use Web Speech API fallback
        return JSONResponse(content={"fallback": True})

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Length": str(len(audio_bytes)),
        }
    )
