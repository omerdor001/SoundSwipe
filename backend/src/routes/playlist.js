// src/routes/playlist.js
const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/playlist  — get current user's playlist
router.get("/", authMiddleware, async (req, res) => {
  try {
    const entries = await prisma.playlistSong.findMany({
      where: { userId: req.user.id },
      include: { song: true },
      orderBy: { addedAt: "asc" },
    });
    res.json(entries.map((e) => e.song));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/playlist/:songId  — remove a song from playlist
router.delete("/:songId", authMiddleware, async (req, res) => {
  try {
    await prisma.playlistSong
      .delete({ where: { userId_songId: { userId: req.user.id, songId: req.params.songId } } })
      .catch(() => {});

    // Also update the swipe to "left"
    await prisma.swipe
      .update({
        where: { userId_songId: { userId: req.user.id, songId: req.params.songId } },
        data: { direction: "left" },
      })
      .catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
