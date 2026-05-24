# RAG ChatBot

Full-stack Retrieval-Augmented Generation chatbot with:
- FastAPI backend
- React + Vite frontend
- SQLite users, sessions, and chat history
- File upload and document indexing
- ChromaDB vector search
- Groq/OpenAI-compatible chat completion
- Optional Tavily web search

## Features

- Login and signup
- Multiple chat sessions per user
- Chat history management
- Rename, delete, and clear chats
- File upload validation and indexing
- PDF, DOCX, TXT, Markdown, image, audio, and video upload support

## Quick Start

Run the backend:

```powershell
.\start_backend.bat
```

Run the frontend in a second terminal:

```powershell
.\start_frontend.bat
```

Open the frontend URL printed by Vite, usually:

```text
http://localhost:5173
```

## Manual Backend Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Manual Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

## Environment

Create `backend/.env` from `backend/.env.example` and set:

```text
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.groq.com/openai/v1
MODEL_NAME=llama-3.3-70b-versatile
TAVILY_API_KEY=your_tavily_key
DATABASE_URL=sqlite:///./rag_chatbot.db
CHROMA_PATH=../chroma_db
UPLOAD_DIR=../uploads
```
