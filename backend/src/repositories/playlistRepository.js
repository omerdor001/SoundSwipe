// src/repositories/playlistRepository.js
const prisma = require("../database/prisma");

async function findByUser(userId) {
  return prisma.playlistSong.findMany({
    where: { userId },
    include: { song: true },
    orderBy: { addedAt: "asc" },
  });
}

async function upsert(userId, songId) {
  return prisma.playlistSong.upsert({
    where: { userId_songId: { userId, songId } },
    update: {},
    create: { userId, songId },
  });
}

async function deleteByUserAndSong(userId, songId) {
  return prisma.playlistSong.delete({
    where: { userId_songId: { userId, songId } },
  }).catch(() => null);
}

module.exports = {
  findByUser,
  upsert,
  deleteByUserAndSong,
};
