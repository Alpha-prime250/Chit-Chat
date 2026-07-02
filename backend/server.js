/**
 * Real-time chat backend
 * - Express serves a small REST/health surface
 * - Socket.io handles real-time delivery for both the public room and
 *   private 1:1 conversations
 * - MongoDB (via Mongoose) persists every message so history survives
 *   server restarts
 */

require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { connectDB } = require("./db");
const Message = require("./models/Message");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your frontend's origin
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chat-app";
const PUBLIC_ROOM = "public";
const HISTORY_LIMIT = 100;

connectDB(MONGODB_URI);

// ---- Presence (in-memory — who's online right now) ----
const socketToUsername = new Map(); // socket.id -> username
const usernameToSocket = new Map(); // lowercased username -> socket.id

function dmRoomId(userA, userB) {
  return [userA, userB].sort((a, b) => a.localeCompare(b)).join("::");
}

function makeUniqueUsername(requested) {
  let base = String(requested || "Anonymous").trim().slice(0, 24) || "Anonymous";
  let candidate = base;
  let suffix = 1;
  while (usernameToSocket.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

async function saveMessage(doc) {
  try {
    const saved = await Message.create(doc);
    return saved.toObject();
  } catch (err) {
    console.error("Failed to save message:", err.message);
    // Fall back to an in-memory-only message so the app still works
    // even if MongoDB is temporarily unreachable.
    return { ...doc, _id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  }
}

async function loadHistory(room, limit = HISTORY_LIMIT) {
  try {
    const docs = await Message.find({ room }).sort({ timestamp: 1 }).limit(limit).lean();
    return docs;
  } catch (err) {
    console.error("Failed to load history:", err.message);
    return [];
  }
}

// ---- REST endpoints (health checks / debugging) ----
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "chat-app-backend" });
});

app.get("/api/messages", async (req, res) => {
  const messages = await loadHistory(PUBLIC_ROOM);
  res.json(messages);
});

// Fetch a private conversation's history via REST, e.g.
// GET /api/messages/dm?user1=alice&user2=bob
app.get("/api/messages/dm", async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) {
    return res.status(400).json({ error: "user1 and user2 query params are required" });
  }
  const messages = await loadHistory(dmRoomId(user1, user2));
  res.json(messages);
});

app.get("/api/users", (req, res) => {
  res.json(Array.from(usernameToSocket.keys()));
});

// ---- Socket.io real-time logic ----
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // A user joins the chat with a chosen (or auto-generated) username
  socket.on("user:join", async (requestedUsername) => {
    const username = makeUniqueUsername(requestedUsername);
    socketToUsername.set(socket.id, username);
    usernameToSocket.set(username.toLowerCase(), socket.id);

    socket.join(PUBLIC_ROOM);

    // Tell the client its final (possibly de-duplicated) username
    socket.emit("user:joined", { username });

    // Send public room history + current roster
    const history = await loadHistory(PUBLIC_ROOM);
    socket.emit("chat:history", history);
    io.emit("users:list", Array.from(usernameToSocket.keys()));

    const joinMessage = await saveMessage({
      room: PUBLIC_ROOM,
      type: "system",
      text: `${username} joined the chat`,
      timestamp: new Date(),
    });
    socket.to(PUBLIC_ROOM).emit("chat:message", joinMessage);
  });

  // Public room message
  socket.on("message:send", async (payload) => {
    const username = socketToUsername.get(socket.id);
    const text = String(payload?.text || "").trim().slice(0, 1000);
    if (!username || !text) return;

    const message = await saveMessage({
      room: PUBLIC_ROOM,
      type: "message",
      from: username,
      text,
      timestamp: new Date(),
    });

    io.to(PUBLIC_ROOM).emit("chat:message", message);
  });

  // Open (or create) a private 1:1 conversation and load its history
  socket.on("dm:open", async ({ withUsername } = {}) => {
    const me = socketToUsername.get(socket.id);
    if (!me || !withUsername) return;

    const room = dmRoomId(me, withUsername);
    const history = await loadHistory(room);
    socket.emit("dm:history", { withUsername, room, messages: history });
  });

  // Send a private message to exactly one other user
  socket.on("dm:send", async ({ to, text } = {}) => {
    const from = socketToUsername.get(socket.id);
    const trimmedText = String(text || "").trim().slice(0, 1000);
    if (!from || !to || !trimmedText) return;

    const room = dmRoomId(from, to);
    const message = await saveMessage({
      room,
      type: "message",
      from,
      to,
      text: trimmedText,
      timestamp: new Date(),
    });

    // Echo back to the sender
    socket.emit("dm:message", { room, message });

    // Deliver to the recipient if they're currently online
    const recipientSocketId = usernameToSocket.get(String(to).toLowerCase());
    if (recipientSocketId && recipientSocketId !== socket.id) {
      io.to(recipientSocketId).emit("dm:message", { room, message });
    }
  });

  // Typing indicators — works for both the public room and DMs.
  // payload: { to: "public" } or { to: "someUsername" }
  socket.on("typing:start", ({ to } = {}) => {
    const username = socketToUsername.get(socket.id);
    if (!username) return;
    broadcastTyping(socket, username, to, true);
  });

  socket.on("typing:stop", ({ to } = {}) => {
    const username = socketToUsername.get(socket.id);
    if (!username) return;
    broadcastTyping(socket, username, to, false);
  });

  function broadcastTyping(socket, username, to, isTyping) {
    if (!to || to === PUBLIC_ROOM) {
      socket.to(PUBLIC_ROOM).emit("typing:update", { scope: PUBLIC_ROOM, username, isTyping });
      return;
    }
    const recipientSocketId = usernameToSocket.get(String(to).toLowerCase());
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("typing:update", { scope: username, username, isTyping });
    }
  }

  // Cleanup on disconnect
  socket.on("disconnect", async () => {
    const username = socketToUsername.get(socket.id);
    socketToUsername.delete(socket.id);
    if (username) usernameToSocket.delete(username.toLowerCase());

    if (username) {
      const leaveMessage = await saveMessage({
        room: PUBLIC_ROOM,
        type: "system",
        text: `${username} left the chat`,
        timestamp: new Date(),
      });
      socket.to(PUBLIC_ROOM).emit("chat:message", leaveMessage);
      io.emit("users:list", Array.from(usernameToSocket.keys()));
    }

    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});