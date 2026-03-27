// src/middleware/auth.js
const { PrismaClient } = require("@prisma/client");
const { extractToken } = require("../utils/token");

const prisma = new PrismaClient();

module.exports = async function sessionMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } });
      }
      return res.status(401).json({ error: "Session expired" });
    }

    req.user = { id: session.user.id, username: session.user.username };
    next();
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
};
