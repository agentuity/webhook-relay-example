import { DurableObject } from 'cloudflare:workers';

export interface Env {
	WEBHOOK_RELAY: DurableObjectNamespace<WebhookRelay>;
	WEBSOCKET_TOKEN: string;
}

// Worker
export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		console.log(`[Worker] Incoming request: ${request.method} ${url.pathname}`);
		
		let id = env.WEBHOOK_RELAY.idFromName('webhook-relay');
		let stub = env.WEBHOOK_RELAY.get(id);
		return stub.fetch(request);
	},
} satisfies ExportedHandler<Env>;

// Durable Object
export class WebhookRelay extends DurableObject<Env> {
	broadcast(message: string) {
		const websockets = this.ctx.getWebSockets();
		console.log(`[WebhookRelay] Broadcasting message to ${websockets.length} connected WebSocket(s)`);
		for (const ws of websockets) {
			ws.send(message);
		}
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		console.log(`[WebhookRelay] Processing request: ${request.method} ${url.pathname}`);
		
		if (!url.pathname.endsWith('/_websocket')) {
			console.log(`[WebhookRelay] Webhook received from: ${url.toString()}`);
			const payload = JSON.stringify({
				url: url.toString(),
				method: request.method,
				headers: (() => {
				const headerObj: Record<string, string> = {};
				request.headers.forEach((value, key) => {
					headerObj[key] = value;
				});
				return headerObj;
			})(),
				body: await request.text(),
			});
			
			this.broadcast(payload);
			console.log(`[WebhookRelay] Broadcasted webhook to ${this.ctx.getWebSockets().length} connected clients`);
			
			return new Response(null, {
				status: 202,
				statusText: 'OK',
				headers: {
					'Content-Type': 'text/plain',
				},
			});
		}
		console.log(`[WebhookRelay] WebSocket connection attempt`);
		
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			console.log(`[WebhookRelay] Invalid upgrade header: ${upgradeHeader}`);
			return new Response('Durable Object expected Upgrade: websocket', {
				status: 426,
			});
		}

		const token = url.searchParams.get('token');
		const expectedToken = this.env.WEBSOCKET_TOKEN;

		if (!token || token !== expectedToken) {
			console.log(`[WebhookRelay] Authentication failed - invalid token`);
			return new Response('Unauthorized', { status: 401 });
		}
		
		console.log(`[WebhookRelay] WebSocket authentication successful`);

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		this.ctx.acceptWebSocket(server);
		console.log(`[WebhookRelay] WebSocket connection established. Total connections: ${this.ctx.getWebSockets().length}`);

		server.addEventListener('message', (event: MessageEvent) => {
			const sockets = this.ctx.getWebSockets();
			console.log(`[WebhookRelay] WebSocket message received: ${event.data} (${sockets.length} total connections)`);
		});

		server.addEventListener('close', (event: CloseEvent) => {
			console.log(`[WebhookRelay] WebSocket connection closed: code=${event.code}, reason=${event.reason}`);
			server.close(event.code, 'Closing WebSocket');
			console.log(`[WebhookRelay] Remaining connections: ${this.ctx.getWebSockets().length}`);
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
}