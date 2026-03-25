// src/services/spotify.js
//
// Spotify Web API wrapper — SERVER-SIDE only.
//
// Auth: Client Credentials Flow (no user login needed)
//   POST https://accounts.spotify.com/api/token
//   → access_token valid for 3600 seconds, auto-refreshed here
//
// Endpoints used:
//   GET /v1/search?q=...&type=track          — discover songs
//   GET /v1/audio-features?ids=...           — energy, danceability, etc (for CBF)
//
// Spotify gives us rich genre data via the artist endpoint, real BPM (tempo),
// duration_ms, popularity, and album art at multiple resolutions.
//
// Setup: create a free app at https://developer.spotify.com/dashboard
// and add SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET to your .env

const SPOTIFY_BASE    = "https://api.spotify.com/v1";
const SPOTIFY_AUTH    = "https://accounts.spotify.com/api/token";
const https = require("https");

// ── Genre → emoji + card gradient ────────────────────────────────────────────
const GENRE_STYLE = {
  "pop":           { emoji: "🌸", color: "#1a0a2e", color2: "#3d1456" },
  "rock":          { emoji: "🎸", color: "#1a0800", color2: "#3d1800" },
  "hip hop":       { emoji: "🎤", color: "#0a0a0a", color2: "#2a2a2a" },
  "hip-hop":       { emoji: "🎤", color: "#0a0a0a", color2: "#2a2a2a" },
  "rap":           { emoji: "🎤", color: "#0a0a0a", color2: "#2a2a2a" },
  "r&b":           { emoji: "🎷", color: "#1a0d00", color2: "#3d2200" },
  "soul":          { emoji: "🎷", color: "#1a0800", color2: "#2e1200" },
  "jazz":          { emoji: "🎺", color: "#001a1a", color2: "#003333" },
  "electronic":    { emoji: "🎛️", color: "#0a0a1a", color2: "#14142e" },
  "edm":           { emoji: "🎛️", color: "#0a0a1a", color2: "#14142e" },
  "dance":         { emoji: "✨", color: "#1a0d2e", color2: "#3d2270" },
  "house":         { emoji: "✨", color: "#0d0a2e", color2: "#2a1456" },
  "indie":         { emoji: "🌿", color: "#0a1a0a", color2: "#1a3a1a" },
  "alternative":   { emoji: "🌀", color: "#001a0a", color2: "#002e14" },
  "metal":         { emoji: "🤘", color: "#0a0000", color2: "#1a0000" },
  "classical":     { emoji: "🎻", color: "#1a1000", color2: "#332200" },
  "country":       { emoji: "🤠", color: "#1a0d00", color2: "#2e1800" },
  "folk":          { emoji: "🪕", color: "#0d1a00", color2: "#1a2e00" },
  "reggae":        { emoji: "🌴", color: "#001a00", color2: "#003300" },
  "latin":         { emoji: "💃", color: "#1a0000", color2: "#330000" },
  "k-pop":         { emoji: "💫", color: "#0a0a1a", color2: "#1a1a3d" },
  "punk":          { emoji: "💢", color: "#2e0a1a", color2: "#5c1a3a" },
  "blues":         { emoji: "🌙", color: "#0a0a2e", color2: "#14145c" },
  "funk":          { emoji: "🕺", color: "#1a0d00", color2: "#331a00" },
  "disco":         { emoji: "🪩", color: "#1a001a", color2: "#330033" },
  "ambient":       { emoji: "🌊", color: "#001a2e", color2: "#003366" },
  "trap":          { emoji: "🔊", color: "#0d0d0d", color2: "#1a1a1a" },
  "default":       { emoji: "🎵", color: "#0d0d1a", color2: "#1a1a33" },
};

function styleForGenres(genres = []) {
  for (const g of genres) {
    const lower = g.toLowerCase();
    for (const [key, style] of Object.entries(GENRE_STYLE)) {
      if (key !== "default" && lower.includes(key)) return { style, matched: key };
    }
  }
  return { style: GENRE_STYLE["default"], matched: null };
}

// Capitalise first letter of each word, clean up spotify genre slugs like "hip-hop"
function formatGenreLabel(raw) {
  if (!raw) return "Unknown";
  return raw
    .split(/[-\s]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function msToDuration(ms) {
  if (!ms) return "?:??";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Token management ──────────────────────────────────────────────────────────
let _token       = null;
let _tokenExpiry = 0;

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers
    };
    
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function getToken() {
  if (_token && Date.now() < _tokenExpiry - 30_000) return _token;

  const id     = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!id || !secret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env");
  }

  const authString = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await httpsPost(SPOTIFY_AUTH, {
    "Content-Type": "application/x-www-form-urlencoded",
    "Authorization": `Basic ${authString}`
  }, "grant_type=client_credentials");

  if (res.status >= 400) {
    throw new Error(`Spotify auth failed: ${res.status}`);
  }

  _token       = res.data.access_token;
  _tokenExpiry = Date.now() + res.data.expires_in * 1000;
  return _token;
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    const options = {
      hostname: urlObj.hostname,
      path: path,
      method: "GET",
      headers
    };
    
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

async function spotifyGet(path) {
  const token = await getToken();
  const res = await httpsGet(`${SPOTIFY_BASE}${path}`, {
    Authorization: `Bearer ${token}`
  });
  if (res.status >= 400) {
    throw new Error(`Spotify API error: ${res.status} ${path} - ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

// ── Artist genre cache (avoid re-fetching same artists repeatedly) ────────────
const artistGenreCache = new Map();

async function getArtistGenres(artistId) {
  if (artistGenreCache.has(artistId)) return artistGenreCache.get(artistId);
  try {
    const data = await spotifyGet(`/artists/${artistId}`);
    const genres = data.genres || [];
    artistGenreCache.set(artistId, genres);
    return genres;
  } catch {
    return [];
  }
}

// ── Normalize a Spotify track into our Song schema ────────────────────────────
async function normalizeTrack(track, audioFeatures = null) {
  // Spotify track objects can be nested under track.track in some endpoints
  const t = track.track || track;
  if (!t?.id || !t?.name) return null;

  const artistId   = t.artists?.[0]?.id;
  const artistName = t.artists?.map(a => a.name).join(", ") || "Unknown Artist";

  // Fetch artist genres (Spotify puts genres on artists, not tracks)
  const rawGenres = artistId ? await getArtistGenres(artistId) : [];

  const { style, matched } = styleForGenres(rawGenres);
  const genreLabel = matched
    ? formatGenreLabel(matched)
    : rawGenres.length > 0
      ? formatGenreLabel(rawGenres[0])
      : "Unknown";

  // Album art: prefer 300px, fall back to whatever's available
  const images  = t.album?.images || [];
  const coverUrl = (images.find(i => i.width >= 300) || images[0])?.url || null;

  const features = audioFeatures || {};

  return {
    id:          t.id,
    title:       t.name,
    artist:      artistName,
    genre:       genreLabel,
    bpm:         features.tempo ? Math.round(features.tempo) : null,
    duration:    msToDuration(t.duration_ms),
    emoji:       style.emoji,
    color:       style.color,
    color2:      style.color2,
    desc:        `${t.name} by ${artistName}. From the album "${t.album?.name || "Unknown"}".`,
    popularity:  t.popularity || 0,
    coverUrl,    // used by SnippetPlayer / PlatformModal — stored in DB
    spotifyUrl:  t.external_urls?.spotify || null,
    previewUrl:  t.preview_url || null,  // Spotify's own 30s preview (when available)
    // Audio features for Content-Based Filtering
    features: {
      energy:           features.energy           ?? null,
      danceability:     features.danceability     ?? null,
      valence:          features.valence          ?? null,
      tempo:            features.tempo            ?? null,
      acousticness:     features.acousticness     ?? null,
      instrumentalness: features.instrumentalness ?? null,
      speechiness:      features.speechiness      ?? null,
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search Spotify tracks by query.
 * @param {string} q       - search query (can use field filters: artist:X, track:Y)
 * @param {number} limit   - max results (1-50)
 * @param {number} offset  - pagination
 */
async function searchTracks(q, limit = 20, offset = 0, market = null) {
  limit = Math.min(Math.max(1, limit), 10);
  const encodedQ = encodeURIComponent(q);
  let url = `/search?q=${encodedQ}&type=track&limit=${limit}&offset=${offset}`;
  if (market) url += `&market=${market}`;
  const data = await spotifyGet(url);
  const tracks = data?.tracks?.items || [];

  // Fetch audio features for all tracks in one batch request
  const ids = tracks.map(t => t.id).filter(Boolean).join(",");
  let featuresMap = {};

  if (ids) {
    try {
      const featData = await spotifyGet(`/audio-features?ids=${ids}`);
      for (const f of (featData.audio_features || [])) {
        if (f) featuresMap[f.id] = f;
      }
    } catch {
      // Audio features are optional — proceed without them
    }
  }

  const normalized = await Promise.all(
    tracks.map(t => normalizeTrack(t, featuresMap[t.id] || null))
  );

  return normalized.filter(Boolean);
}

module.exports = { 
  searchTracks, 
};
