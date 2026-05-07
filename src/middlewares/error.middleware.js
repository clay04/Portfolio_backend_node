const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  // Log error lengkap ke file
  logger.error(err.message, {
    method: req.method,
    path: req.path,
    sessionId: req.sessionId || "none",
    stack: err.stack,
  });

  // Error dari Axios (gagal panggil FastAPI)
  if (err.isAxiosError) {
    const status = err.response?.status || 503;
    const messages = {
      403: "AI Engine menolak request. Cek FASTAPI_INTERNAL_KEY di .env.",
      404: "Endpoint AI Engine tidak ditemukan.",
    };
    return res.status(status).json({
      status: "error",
      message: messages[status] || "AI Engine sedang tidak tersedia. Coba lagi nanti.",
    });
  }

  // Error validasi Joi
  if (err.isJoi) {
    return res.status(422).json({
      status: "error",
      message: err.details[0].message,
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: err.message || "Terjadi kesalahan pada server.",
  });
};

module.exports = { errorHandler };