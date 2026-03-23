// src/routes/songs.js
const express = require("express");
const authMiddleware = require("../middleware/auth");
const { searchRecordings } = require("../services/musicbrainz");

const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ── In-memory cache ──────────────────────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.songs;
}
function setCache(key, songs) {
  cache.set(key, { songs, expiresAt: Date.now() + CACHE_TTL_MS });
}

// POST /api/songs/cache/clear  — clears the server-side cache
router.post("/cache/clear", authMiddleware, (req, res) => {
  const size = cache.size;
  cache.clear();
  console.log(`Cache cleared by user ${req.user.username} (${size} entries removed)`);
  res.json({ ok: true, cleared: size });
});

// GET /api/songs  — discovery queue
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { search, genre } = req.query;
    let mbQuery;
    if (search) {
      mbQuery = `(recording:${search} OR artist:${search}) AND status:official`;
    } else if (genre) {
      mbQuery = `tag:${genre.toLowerCase()} AND status:official`;
    } else {
      const defaultGenres = ["pop", "rock", "hip-hop", "electronic", "indie", "r&b"];
      const randomGenre = defaultGenres[Math.floor(Math.random() * defaultGenres.length)];
      mbQuery = `tag:${randomGenre} AND status:official`;
    }

    let songs = getCached(mbQuery);
    if (!songs) {
      songs = await searchRecordings(mbQuery, 50, 0);
      setCache(mbQuery, songs);
    }

    const swipedIds = await prisma.swipe
      .findMany({ where: { userId: req.user.id }, select: { songId: true } })
      .then(rows => new Set(rows.map(r => r.songId)));

    const shuffled = songs.filter(s => !swipedIds.has(s.id)).sort(() => Math.random() - 0.5);
    res.json(shuffled);
  } catch (err) {
    console.error("Songs route error:", err);
    res.status(500).json({ error: "Failed to fetch songs from MusicBrainz" });
  }
});

// GET /api/songs/search?q=<query>&mode=artist|title|both
//
//   artist → artist:"Taylor Swift" AND status:official
//   title  → recording:"Blinding Lights" AND status:official
//   both   → artist:"Taylor Swift" AND recording:"Love Story" AND status:official
//             (frontend sends q as "Title|||Artist")
router.get("/search", authMiddleware, async (req, res) => {
  const { q, mode = "artist" } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: "Query must be at least 2 characters" });
  }

  let mbQuery;
  if (mode === "both") {
    // q arrives as "Title|||Artist"
    const [titlePart, artistPart] = q.split("|||").map(s => s.trim().replace(/"/g, '\\"'));
    if (!titlePart || !artistPart) {
      return res.status(400).json({ error: "Both title and artist are required for combined search" });
    }
    mbQuery = `recording:"${titlePart}" AND artist:"${artistPart}" AND status:official`;
  } else if (mode === "title") {
    const escaped = q.trim().replace(/"/g, '\\"');
    mbQuery = `recording:"${escaped}" AND status:official`;
  } else {
    // default: artist
    const escaped = q.trim().replace(/"/g, '\\"');
    mbQuery = `artist:"${escaped}" AND status:official`;
  }

  try {
    const cacheKey = `search:${mode}:${q.toLowerCase()}`;
    let songs = getCached(cacheKey);
    if (!songs) {
      songs = await searchRecordings(mbQuery, 50, 0);
      setCache(cacheKey, songs);
    }
    res.json(songs);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/songs/genres
router.get("/genres", authMiddleware, (req, res) => {
  res.json([
    "pop", "rock", "hip-hop", "electronic", "indie",
    "r&b", "jazz", "classical", "metal", "country",
    "folk", "reggae", "latin", "k-pop", "punk", "blues", "dance", "soul",
  ]);
});

module.exports = router;
