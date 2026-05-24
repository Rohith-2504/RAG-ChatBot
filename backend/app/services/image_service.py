class ImageService:

    @staticmethod
    def process_image(file_path: str):

        try:
            import cv2
            import easyocr
        except ImportError as e:
            return {
                "status": "error",
                "message": (
                    "Image processing dependencies are missing. "
                    "Install easyocr and opencv-python."
                ),
                "error": str(e),
            }

        image = cv2.imread(file_path)

        if image is None:
            return {
                "status": "error",
                "message": "Unable to read image file.",
            }

        try:
            reader = easyocr.Reader(["en"])

            results = reader.readtext(image)

        except Exception as e:
            return {
                "status": "error",
                "message": "Image text extraction failed.",
                "error": str(e),
            }

        extracted_text = ""

        for result in results:
            extracted_text += result[1] + "\n"

        return {
            "status": "success",
            "type": "image",
            "content": extracted_text,
        }
