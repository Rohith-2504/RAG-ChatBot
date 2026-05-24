from docx import Document


class DocumentService:

    @staticmethod
    def process_document(file_path: str):

        if (
            file_path.endswith(".txt")
            or file_path.endswith(".md")
        ):

            try:
                with open(
                    file_path,
                    "r",
                    encoding="utf-8",
                ) as file:

                    text = file.read()

            except Exception as e:
                return {
                    "status": "error",
                    "message": "Text file extraction failed.",
                    "error": str(e),
                }

            return {
                "status": "success",
                "type": (
                    "md"
                    if file_path.endswith(".md")
                    else "txt"
                ),
                "content": text,
            }

        elif file_path.endswith(".docx"):

            try:
                document = Document(file_path)

                extracted_text = ""

                for para in document.paragraphs:
                    extracted_text += para.text + "\n"

            except Exception as e:
                return {
                    "status": "error",
                    "message": "DOCX text extraction failed.",
                    "error": str(e),
                }

            return {
                "status": "success",
                "type": "docx",
                "content": extracted_text,
            }

        return {
            "status": "error",
            "message": "Unsupported document format",
        }
