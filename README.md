# 🔗 Node.js Backend — Clay Mangeber Public Portfolio

Backend publik tanpa login. Siapapun bisa chat langsung dengan AI.

---

## 🗂️ Struktur Folder

```
node-backend/
├── prisma/
│   └── schema.prisma            ← ChatSession, DailyIpStat, DailyStat
├── src/
│   ├── config/
│   │   └── database.js          ← Koneksi PostgreSQL & MongoDB
│   ├── controllers/
│   │   └── chat.controller.js   ← sendMessage, getHistory, getStats
│   ├── middlewares/
│   │   ├── session.middleware.js ← UUID session + IP hash + device detect
│   │   ├── rateLimit.middleware.js ← 50 pesan/hari per IP
│   │   └── error.middleware.js  ← Global error handler
│   ├── models/
│   │   └── chatMessage.model.js ← MongoDB schema
│   ├── routes/
│   │   └── chat.routes.js       ← /api/v1/chat/*
│   └── app.js                   ← Entry point Express
├── .env.example
└── package.json
```

---

## ⚡ Setup

```bash
npm install
cp .env.example .env
# Isi semua nilai di .env

npx prisma migrate dev --name init
npx prisma generate

npm run dev
```

---

## 📡 Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/chat` | Kirim pertanyaan ke AI (rate limited) |
| GET | `/api/v1/chat/history/:sessionId` | Ambil history sesi |
| GET | `/api/v1/chat/stats` | Statistik & insight harian |

---

## 🔄 Cara Kerja Session (Tanpa Login)

```
User buka web (pertama kali)
  ↓
Frontend buat UUID → simpan di localStorage
  ↓
Setiap request kirim: Header X-Session-ID: "uuid-ini"
  ↓
Backend simpan metadata sesi ke PostgreSQL
  ↓
Chat history disimpan di MongoDB pakai sessionId yang sama
  ↓
User tutup & buka lagi → kirim sessionId yang sama → history muncul lagi
```

## 🛡️ Cara Kerja Rate Limiting

```
IP "192.168.1.1" → hash → "a3f9bc..." (tidak bisa di-decode balik)
    ↓
DailyIpStat: { ipHash: "a3f9bc...", date: "2025-01-15", count: 23 }
    ↓
Kalau count > 50 → tolak request dengan HTTP 429
    ↓
Besok → date berubah → count otomatis mulai dari 0 lagi
```

## 🔗 Integrasi dari Next.js

```javascript
// Simpan sessionId di localStorage
let sessionId = localStorage.getItem("sessionId") || null;

const res = await axios.post(
  "http://localhost:5000/api/v1/chat",
  { question: "Apa proyek Clay?" },
  { headers: sessionId ? { "X-Session-ID": sessionId } : {} }
);

// Simpan sessionId dari response header untuk request berikutnya
sessionId = res.headers["x-session-id"];
localStorage.setItem("sessionId", sessionId);

console.log(res.data.message.content); // Jawaban AI
```
