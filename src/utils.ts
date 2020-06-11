import * as childProcess from 'child_process';
import { join } from 'ramda';

export class SpawnError extends Error {
  constructor(message: string, public stdout: string, public stderr: string) {
    super(message);
  }

  toString() {
    return `${this.message}\n${this.stderr}`;
  }
}

/**
 * Executes a child process without limitations on stdout and stderr.
 * On error (exit code is not 0), it rejects with a SpawnProcessError that contains the stdout and stderr streams,
 * on success it returns the streams in an object.
 * @param {string} command - Command
 * @param {string[]} [args] - Arguments
 * @param {Object} [options] - Options for child_process.spawn
 */
export function spawnProcess(command: string, args: string[], options: childProcess.SpawnOptionsWithoutStdio) {
  return new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
    const child = childProcess.spawn(command, args, options);
    let stdout = '';
    let stderr = '';
    // Configure stream encodings
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    // Listen to stream events
    child.stdout.on('data', data => {
      stdout += data;
    });
    child.stderr.on('data', data => {
      stderr += data;
    });
    child.on('error', err => {
      reject(err);
    });
    child.on('close', exitCode => {
      if (exitCode !== 0) {
        reject(new SpawnError(`${command} ${join(' ', args)} failed with code ${exitCode}`, stdout, stderr));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
