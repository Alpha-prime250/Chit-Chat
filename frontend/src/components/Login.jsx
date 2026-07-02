import { useState } from "react";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function Login({ onJoin, serverError }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    let hasError = false;

    if (!trimmedName) {
      setNameError("Name is required");
      hasError = true;
    }
    if (!trimmedEmail) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!isValidEmail(trimmedEmail)) {
      setEmailError("That doesn't look like a valid email");
      hasError = true;
    }

    if (hasError) return;

    onJoin({ username: trimmedName, email: trimmedEmail });
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-mark" aria-hidden="true">
          <span className="pulse-dot" />
        </div>
        <h1 className="login-title">Chit Chat</h1>
        <p className="login-subtitle">Enter your name and email to join the chat.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          {serverError && <p className="login-error">{serverError}</p>}
          <label htmlFor="username" className="login-label">
            Your name
          </label>
          <input
            id="username"
            className="login-input"
            type="text"
            placeholder="e.g. Yash"
            value={name}
            maxLength={24}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
          />
          {nameError && <p className="login-error">{nameError}</p>}

          <label htmlFor="email" className="login-label" style={{ marginTop: 12 }}>
            Email
          </label>
          <input
            id="email"
            className="login-input"
            type="email"
            placeholder="e.g. Yash@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
            }}
          />
          {emailError && <p className="login-error">{emailError}</p>}

          <button type="submit" className="login-button">
            Join chat
          </button>
        </form>
      </div>
    </div>
  );
}