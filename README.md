# WhatsApp Web API with Auto-Reply

A Node.js-based WhatsApp Web API that automatically replies to incoming messages. Designed for deployment on Railway.

## Features

- 📱 **WhatsApp Web Integration** - Uses whatsapp-web.js for reliable messaging
- 🤖 **Auto-Reply System** - Keyword-based automatic responses with cooldown
- 🔌 **REST API** - Send messages, configure bot via HTTP endpoints
- 🚀 **Railway Ready** - Docker-based deployment with health checks
- 🔐 **API Security** - Optional API key authentication

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Start the server:**
   ```bash
   npm run dev
   ```

4. **Scan QR Code:**
   - Open http://localhost:3000/api/qr?format=html
   - Scan the QR code with WhatsApp on your phone
   - Go to WhatsApp → Settings → Linked Devices → Link a Device

5. **Test sending a message:**
   ```bash
   curl -X POST http://localhost:3000/api/send \
     -H "Content-Type: application/json" \
     -d '{"phone": "9876543210", "message": "Hello from API!"}'
   ```

## API Endpoints

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (for Railway) |
| `/api/status` | GET | WhatsApp connection status |
| `/api/qr` | GET | Get QR code for authentication |
| `/api/qr?format=html` | GET | QR code page (human-friendly) |

### Messaging

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/send` | POST | Send message to single recipient |
| `/api/send-bulk` | POST | Send message to multiple recipients |

**Send Message Request:**
```json
{
  "phone": "9876543210",
  "message": "Hello!"
}
```

**Bulk Send Request:**
```json
{
  "phones": ["9876543210", "9898989898"],
  "message": "Hello everyone!"
}
```

### Auto-Reply Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auto-reply` | GET | Get current auto-reply config |
| `/api/auto-reply` | PUT | Update auto-reply settings |
| `/api/auto-reply/keyword` | POST | Add/update a keyword |
| `/api/auto-reply/keyword/:keyword` | DELETE | Remove a keyword |

**Update Auto-Reply:**
```json
{
  "enabled": true,
  "defaultMessage": "Thanks for your message!",
  "cooldown": 60
}
```

**Add Keyword:**
```json
{
  "keyword": "pricing",
  "reply": "Check our pricing at https://example.com/pricing"
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `API_KEY` | Optional authentication key | - |
| `DEFAULT_COUNTRY_CODE` | For phone normalization | `91` |
| `AUTO_REPLY_ENABLED` | Enable auto-reply | `true` |
| `AUTO_REPLY_COOLDOWN` | Seconds between replies | `60` |
| `PUPPETEER_EXECUTABLE_PATH` | Chrome path (for Docker) | - |

## Railway Deployment

1. **Create a new Railway project**

2. **Connect your GitHub repository**

3. **Set environment variables:**
   - `AUTO_REPLY_ENABLED=true`
   - `API_KEY=your-secret-key` (optional)

4. **Deploy!** Railway will use the Dockerfile automatically.

5. **Get QR Code:**
   - Visit `https://your-app.railway.app/api/qr?format=html`
   - Or check Railway logs for terminal QR code

6. **Scan with WhatsApp mobile app**

## Default Auto-Reply Keywords

| Keyword | Response |
|---------|----------|
| `hi`, `hello`, `hey` | Hello! 👋 How can I help you today? |
| `help` | Available commands list |
| `info` | More information coming soon |
| `contact` | Contact details |
| `thanks` | You're welcome! |
| `bye` | Goodbye! |

❌ No auto-reply for: `ok`, `okay`, `yes`, `no` (acknowledgement words)

## Important Notes

⚠️ **Session Persistence:** On Railway, the session may be lost on redeploy. You'll need to scan the QR code again after each deployment.

💡 **Tip:** For production, consider using MongoDB for session storage (RemoteAuth strategy).

📱 **Rate Limits:** WhatsApp may block accounts that send too many messages. Use responsibly.

## License

MIT
