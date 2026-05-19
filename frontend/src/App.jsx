import api from "./services/api";
import React, { useEffect, useState } from "react";

export default function App() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Connecting to backend...");

  useEffect(() => {
    async function init() {
      try {
        const res = await api.post("/chat/conversation");
        setConversationId(res.data.conversation_id);
        setStatus("Connected successfully.");
      } catch (error) {
        console.error("Backend connection failed:", error);
        setStatus("❌ Backend is not running. Start FastAPI on port 8000.");
      }
    }

    init();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !conversationId) return;

    const userText = input;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userText },
    ]);

    setInput("");

    try {
      const res = await api.post("/chat", {
        conversation_id: conversationId,
        message: userText,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.answer },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Error communicating with backend.",
        },
      ]);
    }
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>🤖 RAG ChatBot</h1>
      <p>{status}</p>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          minHeight: "400px",
          padding: "16px",
          marginBottom: "16px",
          overflowY: "auto",
          backgroundColor: "#fafafa",
        }}
      >
        {messages.length === 0 ? (
          <p>No messages yet. Ask something!</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: "16px" }}>
              <strong>
                {msg.role === "user" ? "You" : "Assistant"}:
              </strong>
              <p>{msg.content}</p>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask a question..."
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "12px 20px",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}