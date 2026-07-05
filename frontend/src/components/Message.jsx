import Avatar from "./Avatar.jsx";

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Message({ message, isOwn }) {
  if (message.type === "system") {
    return (
      <div className="system-message">
        <span>{message.text}</span>
      </div>
    );
  }

  return (
    <div className={`message-row ${isOwn ? "message-row--own" : ""}`}>
      {!isOwn && <Avatar name={message.from} size="sm" />}
      <div className={`message-bubble ${isOwn ? "message-bubble--own" : ""}`}>
        {!isOwn && <p className="message-username">{message.from}</p>}
        <p className="message-text">{message.text}</p>
        <span className="message-timestamp">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}