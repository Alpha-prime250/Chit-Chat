import { io } from "socket.io-client";

// Point this at your backend URL. During local dev this is the
// Express/Socket.io server started with `npm run dev` in /backend.
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

// autoConnect is false so we can connect only once the user has
// chosen a username on the login screen.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});