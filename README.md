# Webhook Relay Example

A lightweight webhook relay system that eliminates the friction of local webhook development. Instead of juggling ngrok URLs and constantly reconfiguring endpoints, this relay provides a stable WebSocket-based solution for teams.

## The Problem

Local webhook development typically involves:
- Multiple developers fighting over tunnel URLs
- Constantly updating webhook endpoints when ngrok restarts
- Fragile setups that break during development
- Manual reconfiguration every time you restart your machine

## The Solution

This webhook relay consists of:

1. **Webhook Relay Server** - A Cloudflare Worker that receives webhooks and broadcasts them via WebSocket
2. **Local Client** - A development script that connects to the relay and forwards webhooks to your local server

## Quick Start

### 1. Deploy the Relay Server

```bash
cd webhook-relay
npm install
npx wrangler deploy
```

Add your WebSocket token:
```bash
npx wrangler secret put WEBSOCKET_TOKEN
# Enter: your_shared_token
```

### 2. Set Up the Client

Copy `example-app/scripts/webhook-relay-client.ts` to your project and install dependencies:

```bash
npm install ws reconnecting-websocket
npm install -D @types/ws
```

### 3. Configure Environment Variables

```bash
WEBSOCKET_TOKEN=your_shared_token
WEBHOOK_RELAY_URL=wss://your-worker.your-subdomain.workers.dev/_websocket
API_SERVICE_URL=http://localhost:8787  # Your local server
AI_SERVICE_URL=http://localhost:8788  #  Optional
```

### 4. Run the Client

```bash
# In one terminal
npm run dev  # Your usual development server

# In another terminal
npx tsx scripts/webhook-relay-client.ts
```

## How It Works

1. External services send webhooks to your deployed relay URL
2. The relay broadcasts webhook data to connected WebSocket clients
3. Your local client receives the data and forwards it to your development server
4. No more tunnel URLs or manual endpoint updates

## Benefits

- **Stable URLs** - One relay URL for your entire team
- **Zero Reconfiguration** - Works across machine restarts and network changes
- **Team Friendly** - Multiple developers can test simultaneously
- **Lightweight** - Simple WebSocket relay with minimal overhead
- **Customizable** - Easy to extend for specific routing or filtering needs

## Project Structure

- `webhook-relay/` - Cloudflare Worker that acts as the relay server
- `example-app/` - Example application with the relay client script

## Read More

For a detailed explanation of the problem and solution, see  [here](https://agentuity.com/blog/legacy-dev-tools-are-dead-weight-in-the-personal-software-era) or [ARTICLE.md](./ARTICLE.md) .

## License

MIT
