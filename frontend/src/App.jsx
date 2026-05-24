import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const API_BASE = "http://localhost:8000/api";

const ACCEPTED_FILES = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".mp3",
  ".wav",
  ".m4a",
  ".mp4",
  ".mov",
  ".avi",
];

const MAX_FILE_BYTES = 25 * 1024 * 1024;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "Request failed.");
  }

  return data;
}

function getFileExtension(name) {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
}

function initials(name = "User") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("rag_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const loadedUserIdRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechQueueRef = useRef([]);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId),
    [sessions, currentSessionId],
  );

  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window;

  const recognitionSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    injectGlobalStyles();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (loadedUserIdRef.current === user.id) return;

    loadedUserIdRef.current = user.id;
    loadSessions(user.id);
  }, [user]);

  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }

    loadMessages(currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    if (!voiceEnabled || !speechSupported || !messages.length) return;

    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role !== "assistant") return;

    speak(lastMessage.content);
  }, [messages, voiceEnabled, speechSupported]);

  function injectGlobalStyles() {
    if (document.getElementById("rag-global-styles")) return;

    const style = document.createElement("style");
    style.id = "rag-global-styles";
    style.innerHTML = `
      * { box-sizing: border-box; }
      html, body, #root { width: 100%; min-height: 100%; margin: 0; }
      body {
        overflow: hidden;
        background:
          radial-gradient(circle at 14% 12%, rgba(56, 189, 248, 0.2), transparent 34%),
          radial-gradient(circle at 86% 18%, rgba(168, 85, 247, 0.16), transparent 30%),
          linear-gradient(145deg, #07111f 0%, #0a1020 46%, #050815 100%);
      }
      button, textarea, input { font: inherit; }
      button { transition: transform 160ms ease, background 160ms ease, border 160ms ease; }
      button:hover { transform: translateY(-1px); }
      ::selection { background: rgba(56, 189, 248, 0.35); }
      @media (max-width: 900px) {
        body { overflow: auto; }
      }
    `;
    document.head.appendChild(style);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setNotice("");
    setLoading(true);

    try {
      const path = authMode === "signup" ? "/auth/signup" : "/auth/login";
      const body =
        authMode === "signup"
          ? authForm
          : { email: authForm.email, password: authForm.password };

      const data = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      localStorage.setItem("rag_user", JSON.stringify(data.user));
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    stopSpeaking();
    localStorage.removeItem("rag_user");
    loadedUserIdRef.current = null;
    setUser(null);
    setSessions([]);
    setCurrentSessionId(null);
    setMessages([]);
  }

  async function loadSessions(userId) {
    setNotice("");

    try {
      const data = await apiRequest(`/sessions/?user_id=${encodeURIComponent(userId)}`);
      setSessions(data.sessions || []);

      if (data.sessions?.length) {
        setCurrentSessionId(data.sessions[0].id);
      } else {
        await createSession(userId);
      }
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function createSession(userId = user?.id) {
    if (!userId) return null;
    setNotice("");

    try {
      const data = await apiRequest("/sessions/", {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      setSessions((prev) => [data.session, ...prev]);
      setCurrentSessionId(data.session.id);
      setMessages([]);

      return data.session;
    } catch (error) {
      setNotice(error.message);
      return null;
    }
  }

  async function loadMessages(sessionId) {
    setNotice("");

    try {
      const data = await apiRequest(`/messages/${sessionId}`);
      setMessages(data.messages || []);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function renameSession(sessionId, title) {
    const cleanTitle = title.trim() || "New Chat";

    try {
      await apiRequest(`/sessions/${sessionId}`, {
        method: "PUT",
        body: JSON.stringify({ title: cleanTitle }),
      });

      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, title: cleanTitle } : session,
        ),
      );
      setEditingTitleId(null);
      setEditingTitle("");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function deleteSession(sessionId) {
    if (!user) return;

    try {
      await apiRequest(
        `/sessions/${sessionId}?user_id=${encodeURIComponent(user.id)}`,
        { method: "DELETE" },
      );

      const remaining = sessions.filter((session) => session.id !== sessionId);
      setSessions(remaining);

      if (currentSessionId === sessionId) {
        if (remaining.length) {
          setCurrentSessionId(remaining[0].id);
        } else {
          await createSession(user.id);
        }
      }
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function clearCurrentChat() {
    if (!currentSessionId) return;

    try {
      await apiRequest(`/messages/${currentSessionId}`, {
        method: "DELETE",
      });
      stopSpeaking();
      setMessages([]);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !user) return;

    let sessionId = currentSessionId;

    if (!sessionId) {
      const createdSession = await createSession(user.id);
      sessionId = createdSession?.id;
    }

    if (!sessionId) return;

    setInput("");
    setLoading(true);
    setNotice("");
    stopSpeaking();

    const optimisticUserMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      const data = await apiRequest("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          user_id: user.id,
        }),
      });

      const returnedSessionId = data.session_id || sessionId;
      setCurrentSessionId(returnedSessionId);

      const activeSession = sessions.find(
        (session) => session.id === returnedSessionId,
      );

      if (activeSession?.title === "New Chat") {
        const title = text.length > 36 ? `${text.slice(0, 36)}...` : text;
        await renameSession(returnedSessionId, title);
      }

      await loadMessages(returnedSessionId);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-error-${Date.now()}`,
          role: "assistant",
          content: `I hit a backend problem: ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    setUploading(true);
    setNotice("");

    try {
      for (const file of files) {
        const extension = getFileExtension(file.name);

        if (!ACCEPTED_FILES.includes(extension)) {
          throw new Error(`${file.name} is not a supported file type.`);
        }

        if (file.size > MAX_FILE_BYTES) {
          throw new Error(`${file.name} is larger than 25 MB.`);
        }

        const formData = new FormData();
        formData.append("file", file);

        const data = await apiRequest("/upload", {
          method: "POST",
          body: formData,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `upload-${Date.now()}-${file.name}`,
            role: "assistant",
            content: `${data.filename} is uploaded and indexed. I found ${data.data?.chunks || 0} useful chunks in it.`,
          },
        ]);
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function startListening() {
    if (!recognitionSupported || listening) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      setInput(transcript.trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function getPreferredVoice() {
    const voices = window.speechSynthesis.getVoices();

    return (
      voices.find((voice) =>
        /natural|neural|online|guy|daniel|alex|google uk english male/i.test(
          voice.name,
        ),
      ) ||
      voices.find((voice) =>
        /en-GB|en-US/i.test(voice.lang) && /male|guy|daniel|alex/i.test(voice.name),
      ) ||
      voices.find((voice) => /en-GB/i.test(voice.lang)) ||
      voices.find((voice) => /en-US/i.test(voice.lang)) ||
      voices[0]
    );
  }

  function splitForSpeech(text) {
    return String(text)
      .replace(/\s+/g, " ")
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 8) || [];
  }

  function speak(text) {
    if (!speechSupported || !text) return;

    window.speechSynthesis.cancel();

    const preferredVoice = getPreferredVoice();
    speechQueueRef.current = splitForSpeech(text);

    function speakNext() {
      const nextText = speechQueueRef.current.shift();

      if (!nextText) {
        setSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(nextText);

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.rate = 0.88;
      utterance.pitch = 0.82;
      utterance.volume = 0.9;
      utterance.onend = () => {
        window.setTimeout(speakNext, 90);
      };
      utterance.onerror = () => setSpeaking(false);

      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }

    speakNext();
  }

  function stopSpeaking() {
    if (speechSupported) {
      speechQueueRef.current = [];
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }

  function toggleVoice() {
    if (!speechSupported) {
      setNotice("Voice playback is not supported in this browser.");
      return;
    }

    setVoiceEnabled((enabled) => {
      if (enabled) {
        stopSpeaking();
      }

      return !enabled;
    });
  }

  if (!user) {
    return (
      <main style={styles.authPage}>
        <form style={styles.authCard} onSubmit={handleAuth}>
          <div style={styles.authBrand}>JARVIS RAG</div>
          <h1 style={styles.authTitle}>
            {authMode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p style={styles.authText}>
            A calmer workspace for conversations, uploads, and memory.
          </p>

          {authMode === "signup" && (
            <label style={styles.fieldLabel}>
              Name
              <input
                style={styles.input}
                value={authForm.name}
                onChange={(event) =>
                  setAuthForm((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </label>
          )}

          <label style={styles.fieldLabel}>
            Email
            <input
              style={styles.input}
              type="email"
              value={authForm.email}
              onChange={(event) =>
                setAuthForm((prev) => ({ ...prev, email: event.target.value }))
              }
              required
            />
          </label>

          <label style={styles.fieldLabel}>
            Password
            <input
              style={styles.input}
              type="password"
              minLength={6}
              value={authForm.password}
              onChange={(event) =>
                setAuthForm((prev) => ({ ...prev, password: event.target.value }))
              }
              required
            />
          </label>

          {notice && <div style={styles.errorText}>{notice}</div>}

          <button style={styles.primaryButton} disabled={loading}>
            {loading
              ? "Please wait..."
              : authMode === "signup"
                ? "Sign up"
                : "Log in"}
          </button>

          <button
            type="button"
            style={styles.linkButton}
            onClick={() => {
              setNotice("");
              setAuthMode(authMode === "signup" ? "login" : "signup");
            }}
          >
            {authMode === "signup"
              ? "Already have an account? Log in"
              : "Need an account? Sign up"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main
      style={{
        ...styles.page,
        gridTemplateColumns: sidebarOpen
          ? "300px minmax(0, 1fr)"
          : "0 minmax(0, 1fr)",
      }}
    >
      <aside
        style={{
          ...styles.sidebar,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div style={styles.sidebarTop}>
          <button style={styles.iconButton} onClick={() => setSidebarOpen(false)}>
            Menu
          </button>
          <button style={styles.newButton} onClick={() => createSession()}>
            New chat
          </button>
        </div>

        <div style={styles.sessionList}>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                ...styles.sessionItem,
                ...(session.id === currentSessionId ? styles.sessionItemActive : {}),
              }}
              onClick={() => setCurrentSessionId(session.id)}
            >
              {editingTitleId === session.id ? (
                <input
                  style={styles.titleInput}
                  value={editingTitle}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onBlur={() => renameSession(session.id, editingTitle)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      renameSession(session.id, editingTitle);
                    }
                    if (event.key === "Escape") {
                      setEditingTitleId(null);
                      setEditingTitle("");
                    }
                  }}
                />
              ) : (
                <span style={styles.sessionTitle}>
                  {session.title || "New Chat"}
                </span>
              )}

              <div style={styles.sessionActions}>
                <button
                  style={styles.smallButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingTitleId(session.id);
                    setEditingTitle(session.title || "New Chat");
                  }}
                >
                  Rename
                </button>
                <button
                  style={styles.smallButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSession(session.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.profileBox}>
          <div style={styles.avatar}>{initials(user.name)}</div>
          <div style={styles.profileText}>
            <strong>{user.name}</strong>
            <span>{speaking ? "Speaking" : voiceEnabled ? "Voice on" : "Voice off"}</span>
          </div>
          <button style={styles.logoutButton} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <section style={styles.chatShell}>
        <header style={styles.topBar}>
          <button style={styles.iconButton} onClick={() => setSidebarOpen(true)}>
            Chats
          </button>
          <div style={styles.topTitle}>
            <strong>JARVIS</strong>
            <span>{currentSession?.title || "Ready when you are"}</span>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.headerButton} onClick={toggleVoice}>
              {speaking ? "Speaking" : voiceEnabled ? "Voice on" : "Voice off"}
            </button>
            <label style={styles.headerButton}>
              {uploading ? "Uploading" : "Upload"}
              <input
                hidden
                type="file"
                multiple
                accept={ACCEPTED_FILES.join(",")}
                onChange={handleFileUpload}
              />
            </label>
            <button style={styles.headerButton} onClick={clearCurrentChat}>
              Clear
            </button>
          </div>
        </header>

        {notice && <div style={styles.notice}>{notice}</div>}

        <section style={styles.messagesArea}>
          <div style={styles.messageColumn}>
            {messages.length === 0 && !loading && (
              <div style={styles.emptyState}>
                <div style={styles.emptyMark}>J</div>
                <h1 style={styles.emptyTitle}>Good evening, {user.name}.</h1>
                <p style={styles.emptyText}>
                  Ask me anything, upload a file, or use voice input. I will keep it
                  natural and remember the thread.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <article
                key={message.id || `${message.role}-${message.created_at}-${message.content}`}
                style={{
                  ...styles.messageRow,
                  ...(message.role === "user" ? styles.userRow : styles.assistantRow),
                }}
              >
                {message.role !== "user" && <div style={styles.assistantAvatar}>J</div>}
                <div
                  style={{
                    ...styles.messageBubble,
                    ...(message.role === "user"
                      ? styles.userBubble
                      : styles.assistantBubble),
                  }}
                >
                  {message.content}
                </div>
              </article>
            ))}

            {loading && (
              <article style={{ ...styles.messageRow, ...styles.assistantRow }}>
                <div style={styles.assistantAvatar}>J</div>
                <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
                  <span style={styles.typingDot}>Thinking</span>
                </div>
              </article>
            )}

            <div ref={messagesEndRef} />
          </div>
        </section>

        <footer style={styles.composerWrap}>
          <div style={styles.composer}>
            <textarea
              ref={textareaRef}
              style={styles.textarea}
              placeholder="Message JARVIS..."
              value={input}
              rows={1}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div style={styles.composerActions}>
              <button
                style={{
                  ...styles.roundButton,
                  ...(listening ? styles.roundButtonActive : {}),
                }}
                onClick={listening ? stopListening : startListening}
                disabled={!recognitionSupported}
                title={
                  recognitionSupported
                    ? "Use voice input"
                    : "Voice input is not supported in this browser"
                }
              >
                Mic
              </button>
              <button
                style={styles.sendButton}
                onClick={sendMessage}
                disabled={loading || !input.trim()}
              >
                Send
              </button>
            </div>
          </div>
          <div style={styles.composerHint}>
            Enter sends. Shift + Enter starts a new line.
          </div>
        </footer>
      </section>
    </main>
  );
}

const glassPanel = {
  background: "rgba(11, 18, 32, 0.54)",
  border: "1px solid rgba(255, 255, 255, 0.11)",
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)",
  backdropFilter: "blur(24px)",
};

const styles = {
  authPage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    color: "#eff6ff",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    padding: 24,
  },
  authCard: {
    ...glassPanel,
    width: "min(440px, 100%)",
    padding: 30,
    borderRadius: 28,
  },
  authBrand: {
    color: "#7dd3fc",
    fontSize: 13,
    letterSpacing: 1.8,
    fontWeight: 800,
  },
  authTitle: {
    fontSize: 34,
    lineHeight: 1.05,
    margin: "12px 0 8px",
  },
  authText: {
    color: "#a8b3c7",
    margin: "0 0 24px",
    lineHeight: 1.55,
  },
  fieldLabel: {
    display: "grid",
    gap: 8,
    marginBottom: 15,
    color: "#c8d3e6",
    fontSize: 14,
  },
  input: {
    height: 46,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#eff6ff",
    padding: "0 14px",
    outline: "none",
  },
  primaryButton: {
    width: "100%",
    height: 46,
    border: "none",
    borderRadius: 16,
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  linkButton: {
    width: "100%",
    marginTop: 14,
    border: "none",
    background: "transparent",
    color: "#bae6fd",
    cursor: "pointer",
  },
  errorText: {
    color: "#fecaca",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 16,
    padding: 10,
    marginBottom: 14,
  },
  page: {
    height: "100vh",
    display: "grid",
    gridTemplateColumns: "300px minmax(0, 1fr)",
    color: "#f8fbff",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    overflow: "hidden",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 14,
    background: "rgba(5, 10, 22, 0.58)",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(26px)",
    minWidth: 0,
    transition: "transform 220ms ease",
    zIndex: 10,
  },
  sidebarTop: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 10,
  },
  iconButton: {
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#eaf6ff",
    background: "rgba(255,255,255,0.06)",
    padding: "0 14px",
    cursor: "pointer",
  },
  newButton: {
    height: 42,
    border: "1px solid rgba(125, 211, 252, 0.3)",
    borderRadius: 14,
    background: "rgba(56, 189, 248, 0.16)",
    color: "#eff6ff",
    fontWeight: 750,
    cursor: "pointer",
  },
  sessionList: {
    flex: 1,
    overflowY: "auto",
    display: "grid",
    alignContent: "start",
    gap: 8,
    paddingRight: 2,
  },
  sessionItem: {
    border: "1px solid transparent",
    background: "rgba(255,255,255,0.035)",
    borderRadius: 16,
    padding: 12,
    cursor: "pointer",
  },
  sessionItemActive: {
    borderColor: "rgba(125, 211, 252, 0.38)",
    background: "rgba(125, 211, 252, 0.12)",
  },
  sessionTitle: {
    display: "block",
    color: "#f7fbff",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  titleInput: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.07)",
    color: "#f8fafc",
    padding: "8px 10px",
    outline: "none",
  },
  sessionActions: {
    display: "flex",
    gap: 8,
    marginTop: 9,
  },
  smallButton: {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.055)",
    color: "#cbd5e1",
    padding: "6px 8px",
    fontSize: 12,
    cursor: "pointer",
  },
  profileBox: {
    display: "grid",
    gridTemplateColumns: "38px 1fr auto",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    fontWeight: 900,
  },
  profileText: {
    display: "grid",
    gap: 2,
    minWidth: 0,
    fontSize: 13,
  },
  logoutButton: {
    height: 32,
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    cursor: "pointer",
  },
  chatShell: {
    display: "grid",
    gridTemplateRows: "64px auto minmax(0, 1fr) auto",
    minWidth: 0,
    minHeight: 0,
    background: "rgba(255,255,255,0.015)",
  },
  topBar: {
    height: 64,
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 14,
    padding: "10px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(8, 13, 25, 0.42)",
    backdropFilter: "blur(22px)",
  },
  topTitle: {
    display: "grid",
    justifyItems: "center",
    gap: 2,
    minWidth: 0,
  },
  headerActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  headerButton: {
    height: 38,
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#f8fbff",
    padding: "0 12px",
    cursor: "pointer",
  },
  notice: {
    width: "min(840px, calc(100% - 32px))",
    justifySelf: "center",
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    color: "#fde68a",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.22)",
  },
  messagesArea: {
    minHeight: 0,
    overflowY: "auto",
    padding: "28px 20px 18px",
  },
  messageColumn: {
    width: "min(850px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },
  emptyState: {
    minHeight: "58vh",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    textAlign: "center",
    padding: 24,
  },
  emptyMark: {
    width: 70,
    height: 70,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    marginBottom: 22,
    color: "#fff",
    fontWeight: 900,
    fontSize: 30,
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    boxShadow: "0 0 40px rgba(56, 189, 248, 0.36)",
  },
  emptyTitle: {
    margin: 0,
    fontSize: "clamp(30px, 5vw, 52px)",
    lineHeight: 1.05,
  },
  emptyText: {
    width: "min(620px, 100%)",
    margin: "14px auto 0",
    color: "#aab8cc",
    fontSize: 16,
    lineHeight: 1.65,
  },
  messageRow: {
    display: "grid",
    gridTemplateColumns: "36px minmax(0, 1fr)",
    gap: 12,
    alignItems: "start",
  },
  assistantRow: {},
  userRow: {
    gridTemplateColumns: "minmax(0, 1fr)",
    justifyItems: "end",
  },
  assistantAvatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "rgba(125, 211, 252, 0.16)",
    border: "1px solid rgba(125, 211, 252, 0.26)",
    color: "#dff7ff",
    fontWeight: 900,
  },
  messageBubble: {
    maxWidth: "100%",
    borderRadius: 20,
    padding: "15px 17px",
    lineHeight: 1.72,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontSize: 15.5,
  },
  userBubble: {
    maxWidth: "min(680px, 86%)",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#f8fbff",
    backdropFilter: "blur(16px)",
  },
  assistantBubble: {
    background: "transparent",
    color: "#eef6ff",
    paddingLeft: 0,
  },
  typingDot: {
    color: "#aab8cc",
  },
  composerWrap: {
    width: "min(900px, calc(100% - 32px))",
    justifySelf: "center",
    padding: "0 0 18px",
  },
  composer: {
    ...glassPanel,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "end",
    gap: 12,
    borderRadius: 28,
    padding: 10,
  },
  textarea: {
    width: "100%",
    minHeight: 48,
    maxHeight: 180,
    borderRadius: 20,
    border: "none",
    background: "transparent",
    color: "#f8fbff",
    padding: "13px 12px",
    resize: "none",
    outline: "none",
    lineHeight: 1.55,
  },
  composerActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  roundButton: {
    height: 42,
    minWidth: 52,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.07)",
    color: "#eaf6ff",
    cursor: "pointer",
  },
  roundButtonActive: {
    background: "rgba(34, 197, 94, 0.22)",
    borderColor: "rgba(34, 197, 94, 0.38)",
  },
  sendButton: {
    height: 42,
    minWidth: 70,
    border: "none",
    borderRadius: 18,
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    color: "#fff",
    fontWeight: 850,
    cursor: "pointer",
  },
  composerHint: {
    color: "#7d8da5",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
};
