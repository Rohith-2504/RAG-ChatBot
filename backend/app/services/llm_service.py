from openai import OpenAI
from app.core.config import settings


client = OpenAI(
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.OPENAI_BASE_URL,
)


class LLMService:
    @staticmethod
    def generate_response(
        prompt: str,
        max_tokens: int = 384,
    ) -> str:
        if not settings.OPENAI_API_KEY:
            return (
                "The model API key is missing. Add OPENAI_API_KEY "
                "to backend/.env and restart the backend."
            )

        # Extra safety: trim prompt if too large
        MAX_PROMPT_CHARS = 6000
        prompt = str(prompt)[:MAX_PROMPT_CHARS]

        # Generate response
        try:
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
                temperature=0.55,
                max_tokens=max_tokens,
            )

        except Exception as e:
            return f"Model request failed: {str(e)}"

        return response.choices[0].message.content
