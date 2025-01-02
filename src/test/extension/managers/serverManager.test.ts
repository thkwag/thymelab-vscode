import * as vscode from 'vscode';
import { ServerManager } from '../../../extension/managers/serverManager';
import { ServerState } from '../../../extension/types/serverState';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { ProcessManager } from '../../../extension/managers/processManager';
import { EventEmitter } from 'vscode';
import * as proxyquire from 'proxyquire';

suite('ServerManager Tests', () => {
    let serverManager: ServerManager;
    let mockContext: vscode.ExtensionContext;
    let mockOutputChannel: vscode.OutputChannel;
    let mockProcessManager: ProcessManager;
    let sandbox: sinon.SinonSandbox;
    let configChangeCallback: () => void;
    let mockWorkspace: {
        getConfiguration: () => vscode.WorkspaceConfiguration;
        onDidChangeConfiguration: () => { dispose: () => void };
    };

    setup(() => {
        sandbox = sinon.createSandbox();

        // Mock VS Code APIs
        mockOutputChannel = {
            show: () => {},
            appendLine: () => {},
            dispose: () => {},
            clear: () => {},
            replace: () => {},
            append: () => {},
            hide: () => {},
            name: 'ThymeLab Processor'
        };

        // Mock extension context
        const mockMemento = {
            get: <T>(_key: string, defaultValue?: T) => defaultValue as T,
            update: () => Promise.resolve(),
            keys: () => [] as readonly string[],
            setKeysForSync: () => {}
        } as vscode.Memento & { setKeysForSync(): void };

        const secretsEmitter = new EventEmitter<void>();

        mockContext = {
            subscriptions: [],
            extensionPath: '',
            globalState: mockMemento,
            workspaceState: mockMemento,
            extensionUri: vscode.Uri.file(''),
            environmentVariableCollection: {} as vscode.EnvironmentVariableCollection,
            extensionMode: vscode.ExtensionMode.Test,
            globalStorageUri: vscode.Uri.file(''),
            logUri: vscode.Uri.file(''),
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            asAbsolutePath: (relativePath: string) => relativePath,
            storageUri: vscode.Uri.file(''),
            secrets: {
                get: () => Promise.resolve(''),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve(),
                onDidChange: secretsEmitter.event
            },
            extension: {
                id: 'test',
                extensionUri: vscode.Uri.file(''),
                extensionPath: '',
                isActive: true,
                packageJSON: {},
                exports: undefined,
                activate: () => Promise.resolve(),
                extensionKind: vscode.ExtensionKind.Workspace
            },
            languageModelAccessInformation: {
                keyId: '',
                endpoint: ''
            }
        } as unknown as vscode.ExtensionContext;

        // Mock ProcessManager
        mockProcessManager = {
            startServer: sandbox.stub().resolves(),
            stopServer: sandbox.stub().resolves(),
            setLogLevel: sandbox.stub().resolves(),
            checkForUpdates: sandbox.stub().resolves(),
            downloadJar: sandbox.stub().resolves('/path/to/downloaded.jar')
        } as unknown as ProcessManager;

        // Mock workspace
        mockWorkspace = {
            getConfiguration: () => ({
                get: (key: string) => {
                    if (key === 'autoUpdate') {
                        return true;
                    }
                    return undefined;
                },
                update: () => Promise.resolve(),
                has: () => true,
                inspect: () => undefined
            }),
            onDidChangeConfiguration: () => {
                return { dispose: () => {} };
            }
        };

        // Create instance with mocked dependencies using proxyquire
        const ServerManagerProxy = proxyquire.noCallThru().load('../../../extension/managers/serverManager', {
            'fs': {
                existsSync: () => true
            },
            './processManager': {
                ProcessManager: function() {
                    return mockProcessManager;
                }
            },
            'vscode': {
                window: {
                    createOutputChannel: () => mockOutputChannel,
                    showErrorMessage: () => Promise.resolve(),
                    showInformationMessage: () => Promise.resolve()
                },
                commands: {
                    executeCommand: () => Promise.resolve()
                },
                workspace: mockWorkspace,
                '@noCallThru': true
            }
        }).ServerManager;

        serverManager = new ServerManagerProxy(mockContext);
    });

    teardown(() => {
        sandbox.restore();
    });

    // Test server state management
    test('should initialize with stopped state', () => {
        assert.strictEqual(serverManager.getState(), ServerState.Stopped);
    });

    // Test server start
    test('should start server successfully', async () => {
        // Mock configuration with valid paths
        const mockConfig = {
            jarPath: '/path/to/jar',
            templatePath: '/path/to/templates',
            staticPath: '/path/to/static',
            dataPath: '/path/to/data'
        };
        type PrivateServerManager = {
            getConfig(): { jarPath?: string; templatePath: string; staticPath: string; dataPath: string };
            validateRequiredDirectories(): string[];
        };
        
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'getConfig').returns(mockConfig);
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'validateRequiredDirectories').returns([]);

        await serverManager.start();

        assert.strictEqual(serverManager.getState(), ServerState.Running);
        sinon.assert.calledOnce(mockProcessManager.startServer as sinon.SinonStub);
    });

    // Test server stop
    test('should stop server successfully', async () => {
        // Set initial state to running
        const mockConfig = {
            jarPath: '/path/to/jar',
            templatePath: '/path/to/templates',
            staticPath: '/path/to/static',
            dataPath: '/path/to/data'
        };
        type PrivateServerManager = {
            getConfig(): { jarPath?: string; templatePath: string; staticPath: string; dataPath: string };
            validateRequiredDirectories(): string[];
        };
        
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'getConfig').returns(mockConfig);
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'validateRequiredDirectories').returns([]);

        await serverManager.start();
        assert.strictEqual(serverManager.getState(), ServerState.Running);

        await serverManager.stop();
        assert.strictEqual(serverManager.getState(), ServerState.Stopped);
        sinon.assert.calledOnce(mockProcessManager.stopServer as sinon.SinonStub);
    });

    // Test server restart
    test('should restart server successfully', async () => {
        // Mock configuration with valid paths
        const mockConfig = {
            jarPath: '/path/to/jar',
            templatePath: '/path/to/templates',
            staticPath: '/path/to/static',
            dataPath: '/path/to/data'
        };
        type PrivateServerManager = {
            getConfig(): { jarPath?: string; templatePath: string; staticPath: string; dataPath: string };
            validateRequiredDirectories(): string[];
        };
        
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'getConfig').returns(mockConfig);
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'validateRequiredDirectories').returns([]);

        await serverManager.restart();

        assert.strictEqual(serverManager.getState(), ServerState.Running);
        sinon.assert.calledOnce(mockProcessManager.stopServer as sinon.SinonStub);
        sinon.assert.calledOnce(mockProcessManager.startServer as sinon.SinonStub);
    });

    // Test directory validation
    test('should validate required directories', async () => {
        const mockConfig = {
            templatePath: '',
            staticPath: '',
            dataPath: ''
        };
        type PrivateServerManager = {
            getConfig(): { jarPath?: string; templatePath: string; staticPath: string; dataPath: string };
            validateRequiredDirectories(): string[];
        };
        
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'getConfig').returns(mockConfig);

        const missingDirs = (serverManager as unknown as PrivateServerManager).validateRequiredDirectories();
        assert.deepStrictEqual(missingDirs, ['Templates', 'Static Files', 'Data Files']);
    });

    // Test log level change
    test('should change log level when server is running', async () => {
        // Set server state to running
        const mockConfig = {
            jarPath: '/path/to/jar',
            templatePath: '/path/to/templates',
            staticPath: '/path/to/static',
            dataPath: '/path/to/data'
        };
        type PrivateServerManager = {
            getConfig(): { jarPath?: string; templatePath: string; staticPath: string; dataPath: string };
            validateRequiredDirectories(): string[];
        };
        
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'getConfig').returns(mockConfig);
        sandbox.stub(serverManager as unknown as PrivateServerManager, 'validateRequiredDirectories').returns([]);

        await serverManager.start();
        await serverManager.changeLogLevel('DEBUG');
        
        sinon.assert.calledOnceWithExactly(mockProcessManager.setLogLevel as sinon.SinonStub, 'DEBUG');
    });

    // Test auto update configuration
    test('should check for updates when auto update is enabled', async () => {
        // Reset checkForUpdates stub since it's called in constructor
        (mockProcessManager.checkForUpdates as sinon.SinonStub).resetHistory();

        // Trigger configuration change
        await configChangeCallback();
        
        sinon.assert.calledOnce(mockProcessManager.checkForUpdates as sinon.SinonStub);
    });

    // Test JAR download
    test('should download JAR file when not present', async () => {
        await serverManager.downloadJar();
        
        sinon.assert.calledOnce(mockProcessManager.downloadJar as sinon.SinonStub);
    });

    // Test error handling
    test('should handle server start failure', async () => {
        // Mock process manager to throw error
        (mockProcessManager.startServer as sinon.SinonStub).rejects(new Error('Start failed'));
        
        try {
            await serverManager.start();
            assert.fail('Should have thrown an error');
        } catch {
            assert.strictEqual(serverManager.getState(), ServerState.Stopped);
        }
    });
}); 