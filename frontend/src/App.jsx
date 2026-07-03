import { useEffect, useState } from "react";
import { socket } from "./socket.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";

export default function App() {
  const [joinInfo, setJoinInfo] = useState(null); // { username, email } as typed on the login screen
  const [username, setUsername] = useState(null); // server-confirmed, de-duplicated username
  const [email, setEmail] = useState(null); // server-confirmed email
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeChat, setActiveChat] = useState("public"); // "public" or a partner's username

  const [publicMessages, setPublicMessages] = useState([]);
  const [dmMessages, setDmMessages] = useState({}); // { [partnerUsername]: Message[] }
  const [loadedDms, setLoadedDms] = useState(new Set()); // which DM histories we've already fetched
  const [unread, setUnread] = useState({ public: 0 }); // { public: n, [partner]: n }
  const [typingByScope, setTypingByScope] = useState({}); // { public: [...usernames], [partner]: [...] }

  useEffect(() => {
    if (!joinInfo) return;

    socket.connect();

    function handleConnect() {
      setConnected(true);
      socket.emit("user:join", joinInfo);
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleJoined({ username: finalUsername, email: finalEmail }) {
      setUsername(finalUsername);
      setEmail(finalEmail || null);
    }
    function handleJoinError({ message }) {
      setJoinError(message || "Could not join the chat.");
      setJoinInfo(null);
    }
    function handleHistory(history) {
      setPublicMessages(history);
    }
    function handlePublicMessage(message) {
      setPublicMessages((prev) => [...prev, message]);
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
        setDmMessages((prev) => ({
          ...prev,
          [partner]: [...(prev[partner] || []), message],
        }));
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
      />
    </div>
  );
}