// src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

require("./database/prisma");

const authRoutes     = require("./routes/auth");
const songRoutes     = require("./routes/songs");
const swipeRoutes    = require("./routes/swipes");
const playlistRoutes = require("./routes/playlist");
const previewRoutes  = require("./routes/preview");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────
app.use(cors({ 
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true 
}));
app.use(cookieParser());
app.use(express.json());

// ── Routes ──────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/songs",    songRoutes);
app.use("/api/swipes",   swipeRoutes);
app.use("/api/playlist", playlistRoutes);
app.use("/api/preview",  previewRoutes); 

// ── Health check ────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global error handler ────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`🎵 SoundSwipe API running on http://localhost:${PORT}`);
});
