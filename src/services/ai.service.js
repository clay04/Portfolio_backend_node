const axios = require("axios");

const aiClient = axios.create({
  baseURL: process.env.FASTAPI_URL,
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": process.env.FASTAPI_INTERNAL_KEY,
  },
  timeout: 60000,
});

// ── Non-streaming (tetap ada) ─────────────────────────────────────────────────
const askAI = async (question) => {
  const response = await aiClient.post("/v1/chat-cv", { question });
  return {
    answer: response.data.answer,
    sourceDocuments: response.data.source_documents,
  };
};

// ── Streaming: pipe SSE dari FastAPI ke Express response ─────────────────────
const streamAI = async (question, res) => {
  /**
   * Axios responseType "stream" membuat Axios tidak buffer response —
   * data langsung mengalir dari FastAPI ke client Next.js lewat Node.js.
   */
  const response = await aiClient.post(
    "/v1/chat-cv/stream",
    { question },
    { responseType: "stream" }
  );

  // Set header SSE ke client
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders(); // Kirim header segera

  // Pipe stream dari FastAPI langsung ke response Express
  response.data.pipe(res);

  // Cleanup saat client disconnect
  res.on("close", () => {
    response.data.destroy();
  });
};

module.exports = { askAI, streamAI };