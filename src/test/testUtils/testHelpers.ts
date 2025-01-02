import { TestContext } from './testSetup';
import { TestServerConfig, DEFAULT_TEST_CONFIG } from './testData';
import { emitProcessEvents } from './mockEvents';
import { ChildProcess } from 'child_process';

export async function setupServerTest(
    context: TestContext,
    config: TestServerConfig = DEFAULT_TEST_CONFIG
): Promise<void> {
    // Mock configuration
    context.config.get.withArgs('port').returns(config.port);
    context.config.get.withArgs('logLevel').returns(config.logLevel);
    context.config.get.withArgs('autoUpdate').returns(config.autoUpdate);
    if (config.jarPath) {
        context.config.get.withArgs('jarPath').returns(config.jarPath);
    }
}

export async function startServer(
    context: TestContext,
    process: ChildProcess,
    config: TestServerConfig = DEFAULT_TEST_CONFIG
): Promise<void> {
    // Emit server start events
    emitProcessEvents(process, [
        { event: 'stdout', data: `Server started on port ${config.port}` }
    ]);

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
}

export async function stopServer(
    context: TestContext,
    process: ChildProcess
): Promise<void> {
    // Emit server stop events
    emitProcessEvents(process, [
        { event: 'stdout', data: 'Server stopped' },
        { event: 'exit', data: 0 }
    ]);

    // Wait for server to stop
    await new Promise(resolve => setTimeout(resolve, 100));
}

export async function simulateServerError(
    context: TestContext,
    process: ChildProcess,
    errorMessage: string
): Promise<void> {
    // Emit server error events
    emitProcessEvents(process, [
        { event: 'stderr', data: errorMessage },
        { event: 'error', data: new Error(errorMessage) }
    ]);

    // Wait for error to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
}

export function getProcessFromContext(context: TestContext): ChildProcess {
    const spawn = context.sandbox.stub().named('spawn');
    return spawn.firstCall?.returnValue;
}

export async function waitForCondition(
    condition: () => boolean,
    timeout: number = 1000,
    interval: number = 100
): Promise<void> {
    const startTime = Date.now();
    while (!condition() && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    if (!condition()) {
        throw new Error('Condition not met within timeout');
    }
} 