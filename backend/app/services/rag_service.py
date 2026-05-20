import os
from pathlib import Path

from pypdf import PdfReader
from docx import Document

from app.services.vector_store import add_documents, search_documents


class RAGService:
    @staticmethod
    def _read_file(file_path: str) -> str:
        """
        Read content from PDF, DOCX, or TXT files.
        """
        ext = Path(file_path).suffix.lower()

        if ext == ".pdf":
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text

        elif ext == ".docx":
            doc = Document(file_path)
            return "\n".join([para.text for para in doc.paragraphs])

        elif ext in [".txt", ".md"]:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()

        else:
            raise Exception(f"Unsupported file type: {ext}")

    @staticmethod
    def _split_text(text: str, chunk_size: int = 1000, overlap: int = 150):
        """
        Split text into overlapping chunks.
        """
        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end].strip()

            if chunk:
                chunks.append(chunk)

            start += chunk_size - overlap

        return chunks

    @staticmethod
    def ingest_document(file_path: str):
        """
        Read a document, split it into chunks,
        and store the chunks in ChromaDB.
        """
        if not os.path.exists(file_path):
            raise Exception("File not found.")

        text = RAGService._read_file(file_path)

        if not text.strip():
            raise Exception("No text could be extracted from the document.")

        chunks = RAGService._split_text(text)

        if not chunks:
            raise Exception("No chunks were generated.")

        # Store chunks in your existing vector store
        add_documents(chunks)

        return {
            "message": "Document indexed successfully",
            "chunks": len(chunks),
        }

    @staticmethod
    def retrieve_context(query: str):
        """
        Search ChromaDB and return the most relevant text.
        """
        try:
            results = search_documents(query)

            if not results:
                return ""

            contexts = []

            for result in results:
                # If vector_store returns dictionaries
                if isinstance(result, dict):
                    content = result.get("content", "")
                else:
                    # If it returns strings
                    content = str(result)

                if content:
                    contexts.append(content)

            return "\n\n".join(contexts)

        except Exception as e:
            print(f"RAG Error: {e}")
            return ""