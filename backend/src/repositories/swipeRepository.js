// src/repositories/swipeRepository.js
const prisma = require("../database/prisma");

async function findByUserAndSong(userId, songId) {
  return prisma.swipe.findUnique({
    where: { userId_songId: { userId, songId } },
  });
}

async function upsert(userId, songId, direction) {
  return prisma.swipe.upsert({
    where: { userId_songId: { userId, songId } },
    update: { direction },
    create: { userId, songId, direction },
  });
}

async function findByUser(userId, options = {}) {
  return prisma.swipe.findMany({
    where: { userId },
    include: options.include || {},
    orderBy: options.orderBy,
    take: options.take,
  });
}

async function deleteByUserAndSong(userId, songId) {
  return prisma.swipe.delete({
    where: { userId_songId: { userId, songId } },
  }).catch(() => null);
}

async function deleteAllByUser(userId) {
  return prisma.swipe.deleteMany({ where: { userId } });
}

async function deleteOldUnliked(months = 1) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return prisma.swipe.deleteMany({
    where: {
      direction: "left",
      createdAt: { lt: cutoff },
    },
  });
}

module.exports = {
  findByUserAndSong,
  upsert,
  findByUser,
  deleteByUserAndSong,
  deleteAllByUser,
  deleteOldUnliked,
};
