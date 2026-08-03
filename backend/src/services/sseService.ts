import { Response } from 'express';

export interface SSEEvent {
  event: string;
  data: any;
}

class SSEService {
  private clients: Set<Response> = new Set();

  /**
   * Registers a new client connection for Server-Sent Events.
   */
  addClient(res: Response): void {
    this.clients.add(res);
    console.log(`📡 [SSE] Client connected. Total active streams: ${this.clients.size}`);

    // Send initial handshake message
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), clientCount: this.clients.size })}\n\n`);

    res.on('close', () => {
      this.clients.delete(res);
      console.log(`📡 [SSE] Client disconnected. Remaining streams: ${this.clients.size}`);
    });
  }

  /**
   * Broadcasts an event to all connected SSE client responses.
   */
  broadcast(event: string, data: any): void {
    if (this.clients.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        console.error('❌ [SSE] Error writing to client stream:', err);
        this.clients.delete(client);
      }
    }
  }

  /**
   * Returns current active connection count.
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseService = new SSEService();
