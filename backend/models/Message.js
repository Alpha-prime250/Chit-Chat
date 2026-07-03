const mongoose = require("mongoose");

/**
 * A single unified schema for every message.
 *
 * room:
 *   - "public"                     -> the shared public chat room
 *   - "<userA>::<userB>" (sorted)  -> a private 1:1 conversation between two usernames
 *
 * type:
 *   - "message" -> a normal chat message
 *   - "system"  -> join/leave notices (public room only)
 */
const messageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, index: true },
    type: { type: String, enum: ["message", "system"], default: "message" },
    from: { type: String, default: null }, // username of sender (null for system messages)
    to: { type: String, default: null }, // username of recipient (only set for private messages)
    text: { type: String, required: true, maxlength: 1000 },
    timestamp: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

messageSchema.index({ room: 1, timestamp: 1 });

module.exports = mongoose.model("Message", messageSchema);