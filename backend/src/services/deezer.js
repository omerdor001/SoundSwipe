// src/services/deezer.js
//
// Deezer API wrapper — SERVER-SIDE only (avoids browser CORS restrictions).
//
// Endpoint used:
//   GET https://api.deezer.com/search/track?q=...&limit=1&order=RANKING
//
// IMPORTANT — query strategy:
//   The naive approach of concatenating title + artist ("Blinding Lights The Weeknd")
//   does a fuzzy full-text match and often returns a completely wrong popular song.
//
//   We instead use Deezer's field-specific syntax:
//     track:"You and the Night and the Music" artist:"Ruth Brown"
//   This searches the title and artist fields separately, returning the correct track.
//
//   If the precise query returns nothing (e.g. Deezer has the song but with a slightly
//   different artist spelling), we fall back to title-only: track:"..."
//
// No API key needed. Rate limit is generous for server-side use.

const DEEZER_BASE = "https://api.deezer.com";

async function fetchDeezer(query) {
  const url = `${DEEZER_BASE}/search/track?q=${encodeURIComponent(query)}&limit=1&order=RANKING`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0] || null;
}

/**
 * Search Deezer for a track preview + cover art.
 * Uses field-specific queries to avoid wrong-song matches.
 *
 * @param {string} title
 * @param {string} artist
 * @returns {{ previewUrl, coverUrl, deezerUrl, deezerTitle, deezerArtist } | null}
 */
async function getDeezerPreview(title, artist) {
  try {
    // 1st attempt: exact title + exact artist
    let track = await fetchDeezer(`track:"${title}" artist:"${artist}"`);

    // 2nd attempt: exact title only (artist name might differ slightly in Deezer)
    if (!track || !track.preview) {
      track = await fetchDeezer(`track:"${title}"`);
    }

    // Give up — Deezer doesn't have this track
    if (!track || !track.preview) return null;

    return {
      previewUrl:   track.preview,
      coverUrl:     track.album?.cover_medium || track.album?.cover_small || null,
      deezerUrl:    track.link || null,
      deezerTitle:  track.title,
      deezerArtist: track.artist?.name,
    };
  } catch (err) {
    console.warn(`Deezer lookup failed for "${title}" by "${artist}":`, err.message);
    return null;
  }
}

module.exports = { getDeezerPreview };
