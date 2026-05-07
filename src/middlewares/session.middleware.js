const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { prisma } = require("../config/database");

/**
 * Hash IP address dengan HMAC-SHA256 + secret.
 * Hasilnya konsisten (IP yang sama selalu menghasilkan hash yang sama),
 * tapi tidak bisa di-decode balik → privasi terjaga.
 */
const hashIp = (ip) => {
  return crypto
    .createHmac("sha256", process.env.IP_HASH_SECRET || "default-secret")
    .update(ip)
    .digest("hex");
};

/**
 * Deteksi tipe device dari User-Agent string.
 */
const getDeviceType = (userAgent = "") => {
  const ua = userAgent.toLowerCase();
  return /mobile|android|iphone|ipad|tablet/.test(ua) ? "mobile" : "desktop";
};

/**
 * Middleware: sessionManager
 *
 * Tugas:
 * 1. Baca sessionId dari header X-Session-ID (dikirim frontend).
 *    Kalau tidak ada → buat UUID baru.
 * 2. Hash IP address untuk keperluan rate limiting.
 * 3. Attach semua info ke req agar bisa dipakai controller.
 * 4. Kalau sesi baru → simpan metadata ke PostgreSQL.
 */
const sessionManager = async (req, res, next) => {
  try {
    // 1. Session ID — dari header atau buat baru
    const sessionId = req.headers["x-session-id"] || uuidv4();
    const isNewSession = !req.headers["x-session-id"];

    // 2. IP & hashing
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    const ipHash = hashIp(rawIp);

    // 3. User Agent & device type
    const userAgent = req.headers["user-agent"] || "unknown";
    const deviceType = getDeviceType(userAgent);

    // 4. Attach ke request
    req.sessionId = sessionId;
    req.ipHash = ipHash;
    req.userAgent = userAgent;
    req.deviceType = deviceType;

    // 5. Kalau sesi baru → simpan metadata ke PostgreSQL (upsert aman)
    if (isNewSession) {
      await prisma.chatSession.upsert({
        where: { id: sessionId },
        update: {},
        create: {
          id: sessionId,
          ipHash,
          userAgent,
          deviceType,
        },
      });
    }

    // 6. Kirim sessionId ke frontend lewat response header
    res.setHeader("X-Session-ID", sessionId);

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { sessionManager, hashIp };
