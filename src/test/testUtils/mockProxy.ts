/* eslint-disable @typescript-eslint/no-unused-vars */
import * as proxyquire from 'proxyquire';
import { createMockVscodeModule } from './mockVscode';
import { createMockFileSystem } from './mockFs';
import { createMockAxios } from './mockAxios';
import { createMockProcessProxy } from './mockProcess';
import { TestContext } from './testSetup';

export interface ProxyOptions {
    skipInitialChecks?: boolean;
    mockDownloadJar?: boolean;
}

export function createProcessManagerProxy(
    context: TestContext,
    options: ProxyOptions = {}
) {
    const ProcessManagerProxy = proxyquire.noCallThru().load('../../extension/managers/processManager', {
        'fs': createMockFileSystem(),
        'vscode': createMockVscodeModule(context.outputChannel, context.statusBarItem, context.config),
        'axios': createMockAxios(),
        'child_process': createMockProcessProxy(context.sandbox)
    }).ProcessManager;

    if (options.mockDownloadJar) {
        ProcessManagerProxy.prototype.downloadJar = () => Promise.resolve('/path/to/jar');
    }

    return ProcessManagerProxy;
}

export function createServerManagerProxy(
    context: TestContext,
    options: ProxyOptions = {}
) {
    const ServerManagerProxy = proxyquire.noCallThru().load('../../extension/managers/serverManager', {
        'fs': createMockFileSystem(),
        'vscode': createMockVscodeModule(context.outputChannel, context.statusBarItem, context.config),
        'axios': createMockAxios()
    }).ServerManager;

    if (options.mockDownloadJar) {
        ServerManagerProxy.prototype.downloadJar = () => Promise.resolve('/path/to/jar');
    }

    return ServerManagerProxy;
} 