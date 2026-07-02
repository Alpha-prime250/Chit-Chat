const mongoose = require("mongoose");

async function connectDB(uri) {
  
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    console.error("The server will keep running, but messages will not be persisted or loaded from history until MongoDB is reachable.");
  }
}

module.exports = { connectDB };