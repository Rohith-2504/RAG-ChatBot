import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from app.core.config import settings

embedding_function = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
client = chromadb.PersistentClient(path=settings.CHROMA_PATH)
collection = client.get_or_create_collection(
    name="documents",
    embedding_function=embedding_function
)

def add_documents(chunks, metadatas):
    start = collection.count()
    ids = [f"doc_{start+i}" for i in range(len(chunks))]
    collection.add(documents=chunks, metadatas=metadatas, ids=ids)

def search_documents(query, k=4):
    if collection.count() == 0:
        return []
    results = collection.query(query_texts=[query], n_results=k)
    docs = results["documents"][0]
    metas = results["metadatas"][0]
    return [{"content": d, "metadata": m} for d, m in zip(docs, metas)]
