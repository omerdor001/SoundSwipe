// src/routes/swipes.js
const express = require("express");
const authMiddleware = require("../middleware/auth");
const cron = require("node-cron");

const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanupOldSwipes() {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const result = await prisma.swipe.deleteMany({
      where: {
        direction: "left",
        createdAt: { lt: oneMonthAgo },
      },
    });

    console.log(`[Cleanup] Deleted ${result.count} old unliked swipes`);
  } catch (err) {
    console.error("[Cleanup] Error:", err.message);
  }
}

cron.schedule("0 0 1 * *", cleanupOldSwipes);
console.log("[Scheduler] Monthly swipe cleanup scheduled for the 1st of each month");

if (process.env.RUN_CLEANUP_ON_START === "true") {
  cleanupOldSwipes();
}

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
        id:         song.id,
        title:      song.title,
        artist:     song.artist,
        genre:      song.genre && song.genre !== "Unknown" ? song.genre : "Unknown",
        bpm:        song.bpm    || null,
        duration:   song.duration || "?:??",
        emoji:      song.emoji || "🎵",
        color:      song.color  || "#0d0d1a",
        color2:     song.color2 || "#1a1a33",
        desc:       song.desc   || "",
        coverUrl:   song.coverUrl   || null,
        spotifyUrl: song.spotifyUrl || null,
        previewUrl: song.previewUrl || null,
        features:   song.features   || null,
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

// POST /api/swipes/cleanup  — manually trigger cleanup of old unliked swipes
router.post("/cleanup", authMiddleware, async (req, res) => {
  if (req.user.username !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  await cleanupOldSwipes();
  res.json({ ok: true });
});

module.exports = router;
