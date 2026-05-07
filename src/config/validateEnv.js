const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "MONGO_URI",
  "FASTAPI_URL",
  "FASTAPI_INTERNAL_KEY",
  "CLIENT_URL",
  "IP_HASH_SECRET",
];

const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("❌  Missing environment variables:", missing.join(", "));
    console.error("    Pastikan semua variabel sudah diisi di file .env");
    process.exit(1);
  }
  console.log("✅  Environment variables valid.");
};

module.exports = validateEnv;