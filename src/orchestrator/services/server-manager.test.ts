// ABOUTME: Tests for ServerManager service
// ABOUTME: Validates server startup, shutdown, and configuration handling

import { ServerManager } from './server-manager';
import { spawn } from 'child_process';
import * as net from 'net';

jest.mock('child_process');
jest.mock('net');

describe('ServerManager', () => {
  let mockSpawn: jest.MockedFunction<typeof spawn>;
  let mockSocket: jest.Mocked<net.Socket>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock spawn to return a fake process
    mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
    mockSpawn.mockReturnValue({
      kill: jest.fn(),
      killed: false,
      pid: 12345,
      on: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() }
    } as any);

    // Mock net.Socket
    mockSocket = {
      setTimeout: jest.fn(),
      on: jest.fn().mockImplementation((event, callback) => {
        // Simulate immediate connection success
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
        return mockSocket;
      }),
      connect: jest.fn(),
      destroy: jest.fn()
    } as any;

    (net.Socket as jest.MockedClass<typeof net.Socket>).mockImplementation(() => mockSocket);
  });

  describe('startServer', () => {
    it('should use startCommand from config instead of hardcoded npm start', async () => {
      const manager = new ServerManager({ startCommand: 'yarn dev' });

      await manager.startServer('/test/dir', 3000);

      // Should parse 'yarn dev' into command='yarn' and args=['dev']
      expect(mockSpawn).toHaveBeenCalledWith(
        'yarn',
        ['dev'],
        expect.objectContaining({
          cwd: '/test/dir',
          env: expect.objectContaining({ PORT: '3000' })
        })
      );
    });

    it('should default to npm start when no startCommand provided', async () => {
      const manager = new ServerManager();

      await manager.startServer('/test/dir', 3000);

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm',
        ['start'],
        expect.objectContaining({
          cwd: '/test/dir'
        })
      );
    });

    it('should handle startCommand with multiple arguments', async () => {
      const manager = new ServerManager({ startCommand: 'npx serve -s build -l' });

      await manager.startServer('/test/dir', 8080);

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        ['serve', '-s', 'build', '-l'],
        expect.objectContaining({
          cwd: '/test/dir',
          env: expect.objectContaining({ PORT: '8080' })
        })
      );
    });

    it('should handle single-word startCommand', async () => {
      const manager = new ServerManager({ startCommand: 'serve' });

      await manager.startServer('/test/dir', 5000);

      expect(mockSpawn).toHaveBeenCalledWith(
        'serve',
        [],
        expect.objectContaining({
          cwd: '/test/dir'
        })
      );
    });
  });

  describe('cleanup', () => {
    it('should kill all started servers', async () => {
      const mockProcess = {
        kill: jest.fn(),
        killed: false,
        pid: 12345,
        on: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const manager = new ServerManager();
      await manager.startServer('/test/dir', 3000);

      manager.cleanup();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});
