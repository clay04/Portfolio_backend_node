require("dotenv").config();

// ── 1. Validasi ENV sebelum apapun ───────────────────────────────────────────
const validateEnv = require("./config/validateEnv");
validateEnv();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const { prisma, connectDatabases } = require("./config/database");
const { checkFastAPI } = require("./config/checkServices");
const logger = require("./config/logger");
const chatRoutes = require("./routes/chat.routes");
const { errorHandler } = require("./middlewares/error.middleware");

const app = express();

// ── 2. Security & Utility Middlewares ─────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  exposedHeaders: ["X-Session-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
}));
app.use(express.json());

// Morgan → teruskan ke Winston logger
app.use(morgan("combined", {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── 3. General Rate Limiter (anti HTTP spam) ──────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 30,
  message: { status: "error", message: "Terlalu banyak request. Tunggu sebentar." },
});
app.use("/api", generalLimiter);

// ── 4. Routes ─────────────────────────────────────────────────────────────────
app.use("/api/v1/chat", chatRoutes);

// ── 5. Health Check ───────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Node.js Backend — Clay Mangeber Portfolio",
    timestamp: new Date().toISOString(),
  });
});

// ── 6. 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Endpoint tidak ditemukan." });
});

// ── 7. Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ── 8. Graceful Shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} diterima. Menutup server...`);
  await prisma.$disconnect();
  await mongoose.disconnect();
  logger.info("Semua koneksi database ditutup. Server berhenti.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT")); // Ctrl+C

// ── 9. Start Server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDatabases();    // Koneksi PostgreSQL & MongoDB
  await checkFastAPI();        // Cek FastAPI (warn jika tidak jalan)

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀  Server berjalan di http://localhost:${PORT}`);
    logger.info(`📋  Environment: ${process.env.NODE_ENV}`);
  });
};

start();