from openai import OpenAI
from app.core.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

def generate_response(messages):
    if not client:
        return "OpenAI API key not configured. Please add OPENAI_API_KEY to backend/.env"
    response = client.chat.completions.create(
        model=settings.MODEL_NAME,
        messages=messages,
        temperature=0.2,
    )
    return response.choices[0].message.content
