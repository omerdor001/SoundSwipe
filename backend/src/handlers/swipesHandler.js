// src/handlers/swipesHandler.js
const cron = require("node-cron");
const swipeRepository = require("../repositories/swipeRepository");
const songRepository = require("../repositories/songRepository");
const playlistRepository = require("../repositories/playlistRepository");

async function cleanupOldSwipes() {
  await swipeRepository.deleteOldUnliked(1);
}

cron.schedule("0 0 1 * *", cleanupOldSwipes);

if (process.env.RUN_CLEANUP_ON_START === "true") {
  cleanupOldSwipes();
}

async function createSwipe(req, res) {
  const { song, direction } = req.body;
  if (!song?.id || !["left", "right"].includes(direction)) {
    return res.status(400).json({ error: "song object and direction (left|right) required" });
  }

  try {
    console.log(`[Swipe] User ${req.user.id} swiped ${direction} on song ${song.id}: "${song.title}"`);

    await songRepository.upsert({
      id: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre && song.genre !== "Unknown" ? song.genre : "Unknown",
      bpm: song.bpm || null,
      duration: song.duration || "?:??",
      emoji: song.emoji || "🎵",
      color: song.color || "#0d0d1a",
      color2: song.color2 || "#1a1a33",
      desc: song.desc || "",
      coverUrl: song.coverUrl || null,
      spotifyUrl: song.spotifyUrl || null,
      previewUrl: song.previewUrl || null,
      features: song.features || null,
    });

    const swipe = await swipeRepository.upsert(req.user.id, song.id, direction);

    if (direction === "right") {
      console.log(`[Playlist] Adding song ${song.id} to playlist for user ${req.user.id}`);
      await playlistRepository.upsert(req.user.id, song.id);
      console.log(`[Playlist] Song added successfully`);
    } else {
      await playlistRepository.deleteByUserAndSong(req.user.id, song.id);
    }

    res.json({ swipe });
  } catch (e) {
    console.error("[Swipe] Error:", e);
    res.status(500).json({ error: "Server error" });
  }
}

async function deleteSwipe(req, res) {
  try {
    await swipeRepository.deleteByUserAndSong(req.user.id, req.params.songId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function resetSwipes(req, res) {
  try {
    await swipeRepository.deleteAllByUser(req.user.id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function runCleanup(req, res) {
  if (req.user.username !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  await cleanupOldSwipes();
  res.json({ ok: true });
}

module.exports = {
  createSwipe,
  deleteSwipe,
  resetSwipes,
  runCleanup,
};
