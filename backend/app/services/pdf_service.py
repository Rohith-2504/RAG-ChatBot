from pypdf import PdfReader


class PDFService:

    @staticmethod
    def process_pdf(file_path: str):

        try:
            reader = PdfReader(file_path)

            extracted_text = ""

            for page in reader.pages:
                text = page.extract_text()

                if text:
                    extracted_text += text + "\n"

        except Exception as e:
            return {
                "status": "error",
                "message": "PDF text extraction failed.",
                "error": str(e),
            }

        return {
            "status": "success",
            "type": "pdf",
            "content": extracted_text,
        }
