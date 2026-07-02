export default function Sidebar({ username, onlineUsers, activeChat, unread, onSelect }) {
  const others = onlineUsers.filter((u) => u.toLowerCase() !== username.toLowerCase());

  return (
    <aside className="sidebar">
      <div className="sidebar-section-label">Rooms</div>
      <button
        className={`sidebar-item ${activeChat === "public" ? "sidebar-item--active" : ""}`}
        onClick={() => onSelect("public")}
      >
        <span className="sidebar-avatar sidebar-avatar--public">#</span>
        <span className="sidebar-item-text">
          <span className="sidebar-item-name">Public room</span>
          <span className="sidebar-item-sub">Everyone</span>
        </span>
        {unread.public > 0 && activeChat !== "public" && (
          <span className="unread-badge">{unread.public}</span>
        )}
      </button>

      <div className="sidebar-section-label">Direct messages</div>
      {others.length === 0 && <p className="sidebar-empty">No one else online yet</p>}
      {others.map((user) => (
        <button
          key={user}
          className={`sidebar-item ${activeChat === user ? "sidebar-item--active" : ""}`}
          onClick={() => onSelect(user)}
        >
          <span className="sidebar-avatar">{user.charAt(0).toUpperCase()}</span>
          <span className="sidebar-item-text">
            <span className="sidebar-item-name">{user}</span>
            <span className="sidebar-item-sub">
              <span className="sidebar-online-dot" /> Online
            </span>
          </span>
          {unread[user] > 0 && activeChat !== user && (
            <span className="unread-badge">{unread[user]}</span>
          )}
        </button>
      ))}
    </aside>
  );
}