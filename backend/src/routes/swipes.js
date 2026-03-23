// src/routes/swipes.js
const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// POST /api/swipes
// Body: { song: <full song object from MusicBrainz>, direction: "left"|"right" }
// We receive the full song object from the frontend so we can upsert it into our DB
// (songs are NOT pre-seeded — they come live from MusicBrainz).
router.post("/", authMiddleware, async (req, res) => {
  const { song, direction } = req.body;

  if (!song?.id || !["left", "right"].includes(direction)) {
    return res.status(400).json({ error: "song object and direction (left|right) required" });
  }

  try {
    // 1. Upsert the song into our DB so we can reference it via FK
    await prisma.song.upsert({
      where: { id: song.id },
      update: {},   // Don't overwrite existing data
      create: {
        id:       song.id,
        title:    song.title,
        artist:   song.artist,
        genre:    song.genre || "Unknown",
        bpm:      song.bpm || null,
        duration: song.duration || "?:??",
        emoji:    song.emoji || "🎵",
        color:    song.color || "#0d0d1a",
        color2:   song.color2 || "#1a1a33",
        desc:     song.desc || "",
      },
    });

    // 2. Record the swipe
    const swipe = await prisma.swipe.upsert({
      where: { userId_songId: { userId: req.user.id, songId: song.id } },
      update: { direction },
      create: { userId: req.user.id, songId: song.id, direction },
    });

    // 3. Sync playlist: right → add, left → remove
    if (direction === "right") {
      await prisma.playlistSong.upsert({
        where: { userId_songId: { userId: req.user.id, songId: song.id } },
        update: {},
        create: { userId: req.user.id, songId: song.id },
      });
    } else {
      await prisma.playlistSong
        .delete({ where: { userId_songId: { userId: req.user.id, songId: song.id } } })
        .catch(() => {}); // OK if not found
    }

    res.json({ swipe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/swipes/:songId  — undo a swipe
router.delete("/:songId", authMiddleware, async (req, res) => {
  try {
    await prisma.swipe
      .delete({ where: { userId_songId: { userId: req.user.id, songId: req.params.songId } } })
      .catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/swipes/reset  — clear all swipes for this user (restart discovery)
router.post("/reset", authMiddleware, async (req, res) => {
  try {
    await prisma.swipe.deleteMany({ where: { userId: req.user.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
