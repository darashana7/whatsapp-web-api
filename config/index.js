require('dotenv').config();

module.exports = {
  // Server
  port: process.env.PORT || 3000,

  // API Security
  apiKey: process.env.API_KEY || null,

  // Phone Configuration
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '91',

  // Auto-Reply Configuration
  autoReply: {
    enabled: process.env.AUTO_REPLY_ENABLED !== 'false',
    cooldown: parseInt(process.env.AUTO_REPLY_COOLDOWN) || 5, // seconds (reduced for faster replies)
    defaultMessage: "Thanks for your message! We'll get back to you soon. 🙏",
    keywords: {
      'hi': "Hello! 👋 How can I help you today?",
      'hello': "Hello! 👋 How can I help you today?",
      'hey': "Hey there! 👋 How can I help you?",
      'help': "Here's how I can help:\n• Send 'info' for more information\n• Send 'contact' for contact details\n• Or just type your question!",
      'info': "Thanks for your interest! Our team will reach out to you shortly with more details.",
      'contact': "You can reach us at:\n📧 Email: contact@example.com\n📞 Phone: +91-XXXXXXXXXX",
      'thanks': "You're welcome! 😊 Let us know if you need anything else.",
      'thank you': "You're welcome! 😊 Let us know if you need anything else.",
      'bye': "Goodbye! 👋 Have a great day!",
      'ok': null, // No auto-reply for acknowledgements
      'okay': null,
      'yes': null,
      'no': null
    }
  },

  // MongoDB (for Railway session persistence)
  mongoUri: process.env.MONGODB_URI || null,

  // Puppeteer
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
};
