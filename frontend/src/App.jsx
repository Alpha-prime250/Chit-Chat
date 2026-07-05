import { useEffect, useState } from "react";
import { socket } from "./socket.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";

const STORAGE_KEY = "wavelength:join-info";
const MESSAGES_STORAGE_KEY = "wavelength:public-messages";
const DM_MESSAGES_STORAGE_KEY = "wavelength:dm-messages";
const ACTIVE_CHAT_STORAGE_KEY = "wavelength:active-chat";
const CLIENT_ID_KEY = "wavelength:client-id";

function loadSavedJoinInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.username && parsed?.email) return parsed;
    return null;
  } catch {
    return null;
  }
}

function loadSavedPublicMessages() {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadSavedDmMessages() {
  try {
    const raw = localStorage.getItem(DM_MESSAGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadSavedActiveChat() {
  try {
    return localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) || "public";
  } catch {
    return "public";
  }
}

// A stable per-browser ID so the server can recognize "this is the same
// tab/browser reconnecting after a refresh" and hand back the same
// username instead of appending a suffix like "Yash2".
function getOrCreateClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export default function App() {
  const [joinInfo, setJoinInfoState] = useState(loadSavedJoinInfo); // { username, email }
  const [username, setUsername] = useState(null); // server-confirmed, de-duplicated username
  const [email, setEmail] = useState(null); // server-confirmed email
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(loadSavedActiveChat); // "public" or a partner's username

  const [publicMessages, setPublicMessages] = useState(loadSavedPublicMessages);
  const [dmMessages, setDmMessages] = useState(loadSavedDmMessages); // { [partnerUsername]: Message[] }
  const [loadedDms, setLoadedDms] = useState(new Set()); // which DM histories we've already fetched
  const [unread, setUnread] = useState({ public: 0 }); // { public: n, [partner]: n }
  const [typingByScope, setTypingByScope] = useState({}); // { public: [...usernames], [partner]: [...] }

  // Wraps setJoinInfo so every login also persists to localStorage
  const setJoinInfo = (info) => {
    setJoinInfoState(info);
    try {
      if (info) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing) — session just won't persist
    }
  };

  const handleLogout = () => {
    setUsername(null);
    setEmail(null);
    setActiveChat("public");
    setPublicMessages([]);
    setDmMessages({});
    setLoadedDms(new Set());
    setUnread({ public: 0 });
    setTypingByScope({});
    setJoinInfo(null);
    try {
      localStorage.removeItem(MESSAGES_STORAGE_KEY);
      localStorage.removeItem(DM_MESSAGES_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Keeps the local public-message cache in sync so a page reload in the
  // same browser can restore what this user already saw, without asking
  // the server for full room history (new/different browsers still start empty).
  useEffect(() => {
    try {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(publicMessages.slice(-200)));
    } catch {
      // ignore (e.g. private browsing / storage full)
    }
  }, [publicMessages]);

  // Same idea for private conversations — cached locally, then refreshed
  // from the server's authoritative history on (re)join via dm:open.
  useEffect(() => {
    try {
      localStorage.setItem(DM_MESSAGES_STORAGE_KEY, JSON.stringify(dmMessages));
    } catch {
      // ignore
    }
  }, [dmMessages]);

  // Remember which conversation was open so a reload lands back on it.
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, activeChat);
    } catch {
      // ignore
    }
  }, [activeChat]);

  useEffect(() => {
    if (!joinInfo) return;

    socket.connect();

    function handleConnect() {
      setConnected(true);
      socket.emit("user:join", { ...joinInfo, clientId: getOrCreateClientId() });
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleJoined({ username: finalUsername, email: finalEmail }) {
      setUsername(finalUsername);
      setEmail(finalEmail || null);
      // If we're restoring into a DM (e.g. after a page reload), refresh
      // that conversation's history from the server so it stays authoritative.
      if (activeChat !== "public") {
        socket.emit("dm:open", { withUsername: activeChat });
      }
    }
    function handleJoinError({ message }) {
      setJoinError(message || "Could not join the chat.");
      setJoinInfo(null); // clears both state and localStorage
    }
    function handleHistory(history) {
      setPublicMessages(history);
    }
    function handlePublicMessage(message) {
      setPublicMessages((prev) => {
        if (message._id && prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
      setActiveChatAwareUnread("public");
    }
    function handleUsersList(users) {
      setOnlineUsers(users);
    }
    function handleDmHistory({ withUsername, messages }) {
      setDmMessages((prev) => ({ ...prev, [withUsername]: messages }));
      setLoadedDms((prev) => new Set(prev).add(withUsername));
    }
    function handleDmMessage({ message }) {
      setUsername((currentUsername) => {
        const partner = message.from === currentUsername ? message.to : message.from;
        setDmMessages((prev) => {
          const existing = prev[partner] || [];
          if (message._id && existing.some((m) => m._id === message._id)) return prev;
          return { ...prev, [partner]: [...existing, message] };
        });
        setActiveChatAwareUnread(partner);
        return currentUsername;
      });
    }
    function handleTyping({ scope, username: typer, isTyping }) {
      setTypingByScope((prev) => {
        const current = prev[scope] || [];
        const next = isTyping
          ? current.includes(typer)
            ? current
            : [...current, typer]
          : current.filter((u) => u !== typer);
        return { ...prev, [scope]: next };
      });
    }

    function setActiveChatAwareUnread(scope) {
      setActiveChat((currentActive) => {
        if (currentActive !== scope) {
          setUnread((prev) => ({ ...prev, [scope]: (prev[scope] || 0) + 1 }));
        }
        return currentActive;
      });
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("user:joined", handleJoined);
    socket.on("user:join_error", handleJoinError);
    socket.on("chat:history", handleHistory);
    socket.on("chat:message", handlePublicMessage);
    socket.on("users:list", handleUsersList);
    socket.on("dm:history", handleDmHistory);
    socket.on("dm:message", handleDmMessage);
    socket.on("typing:update", handleTyping);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("user:joined", handleJoined);
      socket.off("user:join_error", handleJoinError);
      socket.off("chat:history", handleHistory);
      socket.off("chat:message", handlePublicMessage);
      socket.off("users:list", handleUsersList);
      socket.off("dm:history", handleDmHistory);
      socket.off("dm:message", handleDmMessage);
      socket.off("typing:update", handleTyping);
      socket.disconnect();
    };
  }, [joinInfo]);

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    setUnread((prev) => ({ ...prev, [chat]: 0 }));
    if (chat !== "public" && !loadedDms.has(chat)) {
      socket.emit("dm:open", { withUsername: chat });
    }
  };

  const handleSend = (text) => {
    if (activeChat === "public") {
      socket.emit("message:send", { text });
    } else {
      socket.emit("dm:send", { to: activeChat, text });
    }
  };

  const handleTypingStart = () => socket.emit("typing:start", { to: activeChat });
  const handleTypingStop = () => socket.emit("typing:stop", { to: activeChat });

  if (!joinInfo) {
    return <Login onJoin={setJoinInfo} serverError={joinError} />;
  }

  if (!username) {
    return (
      <div className="login-screen">
        <p className="login-subtitle">Connecting…</p>
      </div>
    );
  }

  const activeMessages = activeChat === "public" ? publicMessages : dmMessages[activeChat] || [];
  const activeTypers = typingByScope[activeChat] || [];
  const isPartnerOnline = activeChat !== "public" && onlineUsers.includes(activeChat);

  return (
    <div className="app-layout">
      <Sidebar
        username={username}
        onlineUsers={onlineUsers}
        activeChat={activeChat}
        unread={unread}
        onSelect={handleSelectChat}
      />
      <ChatWindow
        username={username}
        email={email}
        activeChat={activeChat}
        messages={activeMessages}
        onlineUsers={onlineUsers}
        isPartnerOnline={isPartnerOnline}
        typingUsers={activeTypers}
        connected={connected}
        onSend={handleSend}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        onLogout={handleLogout}
      />
    </div>
  );
}