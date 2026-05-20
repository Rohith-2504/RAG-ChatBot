import React, { useEffect, useRef, useState } from "react";
import api from "./services/api";

const COLORS = {
  bg: "#020617",
  bgSecondary: "#0f172a",
  card: "rgba(15, 23, 42, 0.75)",
  cardLight: "rgba(30, 41, 59, 0.55)",
  border: "rgba(255,255,255,0.08)",
  white: "#ffffff",
  text: "#e2e8f0",
  subtext: "#94a3b8",
  blue: "#2563eb",
  blueDark: "#1d4ed8",
  success: "#10b981",
};

export default function App() {
  const [conversationId, setConversationId] =
    useState(null);

  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState(
    "Connecting..."
  );

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [showSettings, setShowSettings] =
    useState(false);

  const [darkMode, setDarkMode] =
    useState(true);

  const [username, setUsername] =
    useState("Rohith");

  const [notifications, setNotifications] =
    useState(true);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    initializeConversation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function initializeConversation() {
    try {
      const fakeConversationId =
        "conv_" + Date.now();

      setConversationId(fakeConversationId);

      setStatus("Connected Successfully");
    } catch (error) {
      console.error(error);

      setStatus("Backend Connection Failed");
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input.trim();

    const userMessage = {
      role: "user",
      content: userText,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput("");

    setLoading(true);

    try {
      const res = await api.post("/chat", {
        message: userText,
      });

      const assistantMessage = {
        role: "assistant",
        content:
          res.data.answer ||
          "No response received.",
      };

      setMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "❌ Backend connection failed.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      sendMessage();
    }
  }

  function startNewConversation() {
    setMessages([]);

    initializeConversation();
  }

  return (
    <>
      <div style={styles.page}>
        {/* MOBILE TOPBAR */}

        <div style={styles.mobileTopbar}>
          <button
            style={styles.mobileMenuButton}
            onClick={() =>
              setSidebarOpen(!sidebarOpen)
            }
          >
            ☰
          </button>

          <div style={styles.mobileTitle}>
            🤖 RAG ChatBot
          </div>
        </div>

        {/* SIDEBAR */}

        <aside
          style={{
            ...styles.sidebarRail,
            left: sidebarOpen ? 0 : "-100%",
          }}
        >
          <button
            style={styles.plusButton}
            onClick={startNewConversation}
          >
            +
          </button>

          <div style={styles.railSpacer} />

          <div style={styles.userSection}>
            <div style={styles.avatar}>
              {username.charAt(0)}
            </div>

            <div style={styles.username}>
              {username}
            </div>

            <div style={styles.userStatus}>
              ● Online
            </div>
          </div>

          <button
            style={styles.settingButton}
            onClick={() =>
              setDarkMode(!darkMode)
            }
          >
            {darkMode
              ? "☀️ Light"
              : "🌙 Dark"}
          </button>

          <div
            style={styles.railIcon}
            onClick={() =>
              setShowSettings(true)
            }
          >
            ⚙️
          </div>
        </aside>

        {/* CONVERSATION PANEL */}

        <aside style={styles.inboxPanel}>
          <div style={styles.panelHeader}>
            Inbox
          </div>

          <div style={styles.sectionTitle}>
            Recent Conversations
          </div>

          {messages
            .filter((m) => m.role === "user")
            .map((msg, index) => (
              <div
                key={index}
                style={styles.conversationItem}
              >
                <div
                  style={
                    styles.conversationTitle
                  }
                >
                  {msg.content.slice(0, 30)}

                  {msg.content.length > 30
                    ? "..."
                    : ""}
                </div>

                <div
                  style={
                    styles.conversationPreview
                  }
                >
                  User Message
                </div>
              </div>
            ))}

          <button
            style={
              styles.newConversationButton
            }
            onClick={startNewConversation}
          >
            + New Conversation
          </button>
        </aside>

        {/* CHAT PANEL */}

        <main style={styles.chatPanel}>
          {/* HEADER */}

          <header style={styles.chatHeader}>
            <div>
              <div style={styles.botName}>
                🤖 AI Assistant
              </div>

              <div style={styles.botMeta}>
                {status}
              </div>
            </div>

            <div style={styles.headerActions}>
              <button
                style={styles.headerButton}
              >
                🔔
              </button>

              <button
                style={styles.headerButton}
              >
                📁
              </button>

              <button
                style={styles.headerButton}
              >
                👤
              </button>
            </div>
          </header>

          {/* MESSAGES */}

          <section style={styles.messagesArea}>
            {messages.length === 0 &&
              !loading && (
                <div
                  style={styles.welcomeCard}
                >
                  <h2
                    style={{
                      marginTop: 0,
                    }}
                  >
                    Welcome {username} 👋
                  </h2>

                  <p
                    style={{
                      color:
                        COLORS.subtext,
                      lineHeight: 1.8,
                    }}
                  >
                    Ask questions about
                    your PDFs, resumes,
                    documents, projects,
                    notes, datasets, or
                    anything uploaded into
                    the RAG system.
                  </p>
                </div>
              )}

            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent:
                    msg.role === "user"
                      ? "flex-end"
                      : "flex-start",

                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    ...styles.messageBubble,

                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
                        : "rgba(30,41,59,0.7)",

                    color:
                      msg.role === "user"
                        ? "#fff"
                        : COLORS.text,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div
                style={{
                  display: "flex",
                }}
              >
                <div
                  style={{
                    ...styles.messageBubble,
                    background:
                      "rgba(30,41,59,0.7)",
                  }}
                >
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </section>

          {/* INPUT */}

          <footer style={styles.inputContainer}>
            <textarea
              placeholder="Ask anything..."
              rows={2}
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              onKeyDown={handleKeyDown}
              style={styles.textarea}
            />

            <button
              onClick={sendMessage}
              disabled={
                loading || !input.trim()
              }
              style={{
                ...styles.sendButton,
                opacity:
                  loading || !input.trim()
                    ? 0.6
                    : 1,
              }}
            >
              ➤
            </button>
          </footer>
        </main>

        {/* SETTINGS MODAL */}

        {showSettings && (
          <div style={styles.settingsOverlay}>
            <div style={styles.settingsModal}>
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                Settings
              </h2>

              <div style={styles.settingRow}>
                <span>Dark Mode</span>

                <button
                  style={styles.modalButton}
                  onClick={() =>
                    setDarkMode(
                      !darkMode
                    )
                  }
                >
                  {darkMode
                    ? "Disable"
                    : "Enable"}
                </button>
              </div>

              <div style={styles.settingRow}>
                <span>Notifications</span>

                <button
                  style={styles.modalButton}
                  onClick={() =>
                    setNotifications(
                      !notifications
                    )
                  }
                >
                  {notifications
                    ? "ON"
                    : "OFF"}
                </button>
              </div>

              <div style={styles.settingRow}>
                <span>Username</span>

                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                  style={styles.settingInput}
                />
              </div>

              <button
                style={{
                  ...styles.modalButton,
                  width: "100%",
                  marginTop: 20,
                }}
                onClick={() =>
                  setShowSettings(false)
                }
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  page: {
    display: "grid",
    gridTemplateColumns:
      "80px 280px 1fr",
    height: "100vh",
    overflow: "hidden",
    background:
      "linear-gradient(135deg,#020617,#0f172a,#111827)",
    fontFamily:
      "Inter, system-ui, sans-serif",
    color: COLORS.text,
  },

  mobileTopbar: {
    display: "none",
  },

  mobileMenuButton: {
    border: "none",
    background: "transparent",
    color: "#fff",
    fontSize: 24,
    cursor: "pointer",
  },

  mobileTitle: {
    fontWeight: 700,
    fontSize: 18,
  },

  sidebarRail: {
    background:
      "rgba(15,23,42,0.85)",
    backdropFilter: "blur(18px)",
    borderRight: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px 12px",
    transition: "0.3s",
    zIndex: 1000,
  },

  plusButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    border: "none",
    background:
      "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    fontSize: 32,
    fontWeight: 700,
    cursor: "pointer",
    transition: "0.3s",
  },

  railSpacer: {
    flex: 1,
  },

  userSection: {
    textAlign: "center",
    marginBottom: 20,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    background:
      "linear-gradient(135deg,#2563eb,#1d4ed8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 22,
    marginBottom: 10,
  },

  username: {
    fontWeight: 600,
  },

  userStatus: {
    color: COLORS.success,
    fontSize: 13,
    marginTop: 4,
  },

  settingButton: {
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 14,
    border: "none",
    background:
      "rgba(255,255,255,0.08)",
    color: "#fff",
    cursor: "pointer",
    transition: "0.3s",
  },

  railIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background:
      "rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "0.3s",
  },

  inboxPanel: {
    padding: 24,
    overflowY: "auto",
    background:
      "rgba(15,23,42,0.6)",
    backdropFilter: "blur(18px)",
    borderRight: `1px solid ${COLORS.border}`,
  },

  panelHeader: {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 20,
  },

  sectionTitle: {
    color: COLORS.subtext,
    marginBottom: 14,
    fontWeight: 600,
  },

  conversationItem: {
    padding: "14px",
    borderRadius: 18,
    marginBottom: 12,
    background:
      "rgba(255,255,255,0.05)",
    border: `1px solid ${COLORS.border}`,
    cursor: "pointer",
    transition: "0.3s",
  },

  conversationTitle: {
    fontWeight: 600,
  },

  conversationPreview: {
    color: COLORS.subtext,
    marginTop: 4,
    fontSize: 13,
  },

  newConversationButton: {
    marginTop: 20,
    width: "100%",
    padding: "14px",
    borderRadius: 18,
    border: "none",
    background:
      "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    transition: "0.3s",
  },

  chatPanel: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background:
      "rgba(15,23,42,0.55)",
    backdropFilter: "blur(20px)",
  },

  chatHeader: {
    padding: "20px 28px",
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  botName: {
    fontSize: 28,
    fontWeight: 800,
  },

  botMeta: {
    color: COLORS.subtext,
    marginTop: 4,
    fontSize: 13,
  },

  headerActions: {
    display: "flex",
    gap: 12,
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "none",
    background:
      "rgba(255,255,255,0.08)",
    color: "#fff",
    cursor: "pointer",
    transition: "0.3s",
  },

  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
  },

  welcomeCard: {
    maxWidth: 620,
    padding: 30,
    borderRadius: 28,
    background:
      "rgba(15,23,42,0.7)",
    border: `1px solid ${COLORS.border}`,
    backdropFilter: "blur(18px)",
  },

  messageBubble: {
    maxWidth: "75%",
    padding: "14px 18px",
    borderRadius: 22,
    lineHeight: 1.7,
    fontSize: 15,
    whiteSpace: "pre-wrap",
    backdropFilter: "blur(12px)",
    border: `1px solid ${COLORS.border}`,
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.25)",
  },

  inputContainer: {
    padding: 20,
    display: "flex",
    gap: 14,
    borderTop: `1px solid ${COLORS.border}`,
  },

  textarea: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    resize: "none",
    outline: "none",
    border: `1px solid ${COLORS.border}`,
    background:
      "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: 15,
  },

  sendButton: {
    width: 64,
    border: "none",
    borderRadius: 20,
    background:
      "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    fontSize: 24,
    cursor: "pointer",
    transition: "0.3s",
  },

  settingsOverlay: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(0,0,0,0.6)",
    backdropFilter: "blur(10px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },

  settingsModal: {
    width: 420,
    maxWidth: "90%",
    padding: 30,
    borderRadius: 28,
    background:
      "rgba(15,23,42,0.92)",
    border: `1px solid ${COLORS.border}`,
    backdropFilter: "blur(18px)",
  },

  settingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 20,
  },

  settingInput: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${COLORS.border}`,
    background:
      "rgba(255,255,255,0.05)",
    color: "#fff",
    outline: "none",
  },

  modalButton: {
    padding: "12px 18px",
    borderRadius: 14,
    border: "none",
    background:
      "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
};

/* RESPONSIVE */

const mediaQuery = document.createElement(
  "style"
);

mediaQuery.innerHTML = `
@media (max-width: 1100px) {

  .inboxPanel {
    display: none !important;
  }

}

@media (max-width: 768px) {

  body {
    overflow: hidden;
  }

  .page {
    display: flex !important;
    flex-direction: column !important;
  }

  .sidebarRail {
    position: fixed !important;
    top: 0;
    height: 100vh;
  }

}
`;

document.head.appendChild(mediaQuery);