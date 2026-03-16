const WebSocket = require('ws');
const logger = require('../utils/logger');

let wss = null;

function createWebSocketServer(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'subscribe' && data.productId) {
          if (!ws.subscriptions) ws.subscriptions = new Set();
          ws.subscriptions.add(data.productId);
          ws.send(JSON.stringify({ type: 'subscribed', productId: data.productId }));
        }
        if (data.type === 'unsubscribe' && data.productId) {
          if (ws.subscriptions) ws.subscriptions.delete(data.productId);
          ws.send(JSON.stringify({ type: 'unsubscribed', productId: data.productId }));
        }
      } catch (parseErr) {
        logger.debug('WebSocket: malformed message received', { error: parseErr.message });
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error', { error: err.message });
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to inventory socket' }));
  });

  // Heartbeat to detect stale connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  logger.info('WebSocket server initialized');
  return wss;
}

function broadcastStockUpdate(productId, newStock) {
  if (!wss) return;

  const payload = JSON.stringify({
    type: 'stock_update',
    productId,
    newStock,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    // Send to all clients or only those subscribed to this product
    if (!client.subscriptions || client.subscriptions.size === 0 || client.subscriptions.has(productId)) {
      client.send(payload);
    }
  });

  logger.debug('Stock update broadcast', { productId, newStock });
}

module.exports = { createWebSocketServer, broadcastStockUpdate };
