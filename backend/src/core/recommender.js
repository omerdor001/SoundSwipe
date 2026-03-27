// src/core/recommender.js
//
// Content-Based Filtering (CBF) recommendation engine.
//
// HOW IT WORKS:
//   1. For each right-swipe (like), we add the song's audio feature vector to a
//      running "like profile".
//   2. Candidate songs are scored by cosine similarity to the taste vector.
//   3. Songs are re-ranked: liked-genre songs get a +0.15 bonus.
//
// AUDIO FEATURES (all 0–1 except tempo):
//   energy           — intensity and activity (0=calm, 1=loud/fast)
//   danceability     — how suitable for dancing
//   valence          — musical positivity (0=sad/angry, 1=happy/euphoric)
//   tempo            — BPM, normalised to 0–1 (60–200 BPM range)
//   acousticness     — probability of being acoustic
//   instrumentalness — probability of no vocals
//   speechiness      — presence of spoken words

const swipeRepository = require("../repositories/swipeRepository");

const FEATURE_KEYS = [
  "energy", "danceability", "valence",
  "tempo", "acousticness", "instrumentalness", "speechiness",
];

function normaliseTempo(bpm) {
  if (!bpm) return 0.5;
  return Math.max(0, Math.min(1, (bpm - 60) / 140));
}

function toVector(features) {
  if (!features) return null;
  const v = FEATURE_KEYS.map(k => {
    const val = features[k];
    if (val == null) return null;
    return k === "tempo" ? normaliseTempo(val) : val;
  });
  if (v.filter(x => x == null).length > 3) return null;
  return v.map(x => x ?? 0.5);
}

function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

function magnitude(v) {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

function cosineSimilarity(a, b) {
  const magA = magnitude(a), magB = magnitude(b);
  if (!magA || !magB) return 0;
  return dotProduct(a, b) / (magA * magB);
}

function addVectors(a, b) {
  return a.map((x, i) => x + b[i]);
}

function scaleVector(v, scalar) {
  return v.map(x => x * scalar);
}

function normaliseVector(v) {
  const mag = magnitude(v);
  if (!mag) return v;
  return v.map(x => x / mag);
}

async function buildTasteProfile(userId) {
  const swipes = await swipeRepository.findByUser(userId, {
    where: { direction: "right" },
    include: { song: true },
  });

  if (!swipes.length) return null;

  const zero = new Array(FEATURE_KEYS.length).fill(0);
  let likeVec = [...zero];
  let likeCount = 0;
  const likedGenres = {};

  for (const swipe of swipes) {
    const features = swipe.song?.features;
    if (!features) continue;
    const vec = toVector(features);
    if (!vec) continue;

    likeVec = addVectors(likeVec, vec);
    likeCount++;
    const g = swipe.song.genre;
    if (g) likedGenres[g] = (likedGenres[g] || 0) + 1;
  }

  if (!likeCount) return null;

  const normLike = normaliseVector(scaleVector(likeVec, 1 / likeCount));

  return {
    vector: normLike,
    likedGenres,
    likeCount,
  };
}

function rankBySimilarity(songs, tasteProfile) {
  if (!tasteProfile) return songs;

  const { vector: tasteVec, likedGenres } = tasteProfile;

  const scored = songs.map(song => {
    const vec = toVector(song.features);
    let score = 0;

    if (vec) {
      score = cosineSimilarity(tasteVec, vec);
      if (likedGenres[song.genre] > 0) score += 0.15;
    }

    return { song, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.song);
}

async function getRecentLikedTrackIds(userId, limit = 5) {
  const swipes = await swipeRepository.findByUser(userId, {
    where: { direction: "right" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { songId: true },
  });
  return swipes.map(s => s.songId);
}

module.exports = {
  buildTasteProfile,
  rankBySimilarity,
  getRecentLikedTrackIds,
};
