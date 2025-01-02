import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { Readable } from 'stream';

export function createMockChildProcess(sandbox: sinon.SinonSandbox): ChildProcess {
    const mockProcess = new EventEmitter() as unknown as ChildProcess;
    mockProcess.stdout = new Readable({ read: () => {} });
    mockProcess.stderr = new Readable({ read: () => {} });
    Object.defineProperty(mockProcess, 'kill', {
        value: sandbox.stub().returns(true),
        writable: true
    });
    Object.defineProperty(mockProcess, 'pid', {
        value: 12345,
        writable: true
    });
    return mockProcess;
}

export function createMockProcessProxy(sandbox: sinon.SinonSandbox) {
    const mockProcess = createMockChildProcess(sandbox);
    return {
        spawn: sandbox.stub().returns(mockProcess)
    };
} 