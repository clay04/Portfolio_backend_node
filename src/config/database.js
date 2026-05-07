const { PrismaClient } = require("@prisma/client");
const mongoose = require("mongoose");

// ── PostgreSQL via Prisma (Stats & Metadata) ──────────────────────────────────
const prisma = new PrismaClient();

const connectPostgres = async () => {
  try {
    await prisma.$connect();
    console.log("✅  PostgreSQL (Supabase) terhubung.");
  } catch (error) {
    console.error("❌  Gagal koneksi PostgreSQL:", error.message);
    process.exit(1);
  }
};

// ── MongoDB via Mongoose (Chat History) ──────────────────────────────────────
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  MongoDB (Atlas) terhubung.");
  } catch (error) {
    console.error("❌  Gagal koneksi MongoDB:", error.message);
    process.exit(1);
  }
};

const connectDatabases = async () => {
  await connectPostgres();
  await connectMongo();
};

module.exports = { prisma, connectDatabases };
