import { useState } from "react";

// Used when the user leaves the name field blank — username is optional.
function generateGuestName() {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Guest${suffix}`;
}

export default function Login({ onJoin }) {
  const [name, setName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    onJoin(trimmed || generateGuestName());
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-mark" aria-hidden="true">
          <span className="pulse-dot" />
        </div>
        <h1 className="login-title">Chit Chat</h1>
        <p className="login-subtitle">Pick a name, or jump in as a guest.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username" className="login-label">
            Your name (optional)
          </label>
          <input
            id="username"
            className="login-input"
            type="text"
            placeholder="e.g. Yash — leave blank to join as a guest"
            value={name}
            maxLength={24}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />

          <button type="submit" className="login-button">
            {name.trim() ? "Join chat" : "Join as guest"}
          </button>
        </form>
      </div>
    </div>
  );
}