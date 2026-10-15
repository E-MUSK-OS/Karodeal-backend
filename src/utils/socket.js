import { Server } from 'socket.io';

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    // Client connected
    socket.on('disconnect', () => {
      // Client disconnected
    });
  });

  return io;
};

export const getIO = () => io;

export const emitProductsChange = (action, payload = null) => {
  if (io) {
    io.emit('products:changed', {
      action,
      payload,
      timestamp: Date.now()
    });
  }
};

export const emitReviewRequestChange = (action, payload = null) => {
  if (io) {
    io.emit('review_requests:changed', {
      action,
      payload,
      timestamp: Date.now()
    });
    io.emit('star_requests:changed', {
      action,
      payload,
      timestamp: Date.now()
    });
  }
};

export const emitStarRequestChange = emitReviewRequestChange;

export const emitClaimsChange = (action, payload = null) => {
  if (io) {
    io.emit('claims:changed', {
      action,
      payload,
      timestamp: Date.now()
    });
    io.emit('billing:changed', {
      action,
      payload,
      timestamp: Date.now()
    });
  }
};

export const emitBillingChange = () => emitClaimsChange('billing');


