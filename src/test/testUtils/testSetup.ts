/* eslint-disable @typescript-eslint/no-explicit-any */
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { 
    createMockOutputChannel, 
    createMockStatusBarItem, 
    createMockConfiguration, 
    createMockWorkspaceFolders,
    createMockExtensionContext
} from './mockVscode';

export interface TestContext {
    sandbox: sinon.SinonSandbox;
    outputChannel: vscode.OutputChannel;
    statusBarItem: vscode.StatusBarItem;
    config: any;
    disposables: vscode.Disposable[];
    mockContext: vscode.ExtensionContext;
}

export function createTestContext(): TestContext {
    const sandbox = sinon.createSandbox();
    const outputChannel = createMockOutputChannel(sandbox);
    const statusBarItem = createMockStatusBarItem(sandbox);
    const config = createMockConfiguration(sandbox);
    const mockContext = createMockExtensionContext();

    // Mock VSCode APIs
    sandbox.stub(vscode.window, 'createOutputChannel').returns(outputChannel as any);
    sandbox.stub(vscode.window, 'createStatusBarItem')
        .withArgs(vscode.StatusBarAlignment.Right, 100)
        .returns(statusBarItem);
    sandbox.stub(vscode.workspace, 'getConfiguration').returns(config as any);
    sandbox.stub(vscode.workspace, 'workspaceFolders').value(createMockWorkspaceFolders());

    return {
        sandbox,
        outputChannel,
        statusBarItem,
        config,
        disposables: [],
        mockContext
    };
}

export function cleanupTestContext(context: TestContext) {
    context.disposables.forEach(d => d.dispose());
    context.disposables = [];
    context.sandbox.restore();
} 