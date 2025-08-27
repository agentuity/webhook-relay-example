import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ReconnectingWebSocket from 'reconnecting-websocket';

// Load environment variables from .dev.vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: join(__dirname, '../.dev.vars') });

console.log('Starting webhook relay client...');

interface WebhookEvent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

type Service = {
    name: string;
    hostname: string;
    port?: number;
}

interface Config {
  relayURL: string;
  targetHostnames: {
    api: Service;
    ai: Service;
  };
}

class WebhookRelayClient {
  private ws: ReconnectingWebSocket;
  private config: Config;
  private exiting = false;

  constructor(config: Config) {
    this.config = config;
    this.ws = new ReconnectingWebSocket(this.config.relayURL, [], {});
    this.setupEventListeners();
    this.setupSignalHandlers();
  }

  private setupEventListeners(): void {
    this.ws.addEventListener('open', () => {
      console.log('✅ Connected to relay');
    });

    this.ws.addEventListener('close', (event) => {
      console.log(`❌ Disconnected from relay (code: ${event.code}, reason: ${event.reason})`);
    });

    this.ws.addEventListener('error', (error) => {
      console.error('🚨 WebSocket error:', error);
    });

    this.ws.addEventListener('message', (buf: MessageEvent) => {
      this.handleMessage(buf);
    });
  }

  private async handleMessage(buf: MessageEvent): Promise<void> {
    try {
      const event: WebhookEvent = JSON.parse(buf.data);
      console.log(`Received event: ${event}`);
      const targetUrl = this.transformUrl(event.url);
      
      let body: Buffer | undefined;
      if (event.body) {
        body = Buffer.from(event.body);
      } else if (event.headers['content-type']?.includes('application/json')) {
        body = Buffer.from('{}');
      }

      console.log(`Forwarding ${event.method} ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        method: event.method,
        headers: event.headers,
        body,
      });
      
      console.log(`${response.status} ${response.statusText} ${response.url}`);
    } catch (err) {
      console.error('Error handling message:', err instanceof Error ? err.message : err);
    }
  }

  private transformUrl(originalUrl: string): string {
    const u = new URL(originalUrl);
    u.protocol = 'http:';
    u.hostname = this.config.targetHostnames.api.hostname;
    u.port = this.config.targetHostnames.api.port?.toString() || '';
    // Preserve original pathname if current is root
    if (u.pathname === '/') {
      const originalParsed = new URL(originalUrl);
      u.pathname = originalParsed.pathname;
    }

    return u.toString();
  }

  private setupSignalHandlers(): void {
    const disconnect = (): void => {
      if (this.exiting) return;
      this.exiting = true;
      console.log('Disconnecting from relay');
      this.ws.close();
      process.exit(0);
    };

    process.on('SIGINT', disconnect);
    process.on('SIGTERM', disconnect);
    process.on('SIGQUIT', disconnect);
    process.on('exit', disconnect);
  }
}

const getEnv = (process : NodeJS.Process): NodeJS.ProcessEnv & {
  RELAY_URL: string,
  WEBSOCKET_TOKEN: string,
  API_URL : string,
  AI_URL : string,
} => {

  const missing:string[] = [];
  if(!process.env.RELAY_URL){
    missing.push('RELAY_URL');
  }

  if(!process.env.WEBSOCKET_TOKEN){
    missing.push('WEBSOCKET_TOKEN');
  }


  if(!process.env.API_SERVICE_URL){
    missing.push('API_SERVICE_URL');
  }

  if(!process.env.AI_SERVICE_URL){
    missing.push('AI_SERVICE_URL');
  }


  if(missing.length > 0){
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  return { ...process.env, RELAY_URL: process.env.RELAY_URL!, WEBSOCKET_TOKEN: process.env.WEBSOCKET_TOKEN!, API_URL: process.env.API_SERVICE_URL!, AI_URL: process.env.AI_SERVICE_URL! };
}


const main = async () => {
  // Public RelayConfiguration
  const env = getEnv(process);
  const relayURL = new URL(env.RELAY_URL);
  relayURL.searchParams.set('token', env.WEBSOCKET_TOKEN);

  // Your local services
  const apiURL = new URL(env.API_URL);
  const aiURL = new URL(env.AI_URL);

  const config: Config = {
    relayURL: relayURL.toString(),
    targetHostnames: {
      api: {
        name: 'api',
        hostname: apiURL.hostname,
        port: apiURL.port ? parseInt(apiURL.port) : 80,
      },
      ai: {
        name: 'ai',
        hostname: aiURL.hostname,
        port: aiURL.port ? parseInt(aiURL.port) : 80,
      },
    },
  };

  console.log('Starting webhook relay client...');
  console.log(`Relay URL: ${config.relayURL}`);
  console.log(`Target hostname: ${config.targetHostnames.api}`);

  // Test connection first
  console.log('🔍 Testing connection...');
  const testUrl = new URL(config.relayURL);
  console.log(`Protocol: ${testUrl.protocol}`);
  console.log(`Host: ${testUrl.host}`);
  console.log(`Path: ${testUrl.pathname}`);

  // Start the client
  new WebhookRelayClient(config);

  // Keep the process alive
  process.stdin.resume();

}

main();