const axios = require("axios");

const checkFastAPI = async () => {
  try {
    await axios.get(`${process.env.FASTAPI_URL}/v1/health`, {
      timeout: 5000,
    });
    console.log("✅  FastAPI AI Engine terhubung.");
  } catch {
    console.warn(
      "⚠️   FastAPI tidak merespons. Endpoint /v1/chat akan error sampai AI Engine dijalankan."
    );
    // Tidak exit — Node.js tetap jalan, hanya beri peringatan
  }
};

module.exports = { checkFastAPI };
