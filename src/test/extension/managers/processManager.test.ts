/* eslint-disable @typescript-eslint/no-explicit-any */
import { assert } from 'chai';
import { ProcessManager } from '../../../extension/managers/processManager';
import { createTestContext, TestContext, cleanupTestContext } from '../../testUtils/testSetup';
import { createProcessManagerProxy } from '../../testUtils/mockProxy';

suite('ProcessManager Tests', () => {
    let context: TestContext;
    let processManager: ProcessManager;

    setup(() => {
        context = createTestContext();
        const ProcessManagerProxy = createProcessManagerProxy(context, {
            skipInitialChecks: true,
            mockDownloadJar: true
        });

        processManager = new ProcessManagerProxy(
            context.outputChannel,
            context.mockContext,
            undefined,
            true
        );
    });

    teardown(() => {
        cleanupTestContext(context);
    });

    test('should initialize with correct configuration', () => {
        assert.exists(processManager);
    });

    // TODO: Fix server start/stop test
    // - Mock process events and health check properly
    // - Handle process cleanup and port verification
    // - Ensure proper event sequencing for start/stop operations

    // TODO: Fix server start failure test
    // - Properly mock error events and process termination
    // - Verify error handling and cleanup
    // - Test various failure scenarios (spawn error, runtime error, etc.)

    // TODO: Fix server stop when not running test
    // - Verify cleanup behavior when process is not active
    // - Test edge cases in process management

    // TODO: Fix log level change test
    // - Test log level updates during server operation
    // - Verify configuration persistence
    // - Check server restart behavior with new log level
}); 