// src/repositories/userRepository.js
const prisma = require("../database/prisma");

async function findById(id) {
  return prisma.user.findUnique({ where: { id } });
}

async function findByUsername(username) {
  return prisma.user.findUnique({ where: { username } });
}

async function findBySpotifyId(spotifyId) {
  return prisma.user.findFirst({ where: { spotifyId } });
}

async function create(data) {
  return prisma.user.create({ data });
}

async function update(id, data) {
  return prisma.user.update({ where: { id }, data });
}

module.exports = {
  findById,
  findByUsername,
  findBySpotifyId,
  create,
  update,
};
