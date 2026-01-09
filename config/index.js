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
    defaultMessage: "🙏 Welcome to Supra Travels! How can I help you today?\n\n📍 Bangalore ⇄ Hosadurga daily service\n🎫 Book online: supratravels.gt.tc\n📞 Call: +91 96860 20017",
    keywords: {
      'hi': "🙏 Welcome to Supra Travels! How can I help you?\n\n🚌 Bus Booking\n🚗 Vehicle Rental\n🏖️ Tour Packages\n\nReply with your query or visit: supratravels.gt.tc",
      'hello': "🙏 Welcome to Supra Travels! How can I help you?\n\n🚌 Bus Booking\n🚗 Vehicle Rental\n🏖️ Tour Packages\n\nReply with your query or visit: supratravels.gt.tc",
      'hey': "🙏 Hello! Welcome to Supra Travels! How can I assist you today?",
      'book': "🎫 To book a bus ticket:\n\n1️⃣ Visit: supratravels.gt.tc/booking.php\n2️⃣ Select route & date\n3️⃣ Choose your seat\n4️⃣ Pay online\n\n💰 Special Offer: ₹999 Round-trip pass!\n\n📞 Need help? Call: +91 96860 20017",
      'booking': "🎫 To book a bus ticket:\n\n1️⃣ Visit: supratravels.gt.tc/booking.php\n2️⃣ Select route & date\n3️⃣ Choose your seat\n4️⃣ Pay online\n\n💰 Special Offer: ₹999 Round-trip pass!\n\n📞 Need help? Call: +91 96860 20017",
      'ticket': "🎫 Book your bus ticket online!\n\n🚌 Route: Bangalore ⇄ Hosadurga (via Hiriyur)\n💰 Round-trip: Just ₹999!\n\n🌐 Book now: supratravels.gt.tc/booking.php",
      'price': "💰 Our Pricing:\n\n🚌 Bus (Bangalore-Hosadurga):\n• One-way: Check website\n• Round-trip: ₹999 Special Offer!\n\n🚗 Vehicle Rental:\n• Get quote: supratravels.gt.tc/quote.html\n\n📞 Call: +91 96860 20017",
      'rate': "💰 Our Pricing:\n\n🚌 Bus (Bangalore-Hosadurga):\n• One-way: Check website\n• Round-trip: ₹999 Special Offer!\n\n🚗 Vehicle Rental:\n• Get quote: supratravels.gt.tc/quote.html\n\n📞 Call: +91 96860 20017",
      'route': "🛣️ Our Bus Routes:\n\n📍 Bangalore ⇄ Hosadurga\n(via Hiriyur)\n\n⏰ Daily service available\n💰 Round-trip: ₹999 only!\n\n🌐 Book: supratravels.gt.tc",
      'package': "🏖️ Tour Packages:\n\n• Coorg - 3D/2N\n• Hampi Heritage - 2D/1N\n• Chikmagalur - 2D/1N\n• Tirupati Darshan - Custom\n• Dharmasthala & Kukke - 2D/1N\n\n📞 Enquire: +91 96860 20017\n🌐 supratravels.gt.tc/packages.php",
      'packages': "🏖️ Tour Packages:\n\n• Coorg - 3D/2N\n• Hampi Heritage - 2D/1N\n• Chikmagalur - 2D/1N\n• Tirupati Darshan - Custom\n• Dharmasthala & Kukke - 2D/1N\n\n📞 Enquire: +91 96860 20017\n🌐 supratravels.gt.tc/packages.php",
      'tour': "🏖️ Tour Packages:\n\n• Coorg - 3D/2N\n• Hampi Heritage - 2D/1N\n• Chikmagalur - 2D/1N\n• Tirupati Darshan - Custom\n• Dharmasthala & Kukke - 2D/1N\n\n📞 Enquire: +91 96860 20017",
      'rental': "🚗 Vehicle Rentals:\n\n• Mini Bus: 17-32 Seater\n• Tempo Traveler: 12-17 Seater\n• Luxury Coaches\n\n📝 Get Quote: supratravels.gt.tc/quote.html\n📞 Call: +91 96860 20017",
      'bus': "🚌 Bus Service:\n\n📍 Bangalore ⇄ Hosadurga (via Hiriyur)\n⏰ Daily service\n💰 Round-trip: ₹999 only!\n\n🎫 Book online: supratravels.gt.tc/booking.php",
      'contact': "📞 Contact Supra Travels:\n\n☎️ Phone: +91 96860 20017\n📧 Email: info@supratravels.in\n📍 Hosadurga, Karnataka - 577527\n🌐 supratravels.gt.tc\n\nWe're here to help! 🙏",
      'address': "📍 Our Address:\n\nSupra Tour and Travels Pvt Ltd\nHosadurga, Chitradurga District\nKarnataka - 577527\n\n📞 +91 96860 20017",
      'help': "🙏 How can I help you?\n\n🚌 Bus Booking - type 'book'\n💰 Prices - type 'price'\n🛣️ Routes - type 'route'\n🏖️ Packages - type 'package'\n🚗 Rental - type 'rental'\n📞 Contact - type 'contact'\n\n🌐 supratravels.gt.tc",
      'thanks': "🙏 Thank you for choosing Supra Travels! Safe travels! 🚌",
      'thank you': "🙏 Thank you for choosing Supra Travels! Safe travels! 🚌",
      'ok': null,
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
