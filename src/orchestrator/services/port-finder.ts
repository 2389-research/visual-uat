// ABOUTME: Utility to find available ports for dev servers
// ABOUTME: Uses OS port allocation to avoid conflicts with stale processes

import * as net from 'net';

/**
 * Find an available port by letting the OS assign one.
 * This avoids hardcoded port conflicts with stale processes.
 */
export async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);

    // Port 0 tells the OS to assign an available port
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Failed to get port from server')));
      }
    });
  });
}

/**
 * Find multiple available ports, guaranteed to be unique.
 */
export async function findAvailablePorts(count: number): Promise<number[]> {
  const ports: number[] = [];
  const servers: net.Server[] = [];

  try {
    // Keep all servers open until we have all ports to ensure uniqueness
    for (let i = 0; i < count; i++) {
      const server = net.createServer();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });

      const address = server.address();
      if (address && typeof address === 'object') {
        ports.push(address.port);
        servers.push(server);
      }
    }

    return ports;
  } finally {
    // Close all servers
    for (const server of servers) {
      server.close();
    }
  }
}
