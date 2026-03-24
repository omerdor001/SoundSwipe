// src/routes/songs.js
const express       = require("express");
const authMiddleware = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");
const { searchByGenre, getAvailableGenres } = require("../services/deezer");
const { searchTracks: spotifySearch } = require("../services/spotify");
const { getTrackFeatures, getSimilarTracks } = require("../services/lastfm");
const { buildTasteProfile, rankBySimilarity, getTopLikedGenres, getRecentLikedTrackIds } = require("../services/recommender");

const router = express.Router();
const prisma = new PrismaClient();

const cache    = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function getCached(key)          { const e = cache.get(key); if (!e) return null; if (Date.now() > e.expiresAt) { cache.delete(key); return null; } return e.data; }
function setCache(key, data)     { cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL }); }

router.post("/cache/clear", authMiddleware, (req, res) => {
  const size = cache.size;
  cache.clear();
  res.json({ ok: true, cleared: size });
});

async function enrichWithLastFmFeatures(songs, genre = null) {
  if (!songs || songs.length === 0) return songs;
  
  const promises = songs.slice(0, 20).map(async (song) => {
    try {
      const features = await getTrackFeatures(song.artist, song.title, song.genre || genre);
      return { ...song, features };
    } catch (err) {
      return song;
    }
  });
  
  const enrichedSongs = await Promise.all(promises);
  
  // For remaining songs, use genre-based defaults
  const enrichedMap = new Map(enrichedSongs.map(s => [`${s.title.toLowerCase()}|${s.artist.toLowerCase()}`, s]));
  
  return songs.map(song => {
    const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
    return enrichedMap.get(key) || song;
  });
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    const genre = req.query.genre;

    const swipedIds = await prisma.swipe
      .findMany({ where: { userId: req.user.id }, select: { songId: true } })
      .then(rows => new Set(rows.map(r => r.songId)));

    const likedIds = await getRecentLikedTrackIds(req.user.id, 5);
    let songs;

    const target = genre || pickRandomGenre();
    const cacheKey = `deezer:genre:${target}:${req.user.id}`;
    songs = getCached(cacheKey);

    if (!songs) {
      try {
        songs = await searchByGenre(target, 50);
      } catch (err) {
        console.warn("Deezer search failed:", err.message);
        songs = [];
      }
      
      songs = await enrichWithLastFmFeatures(songs, target);
      setCache(cacheKey, songs);
    }

    let unseen = songs.filter(s => !swipedIds.has(s.id));

    if (unseen.length === 0 && songs.length > 0) {
      unseen = songs;
    }

    const tasteProfile = await buildTasteProfile(req.user.id);
    const ranked = rankBySimilarity(unseen, tasteProfile);

    res.json(ranked);
  } catch (err) {
    console.error("Songs route error:", err);
    res.status(500).json({ error: "Failed to fetch songs: " + err.message });
  }
});

// ── GET /api/songs/search?q=...&mode=artist|title|both ────────────────────────
// Search using Spotify (which has better search + features)
router.get("/search", authMiddleware, async (req, res) => {
  const { q, mode = "artist" } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: "Query must be at least 2 characters" });
  }

  let spotifyQuery;
  if (mode === "both") {
    const [title, artist] = q.split("|||").map(s => s.trim());
    if (!title || !artist) return res.status(400).json({ error: "Both title and artist required" });
    spotifyQuery = `track:"${title}" artist:"${artist}"`;
  } else if (mode === "title") {
    spotifyQuery = `track:"${q.trim()}"`;
  } else {
    spotifyQuery = `artist:"${q.trim()}"`;
  }

  try {
    const cacheKey = `spotify:search:${mode}:${q.toLowerCase()}`;
    let songs = getCached(cacheKey);
    if (!songs) {
      songs = await spotifySearch(spotifyQuery, 20);
      setCache(cacheKey, songs);
    }
    res.json(songs);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed: " + err.message });
  }
});

// ── GET /api/songs/genres ────────────────────────────────────────────────────
// Returns available genre list
router.get("/genres", authMiddleware, async (req, res) => {
  try {
    let genres = getCached("genres");
    if (!genres) {
      genres = await getAvailableGenres();
      setCache("genres", genres);
    }
    res.json(genres);
  } catch {
    res.json([
      "pop","rock","hip hop","electronic","indie","r&b","jazz",
      "classical","metal","country","folk","reggae","latin","k-pop",
      "punk","blues","dance","soul","funk","disco","rap","house",
    ]);
  }
});

// ── GET /api/songs/similar ───────────────────────────────────────────────────
// Get songs similar to user's liked songs
router.get("/similar", authMiddleware, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const cacheKey = `similar:${req.user.id}:${limit}`;
    
    let songs = getCached(cacheKey);
    
    if (!songs) {
      // Get user's recently liked songs
      const likedSwipes = await prisma.swipe.findMany({
        where: { userId: req.user.id, direction: "right" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { song: true }
      });
      
      if (likedSwipes.length === 0) {
        return res.json([]);
      }
      
      // Get similar tracks from Last.fm for each liked song
      const similarTracks = new Map();
      
      for (const swipe of likedSwipes) {
        const song = swipe.song;
        try {
          const similar = await getSimilarTracks(song.artist, song.title, 10);
          
          for (const track of similar) {
            if (!similarTracks.has(track.title + track.artist)) {
              similarTracks.set(track.title + track.artist, {
                title: track.title,
                artist: track.artist,
                match: track.match,
                sourceSong: song.title,
                genre: song.genre,
              });
            }
          }
        } catch (err) {
          console.warn("Similar tracks error for", song.title, err.message);
        }
      }
      
      // Convert to array and sort by match score
      songs = Array.from(similarTracks.values())
        .sort((a, b) => b.match - a.match)
        .slice(0, parseInt(limit))
        .map(track => ({
          id: `similar_${Buffer.from(`${track.title}|${track.artist}`).toString("base64")}`,
          title: track.title,
          artist: track.artist,
          genre: track.genre || "Unknown",
          bpm: null,
          duration: "?:??",
          emoji: "🎵",
          color: "#0d0d1a",
          color2: "#1a1a33",
          desc: `${track.title} by ${track.artist}. Similar to "${track.sourceSong}".`,
          coverUrl: null,
          previewUrl: null,
          features: { energy: null, danceability: null, valence: null, tempo: null, acousticness: null, instrumentalness: null, speechiness: null },
        }));
      
      // Enrich with features
      songs = await enrichWithLastFmFeatures(songs);
      
      setCache(cacheKey, songs);
    }
    
    res.json(songs);
  } catch (err) {
    console.error("Similar songs error:", err);
    res.status(500).json({ error: "Failed to fetch similar songs" });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const DEFAULT_GENRES = ["pop","rock","hip hop","electronic","indie","r&b","jazz","country","dance","metal"];

function pickRandomGenre() {
  return DEFAULT_GENRES[Math.floor(Math.random() * DEFAULT_GENRES.length)];
}

module.exports = router;
