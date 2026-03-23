// src/services/musicbrainz.js
//
// MusicBrainz API wrapper
// Docs: https://musicbrainz.org/doc/MusicBrainz_API
//
// Rules:
//  - No API key needed, but a descriptive User-Agent is REQUIRED
//  - Rate limit: max 1 request/second (we add a small delay between calls)
//  - Always request fmt=json
//

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "SoundSwipe/1.0.0 (https://github.com/yourname/soundswipe)";

// Genre tag → emoji + gradient color mapping
const GENRE_STYLE = {
  "pop":          { emoji: "🌸", color: "#1a0a2e", color2: "#3d1456" },
  "rock":         { emoji: "🎸", color: "#1a0800", color2: "#3d1800" },
  "hip hop":      { emoji: "🎤", color: "#0a0a0a", color2: "#2a2a2a" },
  "hip-hop":      { emoji: "🎤", color: "#0a0a0a", color2: "#2a2a2a" },
  "r&b":          { emoji: "🎷", color: "#1a0d00", color2: "#3d2200" },
  "soul":         { emoji: "🎷", color: "#1a0800", color2: "#2e1200" },
  "jazz":         { emoji: "🎺", color: "#001a1a", color2: "#003333" },
  "electronic":   { emoji: "🎛️", color: "#0a0a1a", color2: "#14142e" },
  "dance":        { emoji: "✨", color: "#1a0d2e", color2: "#3d2270" },
  "indie":        { emoji: "🌿", color: "#0a1a0a", color2: "#1a3a1a" },
  "alternative":  { emoji: "🌀", color: "#001a0a", color2: "#002e14" },
  "metal":        { emoji: "🤘", color: "#0a0000", color2: "#1a0000" },
  "classical":    { emoji: "🎻", color: "#1a1000", color2: "#332200" },
  "country":      { emoji: "🤠", color: "#1a0d00", color2: "#2e1800" },
  "folk":         { emoji: "🪕", color: "#0d1a00", color2: "#1a2e00" },
  "reggae":       { emoji: "🌴", color: "#001a00", color2: "#003300" },
  "latin":        { emoji: "💃", color: "#1a0000", color2: "#330000" },
  "k-pop":        { emoji: "💫", color: "#0a0a1a", color2: "#1a1a3d" },
  "punk":         { emoji: "💢", color: "#2e0a1a", color2: "#5c1a3a" },
  "blues":        { emoji: "🌙", color: "#0a0a2e", color2: "#14145c" },
  "default":      { emoji: "🎵", color: "#0d0d1a", color2: "#1a1a33" },
};

function getStyleForTags(tags = []) {
  if (!tags.length) return GENRE_STYLE["default"];
  const tagNames = tags.map(t => (t.name || "").toLowerCase());
  for (const key of Object.keys(GENRE_STYLE)) {
    if (key === "default") continue;
    if (tagNames.some(t => t.includes(key))) return GENRE_STYLE[key];
  }
  return GENRE_STYLE["default"];
}

function msToMinSec(ms) {
  if (!ms) return "?:??";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pickGenreLabel(tags = []) {
  if (!tags.length) return "Unknown";
  // Sort by count descending, pick first recognizable genre
  const sorted = [...tags].sort((a, b) => (b.count || 0) - (a.count || 0));
  const name = sorted[0]?.name || "Unknown";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Search MusicBrainz recordings by a text query.
 * Returns an array of normalized song objects ready to save in our DB.
 *
 * @param {string} query  - Lucene query string, e.g. "tag:pop" or "artist:Radiohead"
 * @param {number} limit  - max results (1-100)
 * @param {number} offset - pagination offset
 */
async function searchRecordings(query, limit = 25, offset = 0) {
  const url = new URL(`${MB_BASE}/recording`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("inc", "tags+artist-credits+releases");
  url.searchParams.set("fmt", "json");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`MusicBrainz API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const recordings = data.recordings || [];

  return recordings
    .filter(r => r.title && r["artist-credit"]?.length)
    .map(r => {
      const artistName = r["artist-credit"]
        .map(ac => (typeof ac === "string" ? ac : ac.artist?.name || ""))
        .join("");

      const tags = r.tags || [];
      const style = getStyleForTags(tags);
      const genre = pickGenreLabel(tags);

      return {
        // Use MusicBrainz MBID as our DB id
        id:       r.id,
        title:    r.title,
        artist:   artistName || "Unknown Artist",
        genre,
        bpm:      null,           // MusicBrainz doesn't expose BPM in search results
        duration: msToMinSec(r.length),
        emoji:    style.emoji,
        color:    style.color,
        color2:   style.color2,
        desc:     `${r.title} by ${artistName}. Released ${r["first-release-date"] || "unknown"}.`,
        mbid:     r.id,
      };
    });
}

/**
 * Fetch a curated set of popular recordings across multiple genres.
 * Spreads requests across genres to get variety.
 * Respects the 1 req/sec rate limit with a small delay between calls.
 */
async function fetchPopularSongs(totalTarget = 50) {
  const queries = [
    { q: "tag:pop AND status:official",         count: 10 },
    { q: "tag:rock AND status:official",         count: 10 },
    { q: "tag:hip-hop AND status:official",      count: 8  },
    { q: "tag:electronic AND status:official",   count: 8  },
    { q: "tag:indie AND status:official",        count: 7  },
    { q: "tag:r&b AND status:official",          count: 7  },
  ];

  const results = [];
  const seenIds = new Set();

  for (const { q, count } of queries) {
    try {
      const songs = await searchRecordings(q, count, 0);
      for (const song of songs) {
        if (!seenIds.has(song.id)) {
          seenIds.add(song.id);
          results.push(song);
        }
      }
      // Respect rate limit: wait 1.1s between requests
      await new Promise(r => setTimeout(r, 1100));
    } catch (err) {
      console.warn(`MusicBrainz query failed (${q}):`, err.message);
    }
  }

  return results.slice(0, totalTarget);
}

module.exports = { searchRecordings, fetchPopularSongs };
