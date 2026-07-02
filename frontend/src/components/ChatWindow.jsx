import { useEffect, useRef } from "react";
import Message from "./Message.jsx";
import MessageInput from "./MessageInput.jsx";

export default function ChatWindow({
  username,
  email,
  activeChat, // "public" or a partner's username
  messages,
  onlineUsers,
  isPartnerOnline,
  typingUsers,
  connected,
  onSend,
  onTypingStart,
  onTypingStop,
}) {
  const bottomRef = useRef(null);
  const isPublic = activeChat === "public";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const otherTypers = typingUsers.filter((u) => u !== username);

  return (
    <div className="chat-window">
      <header className="chat-header">
        <div className="chat-header-info">
          {isPublic ? (
            <>
              <h1 className="chat-title"># Public room</h1>
              <div className="chat-status">
                <span className={`status-dot ${connected ? "status-dot--online" : "status-dot--offline"}`} />
                <span>{connected ? `${onlineUsers.length} online` : "Reconnecting..."}</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="chat-title">{activeChat}</h1>
              <div className="chat-status">
                <span className={`status-dot ${isPartnerOnline ? "status-dot--online" : "status-dot--offline"}`} />
                <span>{isPartnerOnline ? "Online" : "Offline"}</span>
              </div>
            </>
          )}
        </div>
        <div className="chat-header-user">
          <span className="chat-header-username">{username}</span>
          {email && <span className="chat-header-email">{email}</span>}
        </div>
      </header>

      <div className="message-list">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>{isPublic ? "No messages yet. Say hello 👋" : `Say hi to ${activeChat} 👋`}</p>
          </div>
        )}
        {messages.map((msg) => (
          <Message key={msg._id || msg.id} message={msg} isOwn={msg.from === username} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="typing-indicator-slot">
        {otherTypers.length > 0 && (
          <p className="typing-indicator">
            {otherTypers.join(", ")} {otherTypers.length === 1 ? "is" : "are"} typing…
          </p>
        )}
      </div>

      <MessageInput onSend={onSend} onTypingStart={onTypingStart} onTypingStop={onTypingStop} />
    </div>
  );
}