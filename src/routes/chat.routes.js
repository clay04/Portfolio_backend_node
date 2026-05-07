const express = require("express");
const {
  sendMessage,
  streamMessage,
  getHistory,
  getStats,
} = require("../controllers/chat.controller");
const { sessionManager } = require("../middlewares/session.middleware");
const { ipRateLimit } = require("../middlewares/rateLimit.middleware");

const router = express.Router();

router.use(sessionManager);

// POST /api/v1/chat              ← Non-streaming (fallback)
router.post("/", ipRateLimit, sendMessage);

// POST /api/v1/chat/stream       ← Streaming SSE ✅
router.post("/stream", ipRateLimit, streamMessage);

// GET /api/v1/chat/history/:id   ← History percakapan
router.get("/history/:sessionId", getHistory);

// GET /api/v1/chat/stats         ← Monitoring
router.get("/stats", getStats);

module.exports = router;