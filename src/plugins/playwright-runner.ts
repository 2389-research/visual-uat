// ABOUTME: Playwright-based target runner for web applications
// ABOUTME: Manages starting/stopping dev servers in isolated port-based environments

import type { TargetRunner, TargetInfo } from '../types/plugins';
import type { TargetRunnerConfig } from '../types/config';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

export class PlaywrightRunner implements TargetRunner {
  private config: TargetRunnerConfig;
  private processes: Map<string, ChildProcess> = new Map();
  private portAllocations: Map<string, number> = new Map();

  constructor(config: TargetRunnerConfig) {
    this.config = config;
  }

  async start(branch: string): Promise<TargetInfo> {
    const port = await this.findFreePort();
    this.portAllocations.set(branch, port);

    const baseUrl = this.config.baseUrl
      ? this.config.baseUrl.replace(/:\d+/, `:${port}`)
      : `http://localhost:${port}`;

    if (this.config.startCommand) {
      const child = spawn(this.config.startCommand, [], {
        shell: true,
        env: {
          ...process.env,
          PORT: port.toString(),
          BASE_URL: baseUrl
        }
      });

      this.processes.set(branch, child);

      // Wait for server to be ready
      await this.waitForServer(baseUrl);
    }

    return {
      baseUrl,
      environment: {
        PORT: port.toString(),
        BRANCH: branch
      },
      metadata: {
        pid: this.processes.get(branch)?.pid
      }
    };
  }

  async stop(targetInfo: TargetInfo): Promise<void> {
    const branch = targetInfo.environment.BRANCH;
    const process = this.processes.get(branch);

    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(branch);
    }

    this.portAllocations.delete(branch);
  }

  async isReady(targetInfo: TargetInfo): Promise<boolean> {
    try {
      const response = await fetch(targetInfo.baseUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  async allocatePort(branch: string): Promise<TargetInfo> {
    const port = await this.findFreePort();
    this.portAllocations.set(branch, port);

    const baseUrl = this.config.baseUrl
      ? this.config.baseUrl.replace(/:\d+/, `:${port}`)
      : `http://localhost:${port}`;

    return {
      baseUrl,
      environment: {
        PORT: port.toString(),
        BRANCH: branch
      },
      metadata: {}
    };
  }

  private async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          reject(new Error('Failed to get port'));
        }
      });
      server.on('error', reject);
    });
  }

  private async waitForServer(baseUrl: string, timeout = 30000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(baseUrl);
        if (response.ok) return;
      } catch {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Server at ${baseUrl} did not become ready within ${timeout}ms`);
  }
}
