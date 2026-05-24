import os

from app.services.image_service import ImageService
from app.services.video_service import VideoService
from app.services.pdf_service import PDFService
from app.services.audio_service import AudioService
from app.services.document_service import DocumentService


class MediaService:

    @staticmethod
    def process_file(file_path: str):

        extension = (
            os.path.splitext(file_path)[1]
            .lower()
            .replace(".", "")
        )

        if extension in ["png", "jpg", "jpeg"]:
            return ImageService.process_image(file_path)

        elif extension in ["mp4", "mov", "avi"]:
            return VideoService.process_video(file_path)

        elif extension in ["pdf"]:
            return PDFService.process_pdf(file_path)

        elif extension in ["docx", "txt", "md"]:
            return DocumentService.process_document(file_path)

        elif extension in ["mp3", "wav", "m4a"]:
            return AudioService.process_audio(file_path)

        else:
            return {
                "status": "error",
                "message": "Unsupported file type",
            }
