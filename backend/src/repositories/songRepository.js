// src/repositories/songRepository.js
const prisma = require("../database/prisma");

async function findById(id) {
  return prisma.song.findUnique({ where: { id } });
}

async function upsert(data) {
  return prisma.song.upsert({
    where: { id: data.id },
    update: {},
    create: data,
  });
}

module.exports = {
  findById,
  upsert,
};
