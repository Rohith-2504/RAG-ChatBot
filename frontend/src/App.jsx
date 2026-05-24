import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";

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

function MediaViewer({ url, type, alt }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = url.split("/").pop() || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isVideo = type === "video";

  return (
    <div style={styles.mediaContainer}>
      <div style={styles.mediaDisplayArea}>
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            loop
            muted
            style={styles.mediaVideo}
          />
        ) : (
          <img src={url} alt={alt || "ECHO Output"} style={styles.mediaImage} />
        )}
      </div>
      <div style={styles.mediaActionBar}>
        <div style={styles.mediaMeta}>
          <span style={styles.mediaBadge}>{isVideo ? "VIDEO" : "IMAGE"}</span>
          <span style={styles.mediaFilename}>
            {url.split("/").pop()?.slice(0, 18)}...
          </span>
        </div>
        <div style={styles.mediaButtons}>
          <button 
            onClick={handleDownload} 
            className="media-action-btn"
            style={styles.actionBtn}
            title="Download file to device"
          >
            <span style={{ marginRight: 6 }}>⬇️</span> Download
          </button>
          <button 
            onClick={handleShare} 
            className="media-action-btn"
            style={{
              ...styles.actionBtn,
              ...(copied ? styles.actionBtnSuccess : {})
            }}
            title="Copy link to clipboard"
          >
            {copied ? (
              <>
                <span style={{ marginRight: 6 }}>✓</span> Copied
              </>
            ) : (
              <>
                <span style={{ marginRight: 6 }}>🔗</span> Share
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderMessageContent(content) {
  if (!content) return null;

  const pattern = /(!?\[[^\]]*\]\(https?:\/\/[^\s)]+\))/g;
  const parts = content.split(pattern);

  return parts.map((part, index) => {
    const imgMatch = part.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1];
      const url = imgMatch[2];
      return <MediaViewer key={index} url={url} type="image" alt={alt} />;
    }

    const linkMatch = part.match(/^\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      const text = linkMatch[1];
      const url = linkMatch[2];

      const isVideo = url.toLowerCase().endsWith(".mp4") || url.includes("/generated_media/video_");

      if (isVideo) {
        return <MediaViewer key={index} url={url} type="video" alt={text} />;
      }

      return (
        <a key={index} href={url} target="_blank" rel="noopener noreferrer" style={styles.textLink}>
          {text}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
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
  const [attachedFiles, setAttachedFiles] = useState([]);
  const uploading = useMemo(
    () => attachedFiles.some((f) => f.status === "uploading"),
    [attachedFiles],
  );
  const [notice, setNotice] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const loadedUserIdRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechQueueRef = useRef([]);
  const docInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);

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
      html, body, #root { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
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

      /* HIDE SCROLLBARS GLOBALLY */
      * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      *::-webkit-scrollbar {
        display: none !important;
      }

      /* INTERACTIVE CLASSES */
      .feature-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 16px;
        padding: 18px;
        text-align: left;
        cursor: pointer;
        transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1), background 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
      }
      .feature-card:hover {
        transform: translateY(-5px) scale(1.02);
        background: rgba(255, 255, 255, 0.075);
        border-color: rgba(56, 189, 248, 0.45);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35), 0 0 18px rgba(56, 189, 248, 0.18);
      }
      .feature-card:active {
        transform: translateY(-1px) scale(0.995);
      }
      
      .icon-btn-hover {
        transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
      }
      .icon-btn-hover:hover {
        background: rgba(255, 255, 255, 0.12) !important;
        border-color: rgba(56, 189, 248, 0.4) !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15);
      }
      .icon-btn-hover:active {
        transform: translateY(0);
      }

      .media-action-btn {
        transition: all 180ms ease;
      }
      .media-action-btn:hover {
        background: rgba(255, 255, 255, 0.12) !important;
        border-color: rgba(56, 189, 248, 0.4) !important;
        color: #fff !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15);
      }
      .media-action-btn:active {
        transform: translateY(0);
      }

      /* ECHO CORE KEYFRAMES */
      @keyframes core-spin-clockwise {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes core-spin-counter {
        from { transform: rotate(0deg); }
        to { transform: rotate(-360deg); }
      }
      @keyframes core-pulse-glow {
        0%, 100% { transform: scale(0.95); filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.5)); }
        50% { transform: scale(1.05); filter: drop-shadow(0 0 25px rgba(56, 189, 248, 0.95)); }
      }
      @keyframes core-pulse-glow-listening {
        0%, 100% { transform: scale(0.95); filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.5)); }
        50% { transform: scale(1.08); filter: drop-shadow(0 0 25px rgba(34, 197, 94, 0.95)); }
      }
      @keyframes core-pulse-glow-thinking {
        0%, 100% { transform: scale(0.95); filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.5)); }
        50% { transform: scale(1.08); filter: drop-shadow(0 0 25px rgba(168, 85, 247, 0.95)); }
      }
      @keyframes core-pulse-glow-speaking {
        0%, 100% { transform: scale(0.95); filter: drop-shadow(0 0 10px rgba(244, 63, 94, 0.5)); }
        50% { transform: scale(1.08); filter: drop-shadow(0 0 25px rgba(244, 63, 94, 0.95)); }
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

  async function sendMessage(overrideText) {
    const text = typeof overrideText === "string" ? overrideText.trim() : input.trim();
    if (!text || loading || !user) return;

    const stillUploading = attachedFiles.some((f) => f.status === "uploading");
    if (stillUploading) {
      setNotice("Please wait for files to finish uploading.");
      return;
    }

    const successfulAttachments = attachedFiles
      .filter((f) => f.status === "success")
      .map((f) => ({
        filename: f.name,
        file_type: f.type,
        content: f.content,
      }));

    let sessionId = currentSessionId;

    if (!sessionId) {
      const createdSession = await createSession(user.id);
      sessionId = createdSession?.id;
    }

    if (!sessionId) return;

    setInput("");
    setAttachedFiles([]);
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
          attachments: successfulAttachments.length ? successfulAttachments : null,
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

  const uploadSingleFile = async (localId, file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setAttachedFiles((prev) =>
            prev.map((f) => (f.id === localId ? { ...f, progress: percent } : f))
          );
        },
      });

      const data = response.data;
      setAttachedFiles((prev) =>
        prev.map((f) =>
          f.id === localId
            ? {
                ...f,
                progress: 100,
                status: "success",
                content: data.content || "",
                saved_as: data.saved_as,
              }
            : f
        )
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `upload-${Date.now()}-${file.name}`,
          role: "assistant",
          content: `${file.name} is uploaded and indexed. Ready for analysis.`,
        },
      ]);
    } catch (error) {
      const errMsg = error.response?.data?.detail || error.message || "Upload failed.";
      setAttachedFiles((prev) =>
        prev.map((f) =>
          f.id === localId ? { ...f, status: "error", error: errMsg } : f
        )
      );
    }
  };

  function removeAttachedFile(id) {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    setNotice("");

    const newFiles = files.map((file) => {
      const extension = getFileExtension(file.name);
      const localId = `attached-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (!ACCEPTED_FILES.includes(extension)) {
        return {
          id: localId,
          name: file.name,
          size: file.size,
          type: extension,
          progress: 0,
          status: "error",
          content: "",
          error: `${file.name} is not a supported file type.`,
        };
      }

      if (file.size > MAX_FILE_BYTES) {
        return {
          id: localId,
          name: file.name,
          size: file.size,
          type: extension,
          progress: 0,
          status: "error",
          content: "",
          error: `${file.name} is larger than 25 MB.`,
        };
      }

      uploadSingleFile(localId, file);

      return {
        id: localId,
        name: file.name,
        size: file.size,
        type: extension,
        progress: 0,
        status: "uploading",
        content: "",
        error: "",
      };
    });

    setAttachedFiles((prev) => [...prev, ...newFiles]);
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
          <div style={styles.authBrand}>ECHO RAG</div>
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

  const echoGreetings = [
    "At your service. All core systems operational.",
    "Yes. I am currently analyzing the context threads.",
    "ECHO online and ready. Let me know if you need any database diagnostics or live search assistance.",
    "Diagnostic complete. Core functions running within optimal parameters.",
    "Always a pleasure working with you."
  ];

  function handleCoreClick() {
    if (speaking) {
      stopSpeaking();
    } else {
      const greet = echoGreetings[Math.floor(Math.random() * echoGreetings.length)];
      speak(greet);
    }
  }

  function renderEchoCore(size = "large") {
    const isSmall = size === "small";
    const coreStyle = isSmall ? styles.smallCore : styles.largeCore;
    const activeGlow = listening 
      ? styles.coreListening 
      : loading 
        ? styles.coreThinking 
        : speaking 
          ? styles.coreSpeaking 
          : styles.coreIdle;

    return (
      <div 
        style={{ ...coreStyle, ...activeGlow }} 
        onClick={handleCoreClick}
        title="ECHO Core - Click to interact"
      >
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", overflow: "visible" }}>
          {/* Outer Ring */}
          <circle 
            cx="50" 
            cy="50" 
            r="44" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeDasharray="10 6 30 6" 
            style={{ 
              animation: "core-spin-clockwise 10s linear infinite",
              transformOrigin: "center"
            }} 
          />
          {/* Middle Segmented Ring */}
          <circle 
            cx="50" 
            cy="50" 
            r="36" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeDasharray="20 15 5 15" 
            style={{ 
              animation: "core-spin-counter 6s linear infinite",
              transformOrigin: "center"
            }} 
          />
          {/* Inner Glowing Ring */}
          <circle 
            cx="50" 
            cy="50" 
            r="28" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1" 
            strokeDasharray="2 2" 
            style={{
              animation: "core-spin-clockwise 3s linear infinite",
              transformOrigin: "center"
            }}
          />
          {/* Radar Line */}
          <line 
            x1="50" 
            y1="50" 
            x2="50" 
            y2="14" 
            stroke="currentColor" 
            strokeWidth="1" 
            style={{ 
              animation: "core-spin-clockwise 4s linear infinite",
              transformOrigin: "center"
            }} 
          />
          {/* Inner solid pulsating core */}
          <circle 
            cx="50" 
            cy="50" 
            r="18" 
            fill="currentColor" 
            opacity="0.8" 
          />
          {/* Small Center Eye */}
          <circle 
            cx="50" 
            cy="50" 
            r="6" 
            fill="#fff" 
          />
        </svg>
      </div>
    );
  }

  return (
    <main style={styles.page}>
      <aside
        style={{
          ...styles.sidebar,
          marginLeft: sidebarOpen ? 0 : -300,
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? "auto" : "none",
        }}
      >
        <div style={styles.sidebarTop}>
          <button className="icon-btn-hover" style={styles.iconButton} onClick={() => setSidebarOpen(false)} title="Collapse sidebar">
            ☰
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
          {!sidebarOpen && (
            <button className="icon-btn-hover" style={styles.iconButton} onClick={() => setSidebarOpen(true)} title="Expand sidebar">
              ☰
            </button>
          )}
          <div style={styles.topTitle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {renderEchoCore("small")}
              <strong style={{ letterSpacing: 1.5 }}>ECHO</strong>
            </div>
            <span>{currentSession?.title || "Ready when you are"}</span>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.headerButton} onClick={toggleVoice}>
              {speaking ? "Speaking" : voiceEnabled ? "Voice on" : "Voice off"}
            </button>
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
                {renderEchoCore("large")}
                <h1 style={styles.emptyTitle}>
                  {(() => {
                    const hrs = new Date().getHours();
                    if (hrs < 12) return "Good morning";
                    if (hrs < 18) return "Good afternoon";
                    return "Good evening";
                  })()}
                  , {user.name}.
                </h1>
                <p style={styles.emptyText}>
                  I am ECHO, your personal AI assistant. Click a capability below to prompt me, or upload files directly.
                </p>
                <div style={styles.featuresGrid}>
                  <div 
                    className="feature-card"
                    onClick={() => sendMessage("Explain your cinematic conversational style and how you can assist me.")}
                  >
                    <div style={styles.featureIcon}>💬</div>
                    <div style={styles.featureTitle}>Cinematic Style</div>
                    <div style={styles.featureDesc}>Intelligent, warm, and natural conversational flow. Click to try.</div>
                  </div>
                  <div 
                    className="feature-card"
                    onClick={() => sendMessage("How can I upload and ask questions about PDFs, images (OCR), or audio/video files?")}
                  >
                    <div style={styles.featureIcon}>📁</div>
                    <div style={styles.featureTitle}>Document Intelligence</div>
                    <div style={styles.featureDesc}>Extract text from PDFs, Word docs, images (OCR), audio & video. Click to try.</div>
                  </div>
                  <div 
                    className="feature-card"
                    onClick={() => sendMessage("Find the latest updates on artificial intelligence in 2026.")}
                  >
                    <div style={styles.featureIcon}>🌐</div>
                    <div style={styles.featureTitle}>Live Web Search</div>
                    <div style={styles.featureDesc}>Real-time information retrieval powered by Tavily search. Click to try.</div>
                  </div>
                  <div 
                    className="feature-card"
                    onClick={() => sendMessage("Demonstrate your text-to-speech voice synthesis and conversation memory.")}
                  >
                    <div style={styles.featureIcon}>🎙️</div>
                    <div style={styles.featureTitle}>Voice Synthesis & Memory</div>
                    <div style={styles.featureDesc}>Listen to natural audio responses with context-aware memory. Click to try.</div>
                  </div>
                </div>
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
                  {renderMessageContent(message.content)}
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
          {/* File Inputs for targeted types */}
          <input
            ref={docInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <input
            ref={audioInputRef}
            type="file"
            multiple
            accept=".mp3,.wav,.m4a"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <input
            ref={videoInputRef}
            type="file"
            multiple
            accept=".mp4,.mov,.avi"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />

          {attachedFiles.length > 0 && (
            <div style={styles.attachmentList}>
              {attachedFiles.map((file) => {
                let fileIcon = "📄";
                if (file.type.match(/\.(png|jpg|jpeg|gif|webp)$/i)) fileIcon = "🖼️";
                else if (file.type.match(/\.(mp4|mov|avi|webm|mkv)$/i)) fileIcon = "🎥";
                else if (file.type.match(/\.(mp3|wav|m4a|ogg)$/i)) fileIcon = "🎵";
                else if (file.type.match(/\.pdf$/i)) fileIcon = "📕";
                else if (file.type.match(/\.(docx|doc)$/i)) fileIcon = "📘";

                const isUploading = file.status === "uploading";
                const isError = file.status === "error";

                return (
                  <div key={file.id} style={styles.attachmentCard}>
                    <div style={styles.attachmentInfo}>
                      <span style={styles.attachmentIcon}>{fileIcon}</span>
                      <div style={styles.attachmentDetails}>
                        <span style={styles.attachmentName} title={file.name}>
                          {file.name}
                        </span>
                        <span style={styles.attachmentSize}>
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <button
                        style={styles.attachmentRemoveBtn}
                        onClick={() => removeAttachedFile(file.id)}
                        title="Remove file"
                      >
                        &times;
                      </button>
                    </div>

                    {isUploading && (
                      <div style={styles.progressContainer}>
                        <div
                          style={{
                            ...styles.progressBar,
                            width: `${file.progress}%`,
                          }}
                        />
                      </div>
                    )}

                    {isError && (
                      <span style={styles.attachmentErrorText} title={file.error}>
                        Failed
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={styles.composer}>
            <div style={{ position: "relative", alignSelf: "end" }}>
              <button
                style={styles.uploadLabel}
                onClick={() => setUploadMenuOpen(!uploadMenuOpen)}
                title="Upload file"
              >
                {uploading ? "..." : "+"}
              </button>

              {uploadMenuOpen && (
                <div style={styles.uploadMenu}>
                  <button
                    style={styles.uploadMenuItem}
                    onClick={() => {
                      docInputRef.current.click();
                      setUploadMenuOpen(false);
                    }}
                  >
                    <span style={styles.uploadMenuIcon}>📄</span>
                    <span>Document (PDF/Word/Text)</span>
                  </button>
                  <button
                    style={styles.uploadMenuItem}
                    onClick={() => {
                      imageInputRef.current.click();
                      setUploadMenuOpen(false);
                    }}
                  >
                    <span style={styles.uploadMenuIcon}>🖼️</span>
                    <span>Image (PNG/JPG)</span>
                  </button>
                  <button
                    style={styles.uploadMenuItem}
                    onClick={() => {
                      audioInputRef.current.click();
                      setUploadMenuOpen(false);
                    }}
                  >
                    <span style={styles.uploadMenuIcon}>🎵</span>
                    <span>Audio (MP3/WAV)</span>
                  </button>
                  <button
                    style={styles.uploadMenuItem}
                    onClick={() => {
                      videoInputRef.current.click();
                      setUploadMenuOpen(false);
                    }}
                  >
                    <span style={styles.uploadMenuIcon}>🎥</span>
                    <span>Video (MP4/MOV)</span>
                  </button>
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              style={styles.textarea}
              placeholder="Message ECHO..."
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
    height: "100%",
    width: "100%",
    display: "flex",
    color: "#f8fbff",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    overflow: "hidden",
  },
  sidebar: {
    width: 300,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 14,
    background: "rgba(5, 10, 22, 0.58)",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(26px)",
    transition: "margin-left 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease, visibility 220ms ease",
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
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    background: "rgba(255,255,255,0.015)",
    flex: 1,
  },
  topBar: {
    height: 64,
    flexShrink: 0,
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
    alignSelf: "center",
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    color: "#fde68a",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.22)",
    flexShrink: 0,
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 20px 18px",
    minHeight: 0,
  },
  messageColumn: {
    width: "min(850px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },
  emptyState: {
    minHeight: "68vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    padding: "24px 10px",
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
    fontSize: "clamp(24px, 4vw, 42px)",
    lineHeight: 1.1,
  },
  emptyText: {
    width: "min(620px, 100%)",
    margin: "14px auto 0",
    color: "#aab8cc",
    fontSize: 15.5,
    lineHeight: 1.6,
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
    alignSelf: "center",
    padding: "0 0 18px",
    flexShrink: 0,
  },
  composer: {
    ...glassPanel,
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
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
  uploadLabel: {
    height: 42,
    width: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.07)",
    color: "#eaf6ff",
    fontSize: 22,
    fontWeight: 400,
    cursor: "pointer",
    transition: "background 160ms ease, transform 160ms ease",
    alignSelf: "end",
  },
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
    width: "100%",
    maxWidth: 720,
    margin: "24px auto 0",
  },
  featureCard: {
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 18,
    textAlign: "left",
    cursor: "pointer",
    transition: "transform 160ms ease, background 160ms ease, border-color 160ms ease",
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  featureTitle: {
    fontWeight: 700,
    fontSize: 15,
    color: "#7dd3fc",
    marginBottom: 6,
  },
  featureDesc: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.45,
  },
  largeCore: {
    width: 120,
    height: 120,
    borderRadius: "50%",
    background: "rgba(10, 22, 45, 0.6)",
    border: "2px solid currentColor",
    padding: 10,
    cursor: "pointer",
    marginBottom: 24,
    display: "grid",
    placeItems: "center",
    transition: "all 0.3s ease",
  },
  smallCore: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(10, 22, 45, 0.4)",
    border: "1px solid currentColor",
    padding: 2,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    transition: "all 0.3s ease",
  },
  coreIdle: {
    color: "#38bdf8",
    animation: "core-pulse-glow 3s ease-in-out infinite",
  },
  coreListening: {
    color: "#22c55e",
    animation: "core-pulse-glow-listening 1.5s ease-in-out infinite",
  },
  coreThinking: {
    color: "#a855f7",
    animation: "core-pulse-glow-thinking 1.2s ease-in-out infinite",
  },
  coreSpeaking: {
    color: "#f43f5e",
    animation: "core-pulse-glow-speaking 1s ease-in-out infinite",
  },
  uploadMenu: {
    position: "absolute",
    bottom: 50,
    left: 0,
    background: "rgba(10, 17, 30, 0.96)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 240,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
    backdropFilter: "blur(16px)",
    zIndex: 100,
  },
  uploadMenuItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    borderRadius: 12,
    color: "#e2e8f0",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 14,
    width: "100%",
    transition: "background 150ms ease, color 150ms ease",
    outline: "none",
  },
  uploadMenuIcon: {
    fontSize: 18,
  },
  mediaContainer: {
    margin: "16px 0",
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    boxShadow: "0 16px 48px rgba(0, 0, 0, 0.35)",
    background: "rgba(10, 22, 45, 0.35)",
    backdropFilter: "blur(16px)",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: 600,
    transition: "all 0.3s ease",
  },
  mediaDisplayArea: {
    width: "100%",
    background: "rgba(0, 0, 0, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mediaImage: {
    width: "100%",
    height: "auto",
    maxHeight: 480,
    objectFit: "contain",
    display: "block",
  },
  mediaVideo: {
    width: "100%",
    height: "auto",
    maxHeight: 480,
    display: "block",
  },
  mediaActionBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 18px",
    background: "rgba(8, 15, 30, 0.6)",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    flexWrap: "wrap",
    gap: 12,
  },
  mediaMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  mediaBadge: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.2,
    padding: "3px 8px",
    borderRadius: 8,
    background: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    border: "1px solid rgba(56, 189, 248, 0.25)",
  },
  mediaFilename: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "monospace",
  },
  mediaButtons: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    color: "#cbd5e1",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  actionBtnSuccess: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    background: "rgba(34, 197, 94, 0.15)",
    color: "#4ade80",
  },
  textLink: {
    color: "#38bdf8",
    textDecoration: "underline",
    fontWeight: 600,
  },
  attachmentList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  attachmentCard: {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 160,
    maxWidth: 240,
    position: "relative",
    backdropFilter: "blur(12px)",
  },
  attachmentInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  attachmentIcon: {
    fontSize: 20,
  },
  attachmentDetails: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flex: 1,
  },
  attachmentName: {
    fontSize: 13,
    color: "#f8fafc",
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  attachmentSize: {
    fontSize: 10,
    color: "#94a3b8",
  },
  attachmentRemoveBtn: {
    background: "rgba(255,255,255,0.1)",
    border: "none",
    borderRadius: "50%",
    width: 20,
    height: 20,
    display: "grid",
    placeItems: "center",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "bold",
    transition: "background 150ms, color 150ms",
  },
  progressContainer: {
    height: 4,
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(90deg, #38bdf8, #6366f1)",
    transition: "width 200ms ease",
  },
  attachmentErrorText: {
    fontSize: 10,
    color: "#fca5a5",
    marginTop: 2,
  },
};
