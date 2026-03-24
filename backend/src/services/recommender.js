// src/services/recommender.js
//
// Content-Based Filtering (CBF) recommendation engine.
//
// WHY CBF FOR SOUNDSWIPE:
//   - Works from user #1, day #1 (no cold-start problem)
//   - Spotify gives us 7 audio features per track, making CBF very accurate
//   - Collaborative Filtering (CF) needs hundreds of users with overlapping swipes
//   - Matrix Factorization (SVD/ALS) is CF under the hood — same cold-start issue
//   - Neural approaches need tens of thousands of training examples + GPU infra
//   - Hybrid (CBF + CF) is the right LONG-TERM architecture — migrate when you
//     have 500+ active users each with 100+ swipes
//
// HOW IT WORKS:
//   1. For each right-swipe (like), we add the song's audio feature vector to a
//      running "like profile".
//   2. For each left-swipe (skip), we add to a "dislike profile".
//   3. The taste vector = normalised(like profile) - 0.3 * normalised(dislike profile)
//   4. Candidate songs are scored by cosine similarity to the taste vector.
//   5. Songs are re-ranked: liked-genre songs get a +0.15 bonus.
//
// AUDIO FEATURES (all 0–1 except tempo):
//   energy           — intensity and activity (0=calm, 1=loud/fast)
//   danceability     — how suitable for dancing
//   valence          — musical positivity (0=sad/angry, 1=happy/euphoric)
//   tempo            — BPM, normalised to 0–1 (60–200 BPM range)
//   acousticness     — probability of being acoustic
//   instrumentalness — probability of no vocals
//   speechiness      — presence of spoken words

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const FEATURE_KEYS = [
  "energy", "danceability", "valence",
  "tempo", "acousticness", "instrumentalness", "speechiness",
];

// Normalise tempo from BPM range [60–200] to [0–1]
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
  // If more than half the features are missing, skip this track
  if (v.filter(x => x == null).length > 3) return null;
  return v.map(x => x ?? 0.5); // fill remaining nulls with neutral 0.5
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

/**
 * Build a taste profile vector from a user's swipe history.
 * Returns null if the user has no swipes with audio features yet.
 */
async function buildTasteProfile(userId) {
  // Fetch all swipes with song data + audio features
  const swipes = await prisma.swipe.findMany({
    where:   { userId },
    include: { song: true },
  });

  if (!swipes.length) return null;

  const zero = new Array(FEATURE_KEYS.length).fill(0);
  let likeVec    = [...zero];
  let dislikeVec = [...zero];
  let likeCount    = 0;
  let dislikeCount = 0;
  const likedGenres  = {};
  const dislikedGenres = {};

  for (const swipe of swipes) {
    const features = swipe.song?.features;
    if (!features) continue;
    const vec = toVector(features);
    if (!vec) continue;

    if (swipe.direction === "right") {
      likeVec = addVectors(likeVec, vec);
      likeCount++;
      const g = swipe.song.genre;
      if (g) likedGenres[g] = (likedGenres[g] || 0) + 1;
    } else {
      dislikeVec = addVectors(dislikeVec, vec);
      dislikeCount++;
      const g = swipe.song.genre;
      if (g) dislikedGenres[g] = (dislikedGenres[g] || 0) + 1;
    }
  }

  if (!likeCount) return null;

  // Average the vectors, then compute taste = likes - 0.3 * dislikes
  const normLike    = normaliseVector(scaleVector(likeVec,    1 / likeCount));
  const normDislike = dislikeCount
    ? normaliseVector(scaleVector(dislikeVec, 1 / dislikeCount))
    : zero;

  const tasteVec = normaliseVector(
    addVectors(normLike, scaleVector(normDislike, -0.3))
  );

  return {
    vector:        tasteVec,
    likedGenres,
    dislikedGenres,
    likeCount,
    dislikeCount,
  };
}

/**
 * Re-rank a list of candidate songs by cosine similarity to the user's taste profile.
 * Songs without audio features are pushed to the end.
 * Returns the re-ranked list.
 */
function rankBySimilarity(songs, tasteProfile) {
  if (!tasteProfile) return songs; // No profile yet → return as-is

  const { vector: tasteVec, likedGenres } = tasteProfile;

  const scored = songs.map(song => {
    const vec = toVector(song.features);
    let score = 0;

    if (vec) {
      score = cosineSimilarity(tasteVec, vec);
      // Genre affinity bonus: +0.15 if this genre has been liked before
      if (likedGenres[song.genre] > 0) score += 0.15;
    }

    return { song, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.song);
}

/**
 * Get the top N genres from the user's like history (for Spotify seed_genres).
 */
async function getTopLikedGenres(userId, limit = 3) {
  const swipes = await prisma.swipe.findMany({
    where:   { userId, direction: "right" },
    include: { song: { select: { genre: true } } },
  });

  const counts = {};
  for (const s of swipes) {
    const g = s.song?.genre?.toLowerCase();
    if (g && g !== "unknown") counts[g] = (counts[g] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
}

/**
 * Get the Spotify IDs of the user's most recently liked songs (for seed_tracks).
 */
async function getRecentLikedTrackIds(userId, limit = 5) {
  const swipes = await prisma.swipe.findMany({
    where:   { userId, direction: "right" },
    orderBy: { createdAt: "desc" },
    take:    limit,
    select:  { songId: true },
  });
  return swipes.map(s => s.songId);
}

module.exports = {
  buildTasteProfile,
  rankBySimilarity,
  getTopLikedGenres,
  getRecentLikedTrackIds,
};
