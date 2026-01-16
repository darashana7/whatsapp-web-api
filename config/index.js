require('dotenv').config();

module.exports = {
  // Server
  port: process.env.PORT || 3000,

  // API Security
  apiKey: process.env.API_KEY || null,

  // Phone Configuration
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '91',

  // Auto-Reply Configuration (simplified - handlers.js manages flow)
  autoReply: {
    enabled: process.env.AUTO_REPLY_ENABLED !== 'false',
    cooldown: parseInt(process.env.AUTO_REPLY_COOLDOWN) || 0,
    defaultMessage: "🙏 Welcome to Supra Travels!\n\nReply with a number:\n1️⃣ Check booking\n2️⃣ Book ticket\n3️⃣ Availability\n4️⃣ Schedule\n5️⃣ Contact\n\n🌐 supratravels.gt.tc"
  },

  // MongoDB (for Railway session persistence)
  mongoUri: process.env.MONGODB_URI || null,

  // Puppeteer
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
};
