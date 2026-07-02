# Chit Chat — Real-Time Chat App

A clean, full-stack real-time chat application with a public room **and** private 1:1 chats:

- **Backend:** Node.js + Express + Socket.io + MongoDB (Mongoose)
- **Frontend:** React (Vite) + Socket.io client

Users pick a name, join the chat, and see messages appear instantly — no refresh required. From the sidebar they can stay in the public room or click any online user to open a private conversation. All messages are persisted in MongoDB, so history survives server restarts.

## Project structure

```
chat-app/
├── backend/
│   ├── server.js          # Express server + Socket.io real-time logic
│   ├── db.js               # MongoDB connection helper
│   ├── models/
│   │   └── Message.js      # Mongoose schema (public + private messages)
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx        # Root component: public room + DM state, socket wiring
        ├── App.css        # All styling (design tokens + components)
        ├── socket.js       # Socket.io client instance
        └── components/
            ├── Login.jsx       # Username entry screen (optional name)
            ├── Sidebar.jsx     # Public room + online users list, unread badges
            ├── ChatWindow.jsx  # Header, message list, typing indicator
            ├── Message.jsx     # Single message bubble
            └── MessageInput.jsx# Text input + send button
```

## How it works

1. On load, the user enters a username (or leaves it blank to join as a guest) on the **Login** screen.
2. The frontend connects via **Socket.io** and emits `user:join`. The server de-duplicates the username if it's already taken and confirms the final name via `user:joined`.
3. The **public room** works as before: `message:send` → server saves to MongoDB → broadcasts to everyone via `chat:message`.
4. For **private 1:1 chat**: clicking a user in the sidebar emits `dm:open`, which loads that conversation's history from MongoDB (`dm:history`). Sending a DM emits `dm:send` with `{ to, text }`; the server saves it and delivers it via `dm:message` to both the sender and the recipient (if online).
5. Each private conversation is stored under a deterministic room key — the two usernames sorted and joined (e.g. `alice::bob`) — so the same history loads no matter who opens the chat first.
6. Typing indicators (`typing:start` / `typing:stop` → `typing:update`) work for both the public room and DMs.
7. Unread message counts show as badges in the sidebar for any conversation that isn't currently open.

REST endpoints are also available for debugging:
- `GET /api/messages` — public room history
- `GET /api/messages/dm?user1=alice&user2=bob` — a private conversation's history
- `GET /api/users` — currently online usernames

## Setup & run locally

### 1. MongoDB

You need a MongoDB instance. Either:

**Option A — Local MongoDB**
```bash
# macOS (Homebrew)
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community
# Ubuntu/Debian — see https://www.mongodb.com/docs/manual/administration/install-on-linux/
```
Then the default `MONGODB_URI=mongodb://127.0.0.1:27017/chat-app` in `.env.example` will just work.

**Option B — MongoDB Atlas (free cloud cluster)**
1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Get your connection string (Database → Connect → Drivers)
3. Use it as `MONGODB_URI` in `backend/.env`, e.g.
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/chat-app`

> If MongoDB isn't reachable, the server still runs — messages just won't persist or load history until the connection is back.

### 2. Backend

```bash
cd backend
cp .env.example .env   # then edit MONGODB_URI if needed
npm install
npm run dev      # starts on http://localhost:4000 (uses nodemon)
# or: npm start
```

### 3. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev       # starts on http://localhost:5173
```

Open **http://localhost:5173** in two browser tabs (or two browsers), pick different usernames. Chat in the public room, or click the other user in the sidebar to start a private 1:1 conversation — messages appear instantly on both sides, and persist in MongoDB.

### Environment variables

- `backend/.env` — `PORT` (defaults to `4000`), `MONGODB_URI` (defaults to local Mongo)
- `frontend/.env` — `VITE_SOCKET_URL` (defaults to `http://localhost:4000`), point this at your deployed backend URL in production.

## Notes on production use

- CORS on the backend is currently open (`origin: "*"`) for easy local development — restrict it to your deployed frontend's origin before shipping.
- Usernames are only unique among currently-online users (in memory); if you need permanent accounts/authentication, add a `User` model with password hashing and a login flow.
- The React app is a standard web build; the same Socket.io event contract (`user:join`, `message:send`, `dm:send`, `chat:message`, `dm:message`, `chat:history`, `dm:history`, `users:list`, `typing:start/stop`) can be reused to build a React Native client if a mobile app is needed later — install `socket.io-client` there and reuse `App.jsx`'s event-handling logic.
