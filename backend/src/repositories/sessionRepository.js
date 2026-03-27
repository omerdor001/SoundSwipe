// src/repositories/sessionRepository.js
const prisma = require("../database/prisma");

async function findByToken(token) {
  return prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
}

async function create(data) {
  return prisma.session.create({ data });
}

async function deleteByToken(token) {
  return prisma.session.deleteMany({ where: { token } });
}

async function deleteExpired() {
  return prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

module.exports = {
  findByToken,
  create,
  deleteByToken,
  deleteExpired,
};
