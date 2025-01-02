/* eslint-disable @typescript-eslint/no-explicit-any */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { ServerTreeDataProvider, ServerTreeItem } from '../../../extension/providers/serverTreeDataProvider';
import { ServerManager } from '../../../extension/managers/serverManager';
import { ServerState } from '../../../extension/types/serverState';
import { createMockExtensionContext } from '../../testUtils/mockVscode';

suite('ServerTreeDataProvider Tests', () => {
    let provider: ServerTreeDataProvider;
    let serverManager: ServerManager;
    let disposables: vscode.Disposable[] = [];

    setup(() => {
        disposables = [];
        const mockContext = createMockExtensionContext();
        serverManager = new ServerManager(mockContext, true);
        provider = new ServerTreeDataProvider(serverManager);
    });

    teardown(() => {
        disposables.forEach(d => d.dispose());
        disposables = [];
    });

    suite('ServerTreeItem', () => {
        test('should create URL item with tooltip', () => {
            const item = new ServerTreeItem(
                'URL',
                'http://localhost:8080',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'thymelab.openBrowser',
                    title: 'Open in Browser',
                    arguments: [vscode.Uri.parse('http://localhost:8080')]
                },
                'server-url',
                new vscode.ThemeIcon('globe')
            );
            assert.strictEqual(item.tooltip, 'Click to open in browser');
        });

        test('should create non-URL item without tooltip', () => {
            const item = new ServerTreeItem(
                'Status',
                'Running',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'server-running',
                new vscode.ThemeIcon('pass-filled')
            );
            assert.strictEqual(item.tooltip, undefined);
        });
    });

    suite('TreeDataProvider', () => {
        test('should return status item with correct icon when server is stopped', async () => {
            const items = await provider.getChildren();
            const statusItem = items.find(item => item.label === 'Status');
            
            assert.ok(statusItem);
            assert.strictEqual(statusItem.description, 'Stopped');
            assert.strictEqual((statusItem.iconPath as vscode.ThemeIcon).id, 'circle-outline');
        });

        test('should return port item with correct value', async () => {
            const items = await provider.getChildren();
            const portItem = items.find(item => item.label === 'Port');
            
            assert.ok(portItem);
            assert.strictEqual((portItem.iconPath as vscode.ThemeIcon).id, 'symbol-number');
        });

        test('should return log level item with correct value', async () => {
            const items = await provider.getChildren();
            const logLevelItem = items.find(item => item.label === 'Log Level');
            
            assert.ok(logLevelItem);
            assert.strictEqual((logLevelItem.iconPath as vscode.ThemeIcon).id, 'output');
        });

        test('should return empty array for child elements', async () => {
            const statusItem = new ServerTreeItem(
                'Status',
                'Running',
                vscode.TreeItemCollapsibleState.None
            );
            const children = await provider.getChildren(statusItem);
            assert.strictEqual(children.length, 0);
        });
    });

    suite('Server State Changes', () => {
        test('should update tree view when server starts', async () => {
            let eventFired = false;
            const disposable = provider.onDidChangeTreeData(() => {
                eventFired = true;
            });

            // Simulate server start
            await (serverManager as any).setState(ServerState.Starting);
            provider.refresh();
            let items = await provider.getChildren();
            let statusItem = items.find(item => item.label === 'Status');
            assert.strictEqual(statusItem?.description, 'Starting... (Please wait)');
            assert.strictEqual((statusItem?.iconPath as vscode.ThemeIcon).id, 'sync~spin');

            // Change to running state
            await (serverManager as any).setState(ServerState.Running);
            provider.refresh();
            items = await provider.getChildren();
            statusItem = items.find(item => item.label === 'Status');
            assert.strictEqual(statusItem?.description, 'Running');
            assert.strictEqual((statusItem?.iconPath as vscode.ThemeIcon).id, 'pass-filled');

            // Check if URL item is displayed
            const urlItem = items.find(item => item.label === 'URL');
            assert.ok(urlItem, 'URL item should be present when server is running');

            assert.ok(eventFired, 'Tree data change event should be fired on server state change');
            disposable.dispose();
        });

        test('should update tree view when server stops', async () => {
            let eventFired = false;
            const disposable = provider.onDidChangeTreeData(() => {
                eventFired = true;
            });

            // Set server to running state
            await (serverManager as any).setState(ServerState.Running);
            provider.refresh();
            let items = await provider.getChildren();
            let statusItem = items.find(item => item.label === 'Status');
            assert.strictEqual(statusItem?.description, 'Running');

            // Stop server
            await (serverManager as any).setState(ServerState.Stopped);
            provider.refresh();
            items = await provider.getChildren();
            statusItem = items.find(item => item.label === 'Status');
            assert.strictEqual(statusItem?.description, 'Stopped');
            assert.strictEqual((statusItem?.iconPath as vscode.ThemeIcon).id, 'circle-outline');

            // Check if URL item is removed
            const urlItem = items.find(item => item.label === 'URL');
            assert.ok(!urlItem, 'URL item should not be present when server is stopped');

            assert.ok(eventFired, 'Tree data change event should be fired on server state change');
            disposable.dispose();
        });

        test('should handle server start failure', async () => {
            let eventFired = false;
            const disposable = provider.onDidChangeTreeData(() => {
                eventFired = true;
            });

            // Attempt to start server
            await (serverManager as any).setState(ServerState.Starting);
            provider.refresh();
            let items = await provider.getChildren();
            let statusItem = items.find(item => item.label === 'Status');
            assert.strictEqual(statusItem?.description, 'Starting... (Please wait)');

            // Server start failure (returns to stopped state)
            await (serverManager as any).setState(ServerState.Stopped);
            provider.refresh();
            items = await provider.getChildren();
            statusItem = items.find(item => item.label === 'Status');
            assert.strictEqual(statusItem?.description, 'Stopped');
            assert.strictEqual((statusItem?.iconPath as vscode.ThemeIcon).id, 'circle-outline');

            assert.ok(eventFired, 'Tree data change event should be fired on server state change');
            disposable.dispose();
        });
    });

    suite('Event Handling', () => {
        test('should fire tree data change event on refresh', () => {
            let eventFired = false;
            const disposable = provider.onDidChangeTreeData(() => {
                eventFired = true;
            });

            provider.refresh();
            assert.ok(eventFired, 'Tree data change event should be fired');
            disposable.dispose();
        });

        test('should handle configuration changes', async () => {
            let eventFired = false;
            const disposable = provider.onDidChangeTreeData(() => {
                eventFired = true;
            });

            // Simulate configuration change
            provider.refresh();
            
            assert.ok(eventFired, 'Tree data change event should be fired on configuration change');
            disposable.dispose();
        });
    });
}); 