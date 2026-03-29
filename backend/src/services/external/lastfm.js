// src/services/lastfm.js
const https = require("https");
const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "";
const ITUNES_API = "https://itunes.apple.com";

// Audio feature mappings from Last.fm tags (approximate)
const TAG_TO_FEATURE = {
  "energetic": { energy: 0.9 },
  "high energy": { energy: 0.95 },
  "powerful": { energy: 0.85 },
  "aggressive": { energy: 0.9, valence: 0.3 },
  "happy": { valence: 0.8 },
  "sad": { valence: 0.2 },
  "danceable": { danceability: 0.8 },
  "electronic": { danceability: 0.7, energy: 0.8 },
  "chill": { energy: 0.3, valence: 0.6 },
  "acoustic": { acousticness: 0.8, energy: 0.4 },
  "instrumental": { instrumentalness: 0.8 },
  "vocal": { instrumentalness: 0.1 },
  "fast": { tempo: 140 },
  "slow": { tempo: 80 },
  "party": { danceability: 0.9, valence: 0.9 },
  "mellow": { energy: 0.3, danceability: 0.4 },
  "hard rock": { energy: 0.85 },
  "classic rock": { energy: 0.75, valence: 0.6 },
  "rock": { energy: 0.8 },
  "heavy metal": { energy: 0.95 },
  "metal": { energy: 0.95 },
  "death metal": { energy: 0.95, valence: 0.3 },
  "black metal": { energy: 0.95, valence: 0.2 },
  "thrash metal": { energy: 0.95 },
  "pop": { danceability: 0.7, valence: 0.7 },
  "hip hop": { speechiness: 0.3 },
  "rap": { speechiness: 0.3 },
  "hip-hop": { speechiness: 0.3 },
  "jazz": { energy: 0.5, acousticness: 0.6 },
  "classical": { acousticness: 0.9, energy: 0.2 },
  "punk": { energy: 0.9 },
  "reggae": { danceability: 0.8 },
  "blues": { energy: 0.4, acousticness: 0.6 },
  "country": { acousticness: 0.5 },
  "soul": { valence: 0.7 },
  "funk": { danceability: 0.9 },
  "disco": { danceability: 0.9 },
  "house": { danceability: 0.8, energy: 0.8 },
  "indie": { energy: 0.6 },
  "alternative": { energy: 0.65 },
  "r&b": { danceability: 0.75, valence: 0.65 },
  "rb": { danceability: 0.75, valence: 0.65 },
  "edm": { danceability: 0.75, energy: 0.85 },
  "electronic": { danceability: 0.7, energy: 0.8 },
  "techno": { danceability: 0.8, energy: 0.85 },
  "drum and bass": { tempo: 170, energy: 0.9 },
  "dubstep": { energy: 0.85, tempo: 140 },
  "trap": { speechiness: 0.35, tempo: 130 },
  "grunge": { energy: 0.85 },
  "emo": { valence: 0.35, energy: 0.7 },
  "screamo": { energy: 0.9, valence: 0.25 },
  "deathcore": { energy: 0.95, valence: 0.3 },
  "metalcore": { energy: 0.9, valence: 0.35 },
  "post metal": { energy: 0.7, valence: 0.4 },
  "progressive": { energy: 0.75 },
  "post-rock": { energy: 0.6, valence: 0.5 },
};

function extractFeaturesFromTags(tags = [], genre = null) {
  const features = {
    energy: null,
    danceability: null,
    valence: null,
    tempo: null,
    acousticness: null,
    instrumentalness: null,
    speechiness: null,
  };

  // Use genre as fallback
  if (genre && genre !== "Unknown") {
    const genreLower = genre.toLowerCase();
    for (const [keyword, values] of Object.entries(TAG_TO_FEATURE)) {
      if (genreLower.includes(keyword)) {
        for (const [feature, value] of Object.entries(values)) {
          if (features[feature] === null) {
            features[feature] = value;
          }
        }
      }
    }
  }

  let featureCount = 0;

  for (const tag of tags) {
    const tagLower = tag.name?.toLowerCase() || tag.toLowerCase();
    
    for (const [keyword, values] of Object.entries(TAG_TO_FEATURE)) {
      if (tagLower.includes(keyword)) {
        for (const [feature, value] of Object.entries(values)) {
          if (features[feature] === null) {
            features[feature] = value;
            featureCount++;
          }
        }
      }
    }
  }

  // Fill remaining nulls with genre-agnostic defaults
  if (features.energy === null) features.energy = 0.5;
  if (features.danceability === null) features.danceability = 0.5;
  if (features.valence === null) features.valence = 0.5;
  if (features.acousticness === null) features.acousticness = 0.3;
  if (features.instrumentalness === null) features.instrumentalness = 0.2;
  if (features.speechiness === null) features.speechiness = 0.1;
  if (features.tempo === null) features.tempo = 120;

  return features;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
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

async function getTrackFeatures(artist, track, genre = null) {
  if (LASTFM_API_KEY) {
    const url = `${LASTFM_API}?method=track.getInfo&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json`;
    
    try {
      const res = await httpsGet(url);
      
      if (res.status === 200 && res.data?.track?.toptags?.tag) {
        const tags = res.data.track.toptags.tag;
        return extractFeaturesFromTags(tags, genre);
      }
    } catch (err) {
    }
  }
  
  return extractFeaturesFromTags([], genre);
}

async function getSimilarTracks(artist, track, limit = 10) {
  if (!LASTFM_API_KEY) {
    return [];
  }

  const url = `${LASTFM_API}?method=track.getSimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`;
  
  try {
    const res = await httpsGet(url);
    
    if (res.status === 200 && res.data?.similartracks?.track) {
      const tracks = res.data.similartracks.track;
      return tracks.map(t => ({
        title: t.name,
        artist: t.artist?.name || artist,
        match: t.match || 0,
      }));
    }
  } catch (err) {
  }
  
  return [];
}

async function getTrackInfo(artist, track) {
  if (!LASTFM_API_KEY) {
    return null;
  }

  const url = `${LASTFM_API}?method=track.getInfo&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json`;
  
  try {
    const res = await httpsGet(url);
    
    if (res.status === 200 && res.data?.track) {
      if (res.data.track.duration) {
        return {
          duration: msToMinSec(parseInt(res.data.track.duration)),
          tags: res.data.track.toptags?.tag || [],
        };
      }
    }
  } catch (err) {
  }
  
  const iTunesInfo = await searchITunes(artist, track);
  if (iTunesInfo?.duration) {
    return { duration: iTunesInfo.duration, tags: [] };
  }
  
  return null;
}

function msToMinSec(ms) {
  if (!ms) return "?:??";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function searchITunes(artist, track) {
  const url = `${ITUNES_API}/search?q=${encodeURIComponent(artist + " " + track)}&media=music&limit=1`;
  
  try {
    const res = await httpsGet(url);
    if (res.status === 200 && res.data?.results?.[0]?.trackTimeMillis) {
      return {
        duration: msToMinSec(res.data.results[0].trackTimeMillis),
      };
    }
  } catch (err) {
  }
  
  return null;
}

module.exports = {
  getTrackFeatures,
  getSimilarTracks,
  getTrackInfo,
};
