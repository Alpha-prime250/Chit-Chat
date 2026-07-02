import { useRef, useState } from "react";

export default function MessageInput({ onSend, onTypingStart, onTypingStop }) {
  const [text, setText] = useState("");
  const typingTimeout = useRef(null);

  const handleChange = (e) => {
    setText(e.target.value);
    onTypingStart();

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      onTypingStop();
    }, 1200);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    onTypingStop();
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  };

  return (
    <form className="message-input-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        className="message-input"
        placeholder="Type a message..."
        value={text}
        maxLength={1000}
        onChange={handleChange}
      />
      <button type="submit" className="send-button" disabled={!text.trim()} aria-label="Send message">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M3.4 20.6L21 12 3.4 3.4 3.4 10.2 15.8 12 3.4 13.8z"
            fill="currentColor"
          />
        </svg>
      </button>
    </form>
  );
}