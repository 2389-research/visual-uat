// ABOUTME: Manages dev servers for baseline and current branches during test execution.
// ABOUTME: Starts servers on configurable ports, waits for readiness, and handles cleanup.

import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

export interface ServerManagerConfig {
  startCommand?: string;
}

export interface ServerInfo {
  process: ChildProcess;
  port: number;
  directory: string;
}

export class ServerManager {
  private servers: ServerInfo[] = [];
  private startCommand: string;
  private startArgs: string[];

  constructor(config: ServerManagerConfig = {}) {
    const command = config.startCommand || 'npm start';
    const parts = command.split(/\s+/);
    this.startCommand = parts[0];
    this.startArgs = parts.slice(1);
  }

  async startServer(directory: string, port: number): Promise<ServerInfo> {
    console.log(`Starting server in ${directory} on port ${port}...`);

    const serverProcess = spawn(this.startCommand, this.startArgs, {
      cwd: directory,
      env: {
        ...process.env,
        PORT: port.toString()
      },
      stdio: 'pipe'
    });

    const serverInfo: ServerInfo = {
      process: serverProcess,
      port,
      directory
    };

    this.servers.push(serverInfo);

    // Wait for server to be ready
    await this.waitForServer(port, 30000); // 30 second timeout

    console.log(`Server ready on port ${port}`);

    return serverInfo;
  }

  private async waitForServer(port: number, timeout: number): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkServer = () => {
        const socket = new net.Socket();

        socket.setTimeout(1000);

        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });

        socket.on('timeout', () => {
          socket.destroy();
          retry();
        });

        socket.on('error', () => {
          retry();
        });

        socket.connect(port, '127.0.0.1');
      };

      const retry = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server on port ${port} failed to start within ${timeout}ms`));
        } else {
          setTimeout(checkServer, 500);
        }
      };

      checkServer();
    });
  }

  cleanup(): void {
    console.log(`Cleaning up ${this.servers.length} server(s)...`);

    for (const server of this.servers) {
      try {
        if (server.process && !server.process.killed) {
          server.process.kill('SIGTERM');

          // Force kill after 2 seconds if still alive
          setTimeout(() => {
            if (server.process && !server.process.killed) {
              server.process.kill('SIGKILL');
            }
          }, 2000);
        }
      } catch (error) {
        console.warn(`Failed to kill server on port ${server.port}:`, error);
      }
    }

    this.servers = [];
  }
}
