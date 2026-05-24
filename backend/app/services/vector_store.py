import uuid
from datetime import datetime

import chromadb

from chromadb.utils.embedding_functions import (
    SentenceTransformerEmbeddingFunction,
)

from app.core.config import settings

# ==========================================
# Embedding Function
# ==========================================

embedding_function = (
    SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
)

# ==========================================
# ChromaDB Client
# ==========================================

client = chromadb.PersistentClient(
    path=settings.CHROMA_PATH
)

# ==========================================
# Collection
# ==========================================

collection = client.get_or_create_collection(
    name="documents",
    embedding_function=embedding_function,
)

# ==========================================
# Add Documents
# ==========================================

def add_documents(
    chunks,
    metadatas,
):

    if not chunks:
        return

    ids = []

    enriched_metadatas = []

    for i, metadata in enumerate(
        metadatas
    ):

        # Unique document ID
        doc_id = str(uuid.uuid4())

        ids.append(doc_id)

        # Enrich metadata
        enriched_metadata = {
            **metadata,
            "document_id": doc_id,
            "created_at": str(
                datetime.utcnow()
            ),
        }

        enriched_metadatas.append(
            enriched_metadata
        )

    collection.add(
        documents=chunks,
        metadatas=enriched_metadatas,
        ids=ids,
    )

# ==========================================
# Search Documents
# ==========================================

def search_documents(
    query,
    k=4,
):

    try:

        if collection.count() == 0:
            return []

        results = collection.query(
            query_texts=[query],
            n_results=k,
        )

        documents = results.get(
            "documents",
            [[]],
        )[0]

        metadatas = results.get(
            "metadatas",
            [[]],
        )[0]

        distances = results.get(
            "distances",
            [[]],
        )[0]

        formatted_results = []

        for i in range(
            len(documents)
        ):

            formatted_results.append({
                "content": documents[i],
                "metadata": (
                    metadatas[i]
                    if i < len(metadatas)
                    else {}
                ),
                "distance": (
                    distances[i]
                    if i < len(distances)
                    else None
                ),
            })

        return formatted_results

    except Exception as e:

        print(
            f"Vector Search Error: {e}"
        )

        return []

# ==========================================
# Delete Documents
# ==========================================

def delete_document_by_source(
    source_path: str
):

    try:

        results = collection.get()

        ids_to_delete = []

        metadatas = results.get(
            "metadatas",
            [],
        )

        ids = results.get(
            "ids",
            [],
        )

        for i, metadata in enumerate(
            metadatas
        ):

            if (
                metadata
                and metadata.get("source")
                == source_path
            ):

                ids_to_delete.append(
                    ids[i]
                )

        if ids_to_delete:

            collection.delete(
                ids=ids_to_delete
            )

        return {
            "status": "success",
            "deleted": len(
                ids_to_delete
            ),
        }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e),
        }

# ==========================================
# Collection Stats
# ==========================================

def get_collection_stats():

    try:

        count = collection.count()

        return {
            "status": "success",
            "total_documents": count,
            "collection_name": (
                "documents"
            ),
        }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e),
        }

# ==========================================
# Clear Entire Collection
# ==========================================

def clear_collection():

    try:

        all_docs = collection.get()

        ids = all_docs.get(
            "ids",
            [],
        )

        if ids:

            collection.delete(
                ids=ids
            )

        return {
            "status": "success",
            "message": (
                "Collection cleared"
            ),
        }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e),
        }