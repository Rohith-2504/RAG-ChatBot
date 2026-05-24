import os
import tempfile

from app.services.audio_service import AudioService


class VideoService:

    @staticmethod
    def process_video(file_path: str):

        try:
            try:
                from moviepy import VideoFileClip
            except ImportError:
                from moviepy.editor import VideoFileClip
        except ImportError as e:
            return {
                "status": "error",
                "message": (
                    "Video processing dependency is missing. "
                    "Install moviepy."
                ),
                "error": str(e),
            }

        temp_audio = tempfile.NamedTemporaryFile(
            suffix=".mp3",
            delete=False,
        )
        temp_audio.close()

        try:
            video = VideoFileClip(file_path)

            if video.audio is None:
                return {
                    "status": "error",
                    "message": "Video file has no audio track.",
                }

            video.audio.write_audiofile(
                temp_audio.name
            )

            audio_result = (
                AudioService.process_audio(
                    temp_audio.name
                )
            )

        except Exception as e:
            audio_result = {
                "status": "error",
                "message": (
                    "Video processing failed. Make sure the file is valid "
                    "and FFmpeg is installed if required."
                ),
                "error": str(e),
            }

        finally:
            if "video" in locals():
                video.close()

            if os.path.exists(temp_audio.name):
                os.remove(temp_audio.name)

        if audio_result["status"] != "success":
            return audio_result

        return {
            "status": "success",
            "type": "video",
            "content": audio_result["content"],
        }
