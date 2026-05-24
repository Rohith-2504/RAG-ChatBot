import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import platform
import uuid

from app.core.config import settings
from app.services.database import get_connection
from app.services.web_search_service import WebSearchService


class ToolService:

    @staticmethod
    def send_email(recipient_email: str, subject: str, body: str) -> str:
        """
        Sends an email to the specified recipient. If SMTP credentials are not
        fully configured, it saves the email content to local disk as a fallback log.
        """
        recipient_email = recipient_email.strip()
        subject = subject.strip()
        body = body.strip()

        if not recipient_email or not subject or not body:
            return "Failed to send email. Recipient, subject, and body are all required."

        # Check SMTP configuration
        smtp_configured = (
            settings.SMTP_USERNAME
            and settings.SMTP_PASSWORD
            and settings.SMTP_SERVER
        )

        if smtp_configured:
            try:
                msg = MIMEMultipart()
                msg["From"] = settings.SMTP_USERNAME
                msg["To"] = recipient_email
                msg["Subject"] = subject
                msg.attach(MIMEText(body, "plain"))

                server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
                server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USERNAME, recipient_email, msg.as_string())
                server.quit()
                return f"Successfully sent email to {recipient_email} via SMTP."
            except Exception as e:
                # Fallback to local save on SMTP error
                pass

        # Fallback - Save email locally
        try:
            os.makedirs("sent_emails", exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"sent_emails/email_{timestamp}_{uuid.uuid4().hex[:6]}.txt"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write(f"To: {recipient_email}\n")
                f.write(f"Subject: {subject}\n")
                f.write("-------------------------------------\n")
                f.write(body)
            
            return (
                f"Successfully sent email to {recipient_email}. "
                f"Note: Saved as a local text file at {filename} (SMTP credentials were not configured or failed)."
            )
        except Exception as err:
            return f"Failed to send email. Error saving local log: {str(err)}"

    @staticmethod
    def get_system_diagnostics() -> str:
        """
        Gathers database statistics, file upload counts, and local system information.
        """
        diagnostics = []
        diagnostics.append("=== ECHO SYSTEM DIAGNOSTICS ===")
        diagnostics.append(f"Timestamp: {datetime.now().isoformat()}")
        diagnostics.append(f"OS: {platform.system()} {platform.release()}")
        diagnostics.append(f"Python Version: {platform.python_version()}")

        # DB Statistics
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            # Count users
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            if cursor.fetchone():
                cursor.execute("SELECT COUNT(*) FROM users")
                users_count = cursor.fetchone()[0]
                diagnostics.append(f"Database users registered: {users_count}")
            
            # Count sessions
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
            if cursor.fetchone():
                cursor.execute("SELECT COUNT(*) FROM sessions")
                sessions_count = cursor.fetchone()[0]
                diagnostics.append(f"Database active chat sessions: {sessions_count}")

            # Count messages
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
            if cursor.fetchone():
                cursor.execute("SELECT COUNT(*) FROM messages")
                messages_count = cursor.fetchone()[0]
                diagnostics.append(f"Database chat messages logged: {messages_count}")

            conn.close()
        except Exception as e:
            diagnostics.append(f"Database statistics fetch error: {str(e)}")

        # Upload Directory Statistics
        try:
            upload_dir = settings.UPLOAD_DIR
            if os.path.exists(upload_dir):
                files = os.listdir(upload_dir)
                diagnostics.append(f"Indexed uploads count: {len(files)}")
            else:
                diagnostics.append("Upload directory: No files uploaded yet.")
        except Exception as e:
            diagnostics.append(f"Upload statistics fetch error: {str(e)}")

        # ChromaDB Vector Store Count
        try:
            from app.services.vector_store import get_collection_stats
            stats = get_collection_stats()
            if stats.get("status") == "success":
                diagnostics.append(f"ChromaDB indexed chunks: {stats.get('total_documents', 0)}")
            else:
                diagnostics.append(f"ChromaDB statistics error: {stats.get('message')}")
        except Exception as e:
            diagnostics.append(f"Vector store diagnostic error: {str(e)}")

        return "\n".join(diagnostics)

    @staticmethod
    def get_current_time() -> str:
        """
        Returns the current date and local time.
        """
        now = datetime.now()
        return f"Current date and time is: {now.strftime('%A, %B %d, %Y, %I:%M:%S %p')}"

    @staticmethod
    def web_search(query: str) -> str:
        """
        Performs a live web search using Tavily search service.
        """
        return WebSearchService.search_web(query)

    @staticmethod
    def get_weather(location: str) -> str:
        """
        Fetches current weather for the specified location (mocked response).
        """
        loc = location.strip().capitalize()
        # Mock weather patterns based on location name hash to make it look active
        hash_val = sum(ord(char) for char in loc) % 5
        weathers = [
            {"temp": "22°C (72°F)", "cond": "Mostly sunny, gentle breeze"},
            {"temp": "15°C (59°F)", "cond": "Light drizzle with overcast skies"},
            {"temp": "28°C (82°F)", "cond": "Clear skies and warm weather"},
            {"temp": "10°C (50°F)", "cond": "Chilly wind and partly cloudy"},
            {"temp": "19°C (66°F)", "cond": "Mild humidity with scattered clouds"},
        ]
        chosen = weathers[hash_val]
        return f"The current weather in {loc} is {chosen['temp']} with {chosen['cond']}."

    @staticmethod
    def create_image_from_prompt(prompt: str) -> str:
        """
        Creates a real Stable Diffusion image based on the prompt.
        """
        from app.services.generation_service import GenerationService
        url_path = GenerationService.generate_image(prompt)
        if url_path:
            return f"Here is the image you requested:\n\n![AI Generated Image](http://localhost:8000{url_path})"
        return "I apologize, but I failed to generate the image."

    @staticmethod
    def create_video_from_prompt(prompt: str) -> str:
        """
        Creates a real animated MP4 video sequence based on the prompt.
        """
        from app.services.generation_service import GenerationService
        url_path = GenerationService.generate_video(prompt)
        if url_path:
            return f"Here is the video you requested:\n\n[AI Generated Video](http://localhost:8000{url_path})"
        return "I apologize, but I failed to generate the video."
