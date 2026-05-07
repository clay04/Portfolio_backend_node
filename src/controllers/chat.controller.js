const Joi = require("joi")
const sanitizeHtml = require("sanitize-html")
const axios = require("axios")
const { prisma } = require("../config/database")
const ChatMessage = require("../models/chatMessage.model")
const logger = require("../config/logger")

const chatSchema = Joi.object({
  question: Joi.string().min(3).max(500).required().messages({
    "string.min": "Pertanyaan minimal 3 karakter.",
    "string.max": "Pertanyaan maksimal 500 karakter.",
    "any.required": "Field 'question' wajib diisi.",
  }),
})

// ── Axios client ke FastAPI ───────────────────────────────────────────────────
const aiClient = axios.create({
  baseURL: process.env.FASTAPI_URL,
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": process.env.FASTAPI_INTERNAL_KEY,
  },
  timeout: 60000,
})

// ── Helper: ambil history dari MongoDB (10 pesan terakhir) ────────────────────
const getRecentHistory = async (sessionId) => {
  const messages = await ChatMessage.find({ sessionId })
    .sort({ createdAt: -1 }) // Terbaru dulu
    .limit(10)                // Ambil 10 terakhir
    .select("role content")
  return messages.reverse()  // Balik lagi ke urutan kronologis
}

// ── POST /api/v1/chat (non-streaming) ─────────────────────────────────────────
const sendMessage = async (req, res, next) => {
  try {
    const { error, value } = chatSchema.validate(req.body)
    if (error) return next(Object.assign(error, { isJoi: true }))

    const question = sanitizeHtml(value.question, { allowedTags: [] }).trim()
    const { sessionId, deviceType } = req

    // Ambil history percakapan untuk konteks AI
    const chatHistory = await getRecentHistory(sessionId)

    logger.info("Pertanyaan masuk", { sessionId, question, historyCount: chatHistory.length })

    // Simpan pesan user ke MongoDB
    await ChatMessage.create({ sessionId, role: "user", content: question })

    // Kirim ke FastAPI beserta history
    const response = await aiClient.post("/v1/chat-cv", {
      question,
      chat_history: chatHistory.map((m) => ({ role: m.role, content: m.content })),
    })

    const { answer, source_documents } = response.data

    const assistantMsg = await ChatMessage.create({
      sessionId,
      role: "assistant",
      content: answer,
      sourceDocuments: source_documents,
    })

    updateStats(sessionId, deviceType).catch((e) =>
      logger.error("Gagal update stats", { error: e.message })
    )

    res.json({
      status: "success",
      sessionId,
      message: {
        id: assistantMsg._id,
        role: "assistant",
        content: answer,
        sourceDocuments: source_documents,
        createdAt: assistantMsg.createdAt,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /api/v1/chat/stream (streaming SSE) ──────────────────────────────────
const streamMessage = async (req, res, next) => {
  try {
    const { error, value } = chatSchema.validate(req.body)
    if (error) {
      return res.status(422).json({ status: "error", message: error.details[0].message })
    }

    const question = sanitizeHtml(value.question, { allowedTags: [] }).trim()
    const { sessionId, deviceType } = req

    // Ambil history percakapan untuk konteks AI
    const chatHistory = await getRecentHistory(sessionId)

    logger.info("Stream pertanyaan masuk", { sessionId, question, historyCount: chatHistory.length })

    // Simpan pesan user ke MongoDB
    await ChatMessage.create({ sessionId, role: "user", content: question })

    // Request streaming ke FastAPI (beserta history)
    const response = await aiClient.post(
      "/v1/chat-cv/stream",
      {
        question,
        chat_history: chatHistory.map((m) => ({ role: m.role, content: m.content })),
      },
      { responseType: "stream" }
    )

    // Set SSE headers ke Next.js client
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders()

    // Kumpulkan jawaban lengkap untuk disimpan ke MongoDB
    let fullAnswer = ""
    let sourceDocuments = []

    response.data.on("data", (chunk) => {
      const raw = chunk.toString()

      raw.split("\n").forEach((line) => {
        if (!line.startsWith("data: ")) return
        try {
          const parsed = JSON.parse(line.slice(6))
          if (parsed.type === "sources") sourceDocuments = parsed.data
          else if (parsed.type === "token") fullAnswer += parsed.data.replace(/\\n/g, "\n")
          else if (parsed.type === "done") {
            // Simpan jawaban lengkap ke MongoDB
            ChatMessage.create({
              sessionId,
              role: "assistant",
              content: fullAnswer,
              sourceDocuments,
            }).catch((e) => logger.error("Gagal simpan pesan AI", { error: e.message }))

            updateStats(sessionId, deviceType).catch((e) =>
              logger.error("Gagal update stats", { error: e.message })
            )
          }
        } catch { /* abaikan */ }
      })

      // Teruskan chunk ke Next.js
      res.write(raw)
    })

    response.data.on("end", () => res.end())
    response.data.on("error", (err) => {
      logger.error("Stream error dari FastAPI", { error: err.message })
      res.end()
    })

    res.on("close", () => response.data.destroy())

  } catch (err) {
    logger.error("streamMessage error", { error: err.message })
    if (!res.headersSent) next(err)
    else res.end()
  }
}

// ── GET /api/v1/chat/history/:sessionId ──────────────────────────────────────
const getHistory = async (req, res, next) => {
  try {
    const { sessionId } = req.params
    const session = await prisma.chatSession.findUnique({ where: { id: sessionId } })

    if (!session) {
      return res.status(404).json({ status: "error", message: "Sesi tidak ditemukan." })
    }

    if (session.ipHash !== req.ipHash) {
      return res.status(403).json({ status: "error", message: "Akses ditolak." })
    }

    const messages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: 1 })
      .select("role content sourceDocuments createdAt")

    res.json({ status: "success", sessionId, messages })
  } catch (err) {
    next(err)
  }
}

// ── GET /api/v1/chat/stats ────────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const last7Days = await prisma.dailyStat.findMany({ orderBy: { date: "desc" }, take: 7 })
    const totals = await prisma.dailyStat.aggregate({
      _sum: { totalMessages: true, totalSessions: true, mobileUsers: true, desktopUsers: true },
    })
    res.json({ status: "success", totals: totals._sum, last7Days })
  } catch (err) {
    next(err)
  }
}

// ── Helper: update statistik harian ──────────────────────────────────────────
const updateStats = async (sessionId, deviceType) => {
  const today = new Date().toISOString().split("T")[0]
  await prisma.dailyStat.upsert({
    where: { date: today },
    update: {
      totalMessages: { increment: 1 },
      ...(deviceType === "mobile" ? { mobileUsers: { increment: 1 } } : { desktopUsers: { increment: 1 } }),
    },
    create: {
      date: today, totalMessages: 1, totalSessions: 1,
      mobileUsers: deviceType === "mobile" ? 1 : 0,
      desktopUsers: deviceType === "desktop" ? 1 : 0,
    },
  })
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { messageCount: { increment: 1 } },
  })
}

module.exports = { sendMessage, streamMessage, getHistory, getStats }