
# Wavelength — Real-Time Chat App

A full-stack real-time chat application with a public room, private 1:1 chats, and persistent history.

- **Backend:** Node.js + Express + Socket.io + MongoDB (Mongoose)
- **Frontend:** React (Vite) + Socket.io client

Users enter a name and email to join, then chat instantly in the public room or in a private 1:1 conversation with any online user — no refresh required. Every message and user record is persisted in MongoDB, so history survives server restarts.

## Features

- Real-time messaging via Socket.io (public room + private DMs)
- Required name + email on join (validated, stored in MongoDB)
- Private 1:1 conversations — click any online user in the sidebar to open a DM
- Message history persisted in MongoDB, reloaded on join / on opening a DM
- Typing indicators (per conversation)
- Unread message badges in the sidebar
- Online/offline status per user
- Message timestamps

## Project structure

```
chat-app/
├── backend/
│   ├── server.js           # Express server + Socket.io real-time logic
│   ├── db.js                # MongoDB connection helper
│   ├── models/
│   │   ├── Message.js       # Mongoose schema — public + private messages
│   │   └── User.js          # Mongoose schema — username + email records
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx          # Root component: public room + DM state, socket wiring
        ├── App.css          # All styling (design tokens + components)
        ├── socket.js         # Socket.io client instance
        └── components/
            ├── Login.jsx         # Name + email entry screen (both required)
            ├── Sidebar.jsx       # Public room + online users list, unread badges
            ├── ChatWindow.jsx    # Header, message list, typing indicator
            ├── Message.jsx       # Single message bubble
            └── MessageInput.jsx  # Text input + send button
```

## How it works

1. On load, the user enters their **name and email** on the Login screen. Both are required and the email is format-validated before submitting.
2. The frontend connects via **Socket.io** and emits `user:join` with `{ username, email }`. The server validates the payload, de-duplicates the username if it's already taken, upserts a `User` record in MongoDB, and confirms the final username via `user:joined`.
3. **Public room:** `message:send` → server saves the message to MongoDB → broadcasts it to everyone via `chat:message`.
4. **Private 1:1 chat:** clicking a user in the sidebar emits `dm:open`, which loads that conversation's history from MongoDB (`dm:history`). Sending a DM emits `dm:send` with `{ to, text }`; the server saves it and delivers it via `dm:message` to both the sender and the recipient (if online).
5. Each private conversation is stored under a deterministic room key — the two usernames sorted and joined (e.g. `alice::bob`) — so the same history loads no matter who opens the chat first.
6. Typing indicators (`typing:start` / `typing:stop` → `typing:update`) work for both the public room and DMs.
7. Unread message counts show as badges in the sidebar for any conversation that isn't currently open.

### REST endpoints (debugging)

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/api/messages` | Public room history |
| GET | `/api/messages/dm?user1=alice&user2=bob` | A private conversation's history |
| GET | `/api/users` | Currently online usernames |

### Socket.io events

| Event | Direction | Payload |
|---|---|---|
| `user:join` | client → server | `{ username, email }` |
| `user:joined` | server → client | `{ username, email }` (final, de-duplicated) |
| `user:join_error` | server → client | `{ message }` |
| `chat:history` | server → client | `Message[]` (public room) |
| `message:send` | client → server | `{ text }` |
| `chat:message` | server → client | `Message` |
| `dm:open` | client → server | `{ withUsername }` |
| `dm:history` | server → client | `{ withUsername, room, messages }` |
| `dm:send` | client → server | `{ to, text }` |
| `dm:message` | server → client | `{ room, message }` |
| `typing:start` / `typing:stop` | client → server | `{ to }` (`"public"` or a username) |
| `typing:update` | server → client | `{ scope, username, isTyping }` |
| `users:list` | server → client | `string[]` (online usernames) |

## Setup & run locally

### 1. MongoDB

You need a MongoDB instance. Either:

**Option A — Local MongoDB**
```bash
# macOS (Homebrew)
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community

# Windows — download the installer from mongodb.com/try/download/community
# and keep "Install as a Service" checked

# Ubuntu/Debian — see https://www.mongodb.com/docs/manual/administration/install-on-linux/
```
The default `MONGODB_URI=mongodb://127.0.0.1:27017/chat-app` will then work as-is.

**Option B — MongoDB Atlas (free cloud cluster, recommended on Windows)**
1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. **Database Access** → create a user with a simple alphanumeric password (avoids URL-encoding issues)
3. **Network Access** → add `0.0.0.0/0` ("Allow access from anywhere") — required for Render/cloud deploys, and simplest for local dev too
4. **Connect → Drivers** → copy your connection string, e.g.
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

You should see:
```
Chat server listening on http://localhost:4000
MongoDB connected
```

### 3. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev       # starts on http://localhost:5173
```

Open **http://localhost:5173** in two browser tabs (or two browsers), enter a name + email in each. Chat in the public room, or click the other user in the sidebar to start a private 1:1 conversation — messages appear instantly on both sides and persist in MongoDB.

### Environment variables

**`backend/.env`**
```
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/chat-app
CLIENT_URL=*
```
- `MONGODB_URI` — your local or Atlas connection string
- `CLIENT_URL` — comma-separated allowed frontend origin(s) for CORS. Use `*` for local dev; set to your deployed frontend URL in production (e.g. `https://your-app.vercel.app`)

**`frontend/.env`**
```
VITE_SOCKET_URL=http://localhost:4000
```
Point this at your deployed backend URL in production.

## Deployment

### Backend on Render

1. Push your code to a GitHub repo.
2. On [render.com](https://render.com) → **New → Web Service** → select your repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add environment variables: `MONGODB_URI`, `CLIENT_URL` (set this after step below, or leave as `*` initially).
5. Deploy. Render gives you a URL like `https://your-backend.onrender.com`.

> Free tier note: the service sleeps after 15 minutes of inactivity — the first request after that has a ~50 second cold-start delay.

### Frontend on Vercel

1. On [vercel.com](https://vercel.com) → **Add New → Project** → import the same repo.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add environment variable: `VITE_SOCKET_URL = https://your-backend.onrender.com`
4. Deploy. Vercel gives you a URL like `https://your-app.vercel.app`.

### Final step — lock down CORS

Go back to Render → your backend service → **Environment**, and set:
```
CLIENT_URL=https://your-app.vercel.app
```
Save — Render redeploys automatically.

## Troubleshooting

**`Cannot find module './models/Message'` (or `./models/User`) on Render**
Almost always a filename **casing** mismatch. Render's Linux filesystem is case-sensitive; Windows and macOS usually aren't, so a locally-working `require("./models/Message")` can fail if the actual file is `message.js`. Fix:
```bash
git mv backend/models/message.js backend/models/Message.js
git commit -m "Fix casing"
git push
```
If `git mv` doesn't register a pure case change (common on Windows), rename in two steps:
```bash
git mv message.js temp.js && git commit -m "step 1"
git mv temp.js Message.js && git commit -m "step 2"
git push
```
Then on Render: **Manual Deploy → Clear build cache & deploy**, to flush any stale cached files.

**`OverwriteModelError: Cannot overwrite 'User' model once compiled`**
A Mongoose model with that name is being registered twice in the same process — usually because a model file was accidentally duplicated, or another file's content got copy-pasted into the wrong model file. Check each model file only calls `mongoose.model(...)` once, and that `server.js` only requires each model once (`grep -n "models/" backend/server.js`).

**`WebSocket connection ... failed` in the browser console**
Usually non-fatal — Socket.io falls back to polling and upgrades later. Confirm the app actually works (send a message, see it on another tab) before worrying about this. If it truly doesn't connect, confirm the backend is running and `VITE_SOCKET_URL` matches its address.

**`MongoDB connection error: connect ECONNREFUSED 127.0.0.1:27017`**
`MONGODB_URI` isn't set (or isn't loading) — the app is falling back to a local MongoDB address. Confirm `backend/.env` exists, is named exactly `.env` (not `.env.txt`), and sits next to `server.js`.

**`MongoDB connection error: querySrv ECONNREFUSED ...`**
A DNS issue resolving Atlas's SRV record — common on some ISPs. Try switching your DNS to `8.8.8.8` / `8.8.4.4` and flushing DNS (`ipconfig /flushdns` on Windows), or use Atlas's non-SRV standard connection string instead.

**`Error: Cannot find module 'dotenv'` (or any other package)**
Dependencies weren't installed after a `package.json` change. Run `npm install` again in that folder.

## Notes on production use

- This is **not a full authentication system** — no passwords, no session verification. Email is stored as a record only ("this username used this email"), not for login/verification.
- Usernames are unique only among currently-online users (in-memory); add real auth if you need persistent accounts.
- The same Socket.io event contract documented above can be reused to build a React Native client — install `socket.io-client` there and reuse `App.jsx`'s event-handling logic.
