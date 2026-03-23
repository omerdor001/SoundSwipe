// src/routes/preview.js
//
// GET /api/preview?title=Blinding+Lights&artist=The+Weeknd
//
// The frontend calls this when a card is shown or when the user hits play.
// The backend fetches from Deezer (no CORS issues server-side) and returns:
//   { previewUrl, coverUrl, deezerUrl }
//
// Responses are cached in-memory for 1 hour per title+artist pair.

const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// In-memory cache: "title|artist" → { result, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(title, artist) {
  return `${title.toLowerCase()}|${artist.toLowerCase()}`;
}

async function getItunesPreview(title, artist) {
  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    const url = `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`;
    const response = await fetch(url);
    const json = await response.json();

    if (!json.results || json.results.length === 0) {
      return null;
    }
    const song = json.results[0];
    return {
      previewUrl: song.previewUrl || null,
      coverUrl: song.artworkUrl100 || null,
      deezerUrl: song.trackViewUrl || null, // keep same key for frontend compatibility
    };
  } catch (err) {
    console.error("iTunes fetch error:", err);
    return null;
  }
}

// POST /api/preview/cache/clear — flush stale Deezer preview cache
// Also called by the frontend "Clear cache" button alongside the song cache
router.post("/cache/clear", authMiddleware, (req, res) => {
  const size = cache.size;
  cache.clear();
  res.json({ ok: true, cleared: size });
});

// GET /api/preview?title=...&artist=...
router.get("/", authMiddleware, async (req, res) => {
  const { title, artist } = req.query;

  if (!title || !artist) {
    return res.status(400).json({ error: "title and artist query params are required" });
  }

  const key = getCacheKey(title, artist);

  // Return cached result if fresh
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.result);
  }

  const result = await getItunesPreview(title, artist);

  // Cache even null results so we don't hammer Deezer for songs it doesn't have
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });

  if (!result) {
    return res.json({ previewUrl: null, coverUrl: null, deezerUrl: null });
  }

  res.json(result);
});

module.exports = router;
