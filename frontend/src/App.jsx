import { useEffect, useState } from "react";
import api from "./services/api";

export default function App() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    api.post("/chat/conversation").then((res) => {
      setConversationId(res.data.conversation_id);
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !conversationId) return;
    const text = input;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    const res = await api.post("/chat", {
      conversation_id: conversationId,
      message: text,
    });

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: res.data.answer },
    ]);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "Arial" }}>
      <h1>RAG ChatBot</h1>
      <p>Upload documents and ask questions using OpenAI + ChromaDB.</p>

      <div style={{ border: "1px solid #ddd", minHeight: 400, padding: 16, marginBottom: 16 }}>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.role === "user" ? "You" : "Assistant"}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1, padding: 12 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask a question..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
