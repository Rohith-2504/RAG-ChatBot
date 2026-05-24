from app.services.rag_service import (
    RAGService,
)

from app.services.web_search_service import (
    WebSearchService,
)

from app.services.llm_service import (
    LLMService,
)

from app.services.message_service import (
    MessageService,
)


class RouterService:

    @staticmethod
    def _needs_live_web(
        query: str
    ) -> bool:

        live_keywords = [
            "latest",
            "today",
            "right now",
            "current",
            "recent",
            "news",
            "weather",
            "price",
            "stock",
            "score",
            "schedule",
            "2026",
            "this week",
            "this month",
        ]

        return any(
            keyword in query
            for keyword in live_keywords
        )

    @staticmethod
    def _is_casual(
        query: str
    ) -> bool:

        casual_messages = [
            "hi",
            "hello",
            "hey",
            "yo",
            "sup",
            "what's up",
            "how are you",
            "how are you doing",
            "good morning",
            "good evening",
            "good afternoon",
            "who are you",
            "how is your day",
            "thanks",
            "thank you",
            "ok",
            "okay",
        ]

        if query in casual_messages:
            return True

        return (
            len(query.split()) <= 5
            and any(
                query.startswith(message)
                for message in casual_messages
            )
        )

    @staticmethod
    def generate_answer(
        query: str,
        session_id: str = None,
        attachments: list = None,
    ):
        normalized_query = query.lower().strip()
        conversation_memory = ""

        if session_id:

            conversation_memory = (
                MessageService.get_recent_messages(
                    session_id
                )
            )

        # ==========================================
        # NATURAL CHAT MODE
        # ==========================================

        if RouterService._is_casual(
            normalized_query
        ):

            casual_prompt = f"""
You are ECHO, a calm personal AI assistant inspired by
the feeling of a refined cinematic assistant, but you are not
trying to quote or imitate any copyrighted character exactly.

Sound natural, warm, concise, and quietly confident.
Use the user's conversation history naturally.

Style:
- conversational, not robotic
- direct, but with a little personality
- short for casual chat
- no stiff dictionary-style explanations
- no repeated "as an AI" phrasing
- if the user asks how you are, answer like a friendly assistant

PREVIOUS CONVERSATION:
{conversation_memory[-1200:]}

USER:
{query}
"""

            return (
                LLMService.generate_response(
                    casual_prompt,
                    max_tokens=160,
                )
            )

        # ==========================================
        # ADVANCED AI MODE
        # ==========================================

        # Retrieve Context
        context = (
            RAGService.retrieve_context(
                query
            )
        )

        # Retrieve Web Results only when the question needs live data.
        # The feature is still available, but this avoids slow web calls
        # for normal conversation and document questions.
        if RouterService._needs_live_web(
            normalized_query
        ):
            web_results = (
                WebSearchService.search_web(
                    query
                )
            )

        else:
            web_results = ""

        # ==========================================
        # SAFETY LIMITS
        # ==========================================

        MAX_CONTEXT_CHARS = 2600
        MAX_WEB_RESULTS_CHARS = 1200

        # Trim Context
        if context:

            context = str(
                context
            )[:MAX_CONTEXT_CHARS]

        else:

            context = (
                "No relevant documents found."
            )

        # Trim Web Results
        if web_results:

            web_results = str(
                web_results
            )[:MAX_WEB_RESULTS_CHARS]


        # Trim Context
        if context:

            context = str(
                context
            )[:MAX_CONTEXT_CHARS]

        else:

            context = (
                "No relevant documents found."
            )

        # Trim Web Results
        if web_results:

            web_results = str(
                web_results
            )[:MAX_WEB_RESULTS_CHARS]

        else:

            web_results = (
                "No web results found."
            )

        # Construct direct attachments context
        attachments_text = ""
        if attachments:
            attachments_text += "\n-----------------------------------\n\nATTACHED FILES (Direct Context):\n"
            for attachment in attachments:
                if hasattr(attachment, "filename"):
                    name = attachment.filename
                    content_text = attachment.content
                else:
                    name = attachment.get("filename", "unknown")
                    content_text = attachment.get("content", "")
                attachments_text += f"- Filename: {name}\n  Content:\n{content_text}\n\n"

        # ==========================================
        # FINAL PROMPT
        # ==========================================

        final_prompt = f"""
You are ECHO, a calm personal AI assistant for this user.
You are inspired by the polished, capable feel of a refined
cinematic assistant, but do not quote or imitate any copyrighted
character exactly.

Your personality:
- intelligent, warm, and composed
- natural, not robotic
- lightly witty only when it fits
- concise when the question is simple
- thorough when the user needs real help
- honest when uncertain

You have access to:
1. Conversation memory
2. Retrieved RAG knowledge
3. Web search results
4. Direct file attachments (OCR / text data)

Use them only when relevant.
{attachments_text}
-----------------------------------

PREVIOUS CONVERSATION:
{conversation_memory[-1800:]}

-----------------------------------

USER QUESTION:
{query}

-----------------------------------

RAG CONTEXT:
{context}

-----------------------------------

WEB RESULTS:
{web_results}

-----------------------------------

INSTRUCTIONS:

- Speak like a capable assistant in an ongoing conversation.
- Sound smooth and human. Short sentences are fine.
- Do not over-explain simple greetings.
- Do not keep saying the user is asking again unless it matters.
- Use memory naturally without sounding creepy or repetitive.
- Prefer clear, practical answers.
- If documents or web results help, use them.
- If they do not help, answer from general reasoning.
- If unsure, say so plainly.
- Keep the tone smooth, human, and useful.
"""

        # ==========================================
        # FINAL TOKEN SAFETY
        # ==========================================

        MAX_PROMPT_CHARS = 6000

        final_prompt = final_prompt[
            :MAX_PROMPT_CHARS
        ]

        # ==========================================
        # GENERATE RESPONSE
        # ==========================================

        response = (
                LLMService.generate_response(
                final_prompt,
                max_tokens=384,
            )
        )

        return response
