class AudioService:

    @staticmethod
    def process_audio(file_path: str):

        try:
            import whisper
        except ImportError as e:
            return {
                "status": "error",
                "message": (
                    "Audio processing dependency is missing. "
                    "Install openai-whisper."
                ),
                "error": str(e),
            }

        try:
            model = whisper.load_model("base")

            result = model.transcribe(file_path)

        except Exception as e:
            return {
                "status": "error",
                "message": (
                    "Audio transcription failed. Make sure the file is valid "
                    "and FFmpeg is installed if required."
                ),
                "error": str(e),
            }

        return {
            "status": "success",
            "type": "audio",
            "content": result["text"],
        }
