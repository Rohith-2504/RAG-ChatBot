from app.services.rag_service import RAGService
from app.services.web_search_service import WebSearchService
from app.services.llm_service import LLMService


class RouterService:

    @staticmethod
    def generate_answer(query: str):
        # Retrieve context from vector database
        context = RAGService.retrieve_context(query)

        # Retrieve web search results
        web_results = WebSearchService.search_web(query)

        # Safety limits to avoid Groq token limit errors
        MAX_CONTEXT_CHARS = 4000
        MAX_WEB_RESULTS_CHARS = 2000

        # Trim large inputs
        if context:
            context = str(context)[:MAX_CONTEXT_CHARS]
        else:
            context = "No relevant documents found."

        if web_results:
            web_results = str(web_results)[:MAX_WEB_RESULTS_CHARS]
        else:
            web_results = "No web results found."

        # Construct final prompt
        final_prompt = f"""
You are an advanced AI assistant.

Answer the user's question using the provided context and web results.

User Question:
{query}

Retrieved Context:
{context}

Web Results:
{web_results}

Instructions:
- Provide a clear and professional answer.
- Use only relevant information.
- If information is missing, say so honestly.
"""

        # Final safeguard in case prompt is still too large
        MAX_PROMPT_CHARS = 8000
        final_prompt = final_prompt[:MAX_PROMPT_CHARS]

        # Generate response
        response = LLMService.generate_response(final_prompt)

        return response