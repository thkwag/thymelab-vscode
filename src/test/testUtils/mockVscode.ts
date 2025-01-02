/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';
import * as sinon from 'sinon';

export function createMockOutputChannel(sandbox: sinon.SinonSandbox): vscode.OutputChannel {
    return {
        appendLine: sandbox.stub(),
        append: sandbox.stub(),
        clear: sandbox.stub(),
        show: sandbox.stub(),
        dispose: sandbox.stub()
    } as any;
}

export function createMockStatusBarItem(sandbox: sinon.SinonSandbox): vscode.StatusBarItem {
    return {
        text: '',
        show: sandbox.stub(),
        hide: sandbox.stub(),
        dispose: sandbox.stub(),
        id: 'thymelab-status',
        alignment: vscode.StatusBarAlignment.Right,
        priority: 100,
        name: 'Thymelab Status',
        tooltip: '',
        command: undefined,
        accessibilityInformation: undefined,
        backgroundColor: undefined,
        color: undefined
    } as vscode.StatusBarItem;
}

export function createMockConfiguration(sandbox: sinon.SinonSandbox) {
    return {
        get: sandbox.stub().callsFake((key: string) => {
            switch (key) {
                case 'port': return 8080;
                case 'logLevel': return 'INFO';
                case 'autoUpdate': return false;
                case 'jarPath': return '/path/to/jar';
                default: return undefined;
            }
        }),
        update: sandbox.stub()
    };
}

export function createMockExtensionContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionPath: '/test/path',
        extensionUri: vscode.Uri.file('/test/path'),
        globalState: {
            get: () => undefined,
            update: () => Promise.resolve(),
            keys: () => []
        } as any,
        workspaceState: {
            get: () => undefined,
            update: () => Promise.resolve(),
            keys: () => []
        } as any,
        secrets: {
            get: () => Promise.resolve(''),
            store: () => Promise.resolve(),
            delete: () => Promise.resolve(),
            onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event
        },
        storageUri: vscode.Uri.file('/test/storage'),
        globalStorageUri: vscode.Uri.file('/test/global-storage'),
        logUri: vscode.Uri.file('/test/log'),
        extensionMode: vscode.ExtensionMode.Test,
        storagePath: '/test/storage',
        globalStoragePath: '/test/global-storage',
        logPath: '/test/log',
        asAbsolutePath: (path: string) => path,
        environmentVariableCollection: {
            persistent: false,
            description: 'Test Environment Variables',
            replace: () => {},
            append: () => {},
            prepend: () => {},
            get: () => undefined,
            forEach: () => {},
            delete: () => {},
            clear: () => {},
            getScoped: () => ({} as vscode.EnvironmentVariableCollection),
            [Symbol.iterator]: function* () { yield* []; }
        },
        extension: {
            id: 'test.extension',
            extensionUri: vscode.Uri.file('/test/path'),
            extensionPath: '/test/path',
            isActive: true,
            packageJSON: {},
            exports: undefined,
            activate: () => Promise.resolve(),
            extensionKind: vscode.ExtensionKind.Workspace
        },
        languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation
    } as vscode.ExtensionContext;
}

export function createMockWorkspaceFolders() {
    return [{
        uri: vscode.Uri.file('/workspace'),
        name: 'workspace',
        index: 0
    }];
}

export function createMockVscodeModule(
    outputChannel: vscode.OutputChannel,
    statusBarItem: vscode.StatusBarItem,
    config: any
) {
    return {
        window: {
            createOutputChannel: () => outputChannel,
            showErrorMessage: () => Promise.resolve(),
            showInformationMessage: () => Promise.resolve(),
            createStatusBarItem: () => statusBarItem
        },
        workspace: {
            getConfiguration: (section: string) => {
                if (section === 'thymelab.processor') {
                    return {
                        get: (key: string) => {
                            switch (key) {
                                case 'port': return 8080;
                                case 'logLevel': return 'INFO';
                                case 'autoUpdate': return false;
                                case 'jarPath': return '/path/to/jar';
                                default: return undefined;
                            }
                        },
                        update: () => Promise.resolve()
                    };
                }
                return config;
            },
            onDidChangeConfiguration: () => ({ dispose: () => {} }),
            fs: {
                writeFile: () => Promise.resolve()
            }
        },
        StatusBarAlignment: vscode.StatusBarAlignment,
        Uri: {
            ...vscode.Uri,
            file: (path: string) => vscode.Uri.file(path)
        },
        EventEmitter: vscode.EventEmitter,
        ExtensionMode: vscode.ExtensionMode
    };
} 