from openai import OpenAI
from app.core.config import settings


class LLMService:
    @staticmethod
    def generate_response(prompt: str) -> str:
        # Initialize Groq client using OpenAI-compatible SDK
        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
        )

        # Extra safety: trim prompt if too large
        MAX_PROMPT_CHARS = 8000
        prompt = str(prompt)[:MAX_PROMPT_CHARS]

        # Generate response
        response = client.chat.completions.create(
            model=settings.MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful AI assistant. "
                        "Answer clearly, accurately, and concisely."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.7,
            max_tokens=512,  # Reduced to avoid token limit errors
        )

        return response.choices[0].message.content