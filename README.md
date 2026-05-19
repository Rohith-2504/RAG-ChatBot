# RAG ChatBot

Full-stack Retrieval-Augmented Generation chatbot using:
- Python + FastAPI
- OpenAI API
- ChromaDB
- SQLite
- React + Vite

## Setup

1. Copy `backend/.env.example` to `backend/.env`
2. Add your OpenAI API key
3. Run backend and frontend

## Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

## Frontend
cd frontend
npm install
npm run dev
