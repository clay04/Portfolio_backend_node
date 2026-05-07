const { prisma } = require("../config/database");

const DAILY_LIMIT = parseInt(process.env.RATE_LIMIT_MAX || "50");

/**
 * Middleware: ipRateLimit
 *
 * Batasi satu IP hanya bisa mengirim maksimal 50 pesan per hari.
 * Hitungan disimpan di PostgreSQL (tabel DailyIpStat) menggunakan IP yang sudah di-hash.
 * Reset otomatis setiap hari karena key-nya pakai tanggal.
 */
const ipRateLimit = async (req, res, next) => {
  try {
    const ipHash = req.ipHash;
    const today = new Date().toISOString().split("T")[0]; // "2025-01-15"

    // Upsert: cari record IP+tanggal hari ini, kalau tidak ada buat baru
    const stat = await prisma.dailyIpStat.upsert({
      where: {
        ipHash_date: { ipHash, date: today }, // @@unique constraint
      },
      update: {
        messageCount: { increment: 1 },
      },
      create: {
        ipHash,
        date: today,
        messageCount: 1,
      },
    });

    // Cek apakah sudah melebihi batas
    if (stat.messageCount > DAILY_LIMIT) {
      return res.status(429).json({
        status: "error",
        message: `Batas harian tercapai (${DAILY_LIMIT} pesan/hari). Coba lagi besok.`,
        remaining: 0,
      });
    }

    // Tambahkan info sisa kuota ke response header
    res.setHeader("X-RateLimit-Limit", DAILY_LIMIT);
    res.setHeader("X-RateLimit-Remaining", DAILY_LIMIT - stat.messageCount);

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { ipRateLimit };
