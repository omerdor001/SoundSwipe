// src/handlers/songsHandler.js
const { searchByGenre, getAvailableGenres } = require("../services/external/deezer");
const { searchTracks: spotifySearch } = require("../services/external/spotify");
const { getTrackFeatures, getSimilarTracks, getTrackInfo } = require("../services/external/lastfm");
const { buildTasteProfile, rankBySimilarity, getRecentLikedTrackIds } = require("../core/recommender");
const swipeRepository = require("../repositories/swipeRepository");

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const DEFAULT_GENRES = ["pop","rock","hip hop","electronic","indie","r&b","jazz","country","dance","metal"];

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

function pickRandomGenre() {
  return DEFAULT_GENRES[Math.floor(Math.random() * DEFAULT_GENRES.length)];
}

async function enrichWithLastFmFeatures(songs, genre = null) {
  if (!songs || songs.length === 0) return songs;
  
  const promises = songs.slice(0, 20).map(async (song) => {
    try {
      const features = await getTrackFeatures(song.artist, song.title, song.genre || genre);
      return { ...song, features };
    } catch {
      return song;
    }
  });
  
  const enrichedSongs = await Promise.all(promises);
  const enrichedMap = new Map(enrichedSongs.map(s => [`${s.title.toLowerCase()}|${s.artist.toLowerCase()}`, s]));
  
  return songs.map(song => {
    const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
    return enrichedMap.get(key) || song;
  });
}

async function getSongs(req, res) {
  try {
    const genre = req.query.genre;

    const swipedRows = await swipeRepository.findByUser(req.user.id, {
      select: { songId: true }
    });
    const swipedIds = new Set(swipedRows.map(r => r.songId));

    let songs;

    const target = genre || pickRandomGenre();
    const cacheKey = `deezer:genre:${target}:${req.user.id}`;
    songs = getCached(cacheKey);

    if (!songs) {
      try {
        songs = await searchByGenre(target, 50);
      } catch {
        songs = [];
      }
      
      songs = await enrichWithLastFmFeatures(songs, target);
      setCache(cacheKey, songs);
    }

    let unseen = songs.filter(s => !swipedIds.has(s.id));

    if (unseen.length === 0) {
      return res.json([]);
    }

    const tasteProfile = await buildTasteProfile(req.user.id);
    const ranked = rankBySimilarity(unseen, tasteProfile);

    res.json(ranked);
  } catch {
    res.status(500).json({ error: "Failed to fetch songs" });
  }
}

async function searchSongs(req, res) {
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
  } catch {
    res.status(500).json({ error: "Search failed" });
  }
}

async function getGenres(req, res) {
  try {
    let genres = getCached("genres");
    if (!genres) {
      genres = await getAvailableGenres();
      setCache("genres", genres);
    }
    res.json(genres);
  } catch {
    res.json(DEFAULT_GENRES);
  }
}

async function getSimilarSongs(req, res) {
  try {
    const { limit = 20 } = req.query;
    const cacheKey = `similar:${req.user.id}:${limit}`;
    
    let songs = getCached(cacheKey);
    
    if (!songs) {
      const likedSwipes = await swipeRepository.findByUser(req.user.id, {
        where: { direction: "right" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { song: true }
      });
      
      if (likedSwipes.length === 0) {
        return res.json([]);
      }
      
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
        } catch {}
      }
      
      const tracksArray = Array.from(similarTracks.values())
        .sort((a, b) => b.match - a.match)
        .slice(0, parseInt(limit));
      
      const trackInfos = await Promise.all(
        tracksArray.map(t => getTrackInfo(t.artist, t.title))
      );
      
      songs = tracksArray.map((track, idx) => {
        const info = trackInfos[idx];
        return {
          id: `similar_${Buffer.from(`${track.title}|${track.artist}`).toString("base64")}`,
          title: track.title,
          artist: track.artist,
          genre: track.genre || "Unknown",
          bpm: null,
          duration: info?.duration || "?:??",
          emoji: "🎵",
          color: "#0d0d1a",
          color2: "#1a1a33",
          desc: `${track.title} by ${track.artist}. Similar to "${track.sourceSong}".`,
          coverUrl: null,
          previewUrl: null,
          features: { energy: null, danceability: null, valence: null, tempo: null, acousticness: null, instrumentalness: null, speechiness: null },
        };
      });
      
      songs = await enrichWithLastFmFeatures(songs);
      
      setCache(cacheKey, songs);
    }
    
    res.json(songs);
  } catch {
    res.status(500).json({ error: "Failed to fetch similar songs" });
  }
}

function clearCache(req, res) {
  const size = cache.size;
  cache.clear();
  res.json({ ok: true, cleared: size });
}

module.exports = {
  getSongs,
  searchSongs,
  getGenres,
  getSimilarSongs,
  clearCache,
};
