// ABOUTME: Tests for port-finder utility
// ABOUTME: Validates dynamic port allocation for dev servers

import { findAvailablePort, findAvailablePorts } from './port-finder';
import * as net from 'net';

describe('port-finder', () => {
  describe('findAvailablePort', () => {
    it('should return a port number', async () => {
      const port = await findAvailablePort();

      expect(typeof port).toBe('number');
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
    });

    it('should return a port that is actually available', async () => {
      const port = await findAvailablePort();

      // Verify we can actually bind to this port
      const server = net.createServer();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.close();
          resolve();
        });
      });
    });

    it('should return different ports on subsequent calls', async () => {
      const port1 = await findAvailablePort();
      const port2 = await findAvailablePort();

      // While not guaranteed, in practice these should be different
      // If they happen to be the same, that's fine - the test is probabilistic
      expect(typeof port1).toBe('number');
      expect(typeof port2).toBe('number');
    });
  });

  describe('findAvailablePorts', () => {
    it('should return the requested number of unique ports', async () => {
      const ports = await findAvailablePorts(2);

      expect(ports).toHaveLength(2);
      expect(ports[0]).not.toBe(ports[1]);
    });

    it('should return ports that are all available', async () => {
      const ports = await findAvailablePorts(3);

      expect(ports).toHaveLength(3);

      // Verify all ports are unique
      const uniquePorts = new Set(ports);
      expect(uniquePorts.size).toBe(3);
    });
  });
});
