const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sourceDocuments: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// TTL Index: hapus pesan otomatis setelah 30 hari
// MongoDB akan otomatis cek dan hapus dokumen yang sudah kadaluarsa
chatMessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 hari
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);