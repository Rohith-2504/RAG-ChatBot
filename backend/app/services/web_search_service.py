import requests
from app.core.config import settings


class WebSearchService:

    @staticmethod
    def search_web(query: str):

        if not settings.TAVILY_API_KEY:
            return "Web search API key missing."

        url = "https://api.tavily.com/search"

        payload = {
            "api_key": settings.TAVILY_API_KEY,
            "query": query,
            "search_depth": "basic",
            "max_results": 3,
        }

        try:
            response = requests.post(
                url,
                json=payload,
                timeout=3,
            )

        except requests.RequestException as e:
            return f"Web search failed: {str(e)}"

        if response.status_code != 200:
            return "Failed to fetch web results."

        data = response.json()

        results = []

        for item in data.get("results", []):
            results.append(
                f"{item['title']}\n{item['content']}\n"
            )

        return "\n\n".join(results)
