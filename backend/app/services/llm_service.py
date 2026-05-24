import json
from openai import OpenAI, AzureOpenAI
from app.core.config import settings
from app.services.tool_service import ToolService

# Client setup
if settings.AZURE_OPENAI_API_KEY and settings.AZURE_OPENAI_ENDPOINT:
    client = AzureOpenAI(
        api_key=settings.AZURE_OPENAI_API_KEY,
        azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        api_version=settings.AZURE_OPENAI_API_VERSION,
    )
    is_azure = True
else:
    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
    )
    is_azure = False

# Tools Schema Definition
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send an email to a recipient with a subject and content body.",
            "parameters": {
                "type": "object",
                "properties": {
                    "recipient_email": {
                        "type": "string",
                        "description": "The recipient's email address.",
                    },
                    "subject": {
                        "type": "string",
                        "description": "The subject of the email.",
                    },
                    "body": {
                        "type": "string",
                        "description": "The main content body of the email.",
                    },
                },
                "required": ["recipient_email", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_diagnostics",
            "description": "Retrieve system info, local database stats (user counts, sessions count, messages count), and uploads status.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "Get the current date and local time.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the weather conditions and temperature for a given city or location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city or location to check weather for (e.g. New York, Bangalore).",
                    },
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the live web for recent news, questions about current events, or terms that need live lookup.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The query to search the web for.",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_image_from_prompt",
            "description": "Generate or create a high-quality AI image from a text prompt describing what to draw.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "The detailed descriptive prompt for the image generation model.",
                    },
                },
                "required": ["prompt"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_video_from_prompt",
            "description": "Generate or create a short animated video sequence from a text prompt describing the visual motion.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "The detailed descriptive prompt for the video generation storyboard.",
                    },
                },
                "required": ["prompt"],
            },
        },
    },
]


class LLMService:
    @staticmethod
    def generate_response(
        prompt: str,
        max_tokens: int = 384,
    ) -> str:
        # Check API Key
        api_key = settings.AZURE_OPENAI_API_KEY if is_azure else settings.OPENAI_API_KEY
        if not api_key:
            return (
                "The model API key is missing. Configure OPENAI_API_KEY or "
                "AZURE_OPENAI_API_KEY in backend/.env and restart the backend."
            )

        # Extra safety: trim prompt if too large
        MAX_PROMPT_CHARS = 6000
        prompt = str(prompt)[:MAX_PROMPT_CHARS]

        model_name = settings.AZURE_OPENAI_DEPLOYMENT_NAME if is_azure else settings.MODEL_NAME

        messages = [
            {
                "role": "system",
                "content": (
                    "You are ECHO, a helpful, intelligent personal AI assistant. "
                    "Answer clearly, warmly, and concisely. You have access to tools "
                    "for sending emails, checking system diagnostics, fetching weather, "
                    "running web searches, getting the current time, and generating images or videos. "
                    "If a user asks you to perform an action or generate media, execute it using the appropriate tool."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ]

        # Generate response
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.55,
                max_tokens=max_tokens,
                tools=TOOLS,
                tool_choice="auto",
            )

            response_message = response.choices[0].message
            tool_calls = getattr(response_message, "tool_calls", None)

            if tool_calls:
                # Add assistant message containing the tool calls
                messages.append(response_message)

                for tool_call in tool_calls:
                    func_name = tool_call.function.name
                    func_args = json.loads(tool_call.function.arguments)

                    tool_output = ""
                    if func_name == "send_email":
                        tool_output = ToolService.send_email(
                            recipient_email=func_args.get("recipient_email"),
                            subject=func_args.get("subject"),
                            body=func_args.get("body"),
                        )
                    elif func_name == "get_system_diagnostics":
                        tool_output = ToolService.get_system_diagnostics()
                    elif func_name == "get_current_time":
                        tool_output = ToolService.get_current_time()
                    elif func_name == "get_weather":
                        tool_output = ToolService.get_weather(
                            location=func_args.get("location")
                        )
                    elif func_name == "web_search":
                        tool_output = ToolService.web_search(
                            query=func_args.get("query")
                        )
                    elif func_name == "create_image_from_prompt":
                        tool_output = ToolService.create_image_from_prompt(
                            prompt=func_args.get("prompt")
                        )
                    elif func_name == "create_video_from_prompt":
                        tool_output = ToolService.create_video_from_prompt(
                            prompt=func_args.get("prompt")
                        )
                    else:
                        tool_output = f"Error: Tool {func_name} not found."

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": func_name,
                        "content": tool_output,
                    })

                # Inject a system prompt to ensure LLM outputs the tool result (image/video link)
                messages.append({
                    "role": "system",
                    "content": (
                        "IMPORTANT: If an image or a video was generated by a tool (create_image_from_prompt "
                        "or create_video_from_prompt), you MUST include the exact markdown link/image/video syntax "
                        "returned in the tool content in your final response to the user so they can view it. "
                        "Do not alter, omit, or modify the URL or markdown link syntax."
                    )
                })

                # Call LLM again with tool results
                second_response = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.55,
                    max_tokens=max_tokens,
                )
                return second_response.choices[0].message.content

            return response_message.content or ""

        except Exception as e:
            return f"Model request failed: {str(e)}"
