// src/middleware/auth.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function getClientIp(req) {
  let ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() 
    || req.headers["x-real-ip"]
    || req.connection?.remoteAddress
    || "unknown";
  
  // Normalize IPv4-mapped IPv6 to regular IPv4
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  
  return ip;
}

module.exports = async function sessionMiddleware(req, res, next) {
  let token = req.cookies?.ss_session;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7);
  }
  
  // Decrypt if encrypted (from sessionStorage)
  if (token && token.includes(":")) {
    const crypto = require("crypto");
    const ENCRYPTION_KEY = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");
    try {
      const parts = token.split(":");
      if (parts.length === 2) {
        const iv = Buffer.from(parts[0], "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
        let decrypted = decipher.update(parts[1], "hex", "utf8");
        decrypted += decipher.final("utf8");
        token = decrypted;
      }
    } catch {}
  }
  
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

    const clientIp = getClientIp(req);
    
    // Only enforce IP check in production (not localhost)
    const isLocalhost = ip => ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
    if (session.ipAddress && !isLocalhost(session.ipAddress) && !isLocalhost(clientIp)) {
      if (session.ipAddress !== clientIp) {
        await prisma.session.delete({ where: { id: session.id } });
        return res.status(401).json({ error: "Session invalid" });
      }
    }

    req.user = { id: session.user.id, username: session.user.username };
    next();
  } catch (err) {
    console.error("Session middleware error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};