import os
from pathlib import Path

from app.services.vector_store import (
    add_documents,
    search_documents,
)

from app.services.media_service import (
    MediaService,
)


class RAGService:

    @staticmethod
    def _split_text(
        text: str,
        chunk_size: int = 1000,
        overlap: int = 150,
    ):
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
        Process uploaded file using MediaService,
        split into chunks,
        and store in vector database.
        """

        if not os.path.exists(file_path):
            raise Exception("File not found.")

        # Process any file type
        result = MediaService.process_file(
            file_path
        )

        if result["status"] != "success":
            raise Exception(
                result.get(
                    "message",
                    "Failed to process file.",
                )
            )

        text = result.get("content", "")

        if not text.strip():
            raise Exception(
                "No text could be extracted."
            )

        # Split into chunks
        chunks = RAGService._split_text(
            text
        )

        if not chunks:
            raise Exception(
                "No chunks were generated."
            )

        # Metadata
        metadatas = [
            {
                "source": file_path,
                "chunk_id": i,
                "type": result.get(
                    "type",
                    "unknown",
                ),
            }
            for i in range(len(chunks))
        ]

        # Store in vector DB
        add_documents(
            chunks,
            metadatas,
        )

        return {
            "status": "success",
            "message": "Document indexed successfully",
            "file_type": result.get("type"),
            "chunks": len(chunks),
            "content": text,
        }

    @staticmethod
    def retrieve_context(query: str):
        """
        Retrieve relevant chunks
        from vector database.
        """

        try:

            results = search_documents(
                query
            )

            if not results:
                return ""

            contexts = []

            for result in results:

                # Dict format
                if isinstance(result, dict):

                    content = result.get(
                        "content",
                        "",
                    )

                else:
                    content = str(result)

                if content:
                    contexts.append(content)

            # Limit context size
            final_context = "\n\n".join(
                contexts
            )

            MAX_CONTEXT_CHARS = 4000

            return final_context[
                :MAX_CONTEXT_CHARS
            ]

        except Exception as e:

            print(f"RAG Error: {e}")

            return ""