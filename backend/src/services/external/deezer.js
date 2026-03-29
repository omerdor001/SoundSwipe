// src/services/deezer.js
const DEEZER_API = "https://api.deezer.com";
const https = require("https");

const DEEZER_GENRE_IDS = {
  "pop": 132,
  "rock": 152,
  "hip hop": 116,
  "electronic": 106,
  "jazz": 129,
  "metal": 464,
  "country": 464,
};

const GENRE_STYLE = {
  "pop":           { emoji: "🌸", color: "#1a0a2e", color2: "#3d1456" },
  "rock":          { emoji: "🎸", color: "#1a0800", color2: "#3d1800" },
  "hip hop":       { emoji: "🎤", color: "#0a0a0a", color2: "#2a2a2a" },
  "rap":           { emoji: "🎤", color: "#0a0a0a", color2: "#2a2a2a" },
  "r&b":           { emoji: "🎷", color: "#1a0d00", color2: "#3d2200" },
  "soul":          { emoji: "🎷", color: "#1a0800", color2: "#2e1200" },
  "jazz":          { emoji: "🎺", color: "#001a1a", color2: "#003333" },
  "electronic":    { emoji: "🎛️", color: "#0a0a1a", color2: "#14142e" },
  "edm":           { emoji: "🎛️", color: "#0a0a1a", color2: "#14142e" },
  "dance":         { emoji: "✨", color: "#1a0d2e", color2: "#3d2270" },
  "house":         { emoji: "✨", color: "#0d0a2e", color2: "#2a1456" },
  "indie":         { emoji: "🌿", color: "#0a1a0a", color2: "#1a3a1a" },
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
  "default":       { emoji: "🎵", color: "#0d0d1a", color2: "#1a1a33" },
};

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: "GET"
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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

function styleForGenre(genre) {
  const lower = genre.toLowerCase();
  for (const [key, style] of Object.entries(GENRE_STYLE)) {
    if (key !== "default" && lower.includes(key)) return { style, matched: key };
  }
  return { style: GENRE_STYLE["default"], matched: null };
}

function formatGenreLabel(raw) {
  if (!raw) return "Unknown";
  return raw.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function msToDuration(ms) {
  if (!ms) return "?:??";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function normalizeDeezerTrack(track, forcedGenre = null) {
  if (!track?.id || !track?.title) return null;
  
  const artistName = track.artist?.name || "Unknown Artist";
  const albumName = track.album?.title || "Unknown Album";
  
  const genreLabel = forcedGenre ? formatGenreLabel(forcedGenre) : "Unknown";
  const { style } = styleForGenre(genreLabel);
  
  const coverUrl = track.album?.cover_medium || track.album?.cover_big || track.album?.cover || null;
  
  return {
    id: String(track.id),
    title: track.title,
    artist: artistName,
    genre: genreLabel,
    bpm: null,
    duration: msToDuration(track.duration * 1000),
    emoji: style.emoji,
    color: style.color,
    color2: style.color2,
    desc: `${track.title} by ${artistName}. From the album "${albumName}".`,
    coverUrl,
    deezerUrl: track.link || `https://www.deezer.com/track/${track.id}`,
    previewUrl: track.preview || null,
    features: {
      energy: null,
      danceability: null,
      valence: null,
      tempo: null,
      acousticness: null,
      instrumentalness: null,
      speechiness: null,
    },
  };
}

async function searchByGenre(genre, limit = 50) {
  const genreLower = genre.toLowerCase();
  const genreId = DEEZER_GENRE_IDS[genreLower];
  
  if (genreId) {
    const url = `${DEEZER_API}/chart/${genreId}/tracks?limit=${limit}`;
    const res = await httpsGet(url);
    
    if (res.status === 200 && res.data?.data && res.data.data.length > 0) {
      return res.data.data.map(track => normalizeDeezerTrack(track, genre)).filter(Boolean);
    }
  }
  
  // Fallback to search
  const searchUrl = `${DEEZER_API}/search?q=${encodeURIComponent(genreLower)}&limit=${limit}`;
  const searchRes = await httpsGet(searchUrl);
  
  if (searchRes.status !== 200 || !searchRes.data?.data) {
    return [];
  }
  
  return searchRes.data.data.map(track => normalizeDeezerTrack(track, genre)).filter(Boolean);
}

async function searchTracks(query, limit = 50, index = 0) {
  const encodedQuery = encodeURIComponent(query);
  const url = `${DEEZER_API}/search?q=${encodedQuery}&limit=${Math.min(limit, 50)}&index=${index}`;
  
  const res = await httpsGet(url);
  
  if (res.status !== 200 || !res.data?.data) {
    return [];
  }
  
  return res.data.data.map(track => normalizeDeezerTrack(track)).filter(Boolean);
}

async function getAvailableGenres() {
  return [
    "pop", "rock", "hip hop", "rap", "r&b", "soul", "jazz",
    "electronic", "edm", "dance", "house", "indie", "metal",
    "classical", "country", "folk", "reggae", "latin", "k-pop",
    "punk", "blues", "funk", "disco"
  ];
}

function msToDuration(ms) {
  if (!ms) return "?:??";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function searchTrack(artist, title) {
  const url = `${DEEZER_API}/search?q=${encodeURIComponent(artist + " " + title)}&limit=1`;
  
  try {
    const res = await httpsGet(url);
    if (res.status === 200 && res.data?.data?.[0]) {
      return {
        duration: msToDuration(res.data.data[0].duration * 1000),
      };
    }
  } catch (err) {
  }
  
  return null;
}

module.exports = {
  searchByGenre,
  getAvailableGenres,
  searchTrack,
};
