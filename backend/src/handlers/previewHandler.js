// src/handlers/previewHandler.js

const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

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
      deezerUrl: song.trackViewUrl || null,
    };
  } catch {
    return null;
  }
}

async function getPreview(req, res) {
  const { title, artist } = req.query;

  if (!title || !artist) {
    return res.status(400).json({ error: "title and artist query params are required" });
  }

  const key = getCacheKey(title, artist);

  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.result);
  }

  const result = await getItunesPreview(title, artist);

  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });

  if (!result) {
    return res.json({ previewUrl: null, coverUrl: null, deezerUrl: null });
  }

  res.json(result);
}

function clearCache(req, res) {
  const size = cache.size;
  cache.clear();
  res.json({ ok: true, cleared: size });
}

module.exports = {
  getPreview,
  clearCache,
};
