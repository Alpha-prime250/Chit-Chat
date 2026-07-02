const mongoose = require("mongoose");

/**
 * Lightweight user record — created/updated whenever someone joins the chat.
 * This is NOT a full auth system (no passwords), just a record of who has
 * used the app and their email, so it persists across sessions.
 */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, maxlength: 24 },
    email: { type: String, trim: true, lowercase: true, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// One record per username (case-insensitive), updated on every join.
userSchema.index({ username: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("User", userSchema);