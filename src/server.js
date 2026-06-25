import dotenv from 'dotenv';
import { createServer } from 'http';
import app from './app.js';
import connectDB from './config/db.js';

// Load Environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const DEFAULT_PORT = process.env.PORT || 5000;
const MAX_PORT_RETRIES = 10;

let server = null;

/**
 * Find an available port starting from the default port
 */
async function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    const tryPort = () => {
      if (attempts >= MAX_PORT_RETRIES) {
        reject(new Error(`Could not find available port after ${MAX_PORT_RETRIES} attempts`));
        return;
      }

      const testServer = createServer();
      
      testServer.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Server] Port ${currentPort} is already in use, trying ${currentPort + 1}...`);
          currentPort++;
          attempts++;
          testServer.close();
          tryPort();
        } else {
          reject(err);
        }
      });

      testServer.once('listening', () => {
        testServer.close();
        resolve(currentPort);
      });

      testServer.listen(currentPort);
    };

    tryPort();
  });
}

/**
 * Start the Express server with automatic port fallback
 */
async function startServer() {
  try {
    const availablePort = await findAvailablePort(DEFAULT_PORT);
    
    server = app.listen(availablePort, () => {
      console.log(`[Server] running in ${process.env.NODE_ENV || 'development'} mode on port ${availablePort}`);
      
      if (availablePort !== DEFAULT_PORT) {
        console.log(`[Server] Note: Default port ${DEFAULT_PORT} was in use, using port ${availablePort} instead`);
      }
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server Error] Port ${availablePort} is already in use`);
        console.error('[Server Error] Please stop the existing server or use a different port');
        process.exit(1);
      } else {
        console.error(`[Server Error] ${err.message}`);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error(`[Server Error] Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n[Server] ${signal} received, closing server gracefully...`);
  
  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle process termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`[Unhandled Rejection] Error: ${err.message}`);
  // Close server & exit process
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`[Uncaught Exception] Error: ${err.message}`);
  console.error(err.stack);
  // Close server & exit process
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
