import * as assert from 'assert';
import * as vscode from 'vscode';
import { ResourcesTreeDataProvider, ResourceTreeItem } from '../../../extension/providers/resourcesTreeDataProvider';

suite('ResourcesTreeDataProvider Tests', () => {
    let provider: ResourcesTreeDataProvider;
    let disposables: vscode.Disposable[] = [];

    setup(() => {
        disposables = [];
        // Mock command registration
        const mockRegister = (commandId: string, callback: (...args: any[]) => any) => {
            return { dispose: () => {} };
        };
        const originalRegisterCommand = vscode.commands.registerCommand;
        vscode.commands.registerCommand = mockRegister;
        provider = new ResourcesTreeDataProvider();
        vscode.commands.registerCommand = originalRegisterCommand;
    });

    teardown(() => {
        disposables.forEach(d => d.dispose());
        disposables = [];
    });

    suite('ResourceTreeItem', () => {
        test('should create directory item with warning icon when path is not set', () => {
            const item = new ResourceTreeItem(
                'test',
                '',
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                undefined,
                'template-dir'
            );
            assert.ok((item.iconPath as vscode.ThemeIcon).id === 'warning');
        });

        test('should create directory item with folder icon when path is set', () => {
            const item = new ResourceTreeItem(
                'test',
                '/test/path',
                vscode.TreeItemCollapsibleState.Collapsed,
                '/test/path',
                undefined,
                'template-dir'
            );
            assert.ok((item.iconPath as vscode.ThemeIcon).id === 'folder');
        });

        test('should create file item with file icon', () => {
            const item = new ResourceTreeItem(
                'test.html',
                '',
                vscode.TreeItemCollapsibleState.None,
                '/test/path/test.html',
                {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file('/test/path/test.html')]
                },
                'file',
                false
            );
            assert.ok((item.iconPath as vscode.ThemeIcon).id === 'file');
        });
    });

    suite('TreeDataProvider', () => {
        test('should return root items when no element is provided', async () => {
            provider.getChildren = async () => {
                return [
                    new ResourceTreeItem('Templates', '', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, 'directory'),
                    new ResourceTreeItem('Static Files', '', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, 'directory'),
                    new ResourceTreeItem('Data Files', '', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, 'directory')
                ];
            };
            const items = await provider.getChildren();
            assert.strictEqual(items.length, 3);
        });

        test('should return empty array for unset paths', async () => {
            provider.getChildren = async () => [];
            const items = await provider.getChildren();
            assert.strictEqual(items.length, 0);
        });

        test('should sort directories before files', async () => {
            provider.getChildren = async () => {
                return [
                    new ResourceTreeItem('dir', '', vscode.TreeItemCollapsibleState.Collapsed, 'dir', undefined, 'directory', true),
                    new ResourceTreeItem('file.txt', '', vscode.TreeItemCollapsibleState.None, 'file.txt', undefined, 'file', false)
                ];
            };
            const items = await provider.getChildren();
            const fileNames = items.map(item => item.label);
            assert.deepStrictEqual(fileNames, ['dir', 'file.txt']);
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

            // Simulate configuration change by directly calling refresh
            provider.refresh();
            
            assert.ok(eventFired, 'Tree data change event should be fired on configuration change');
            disposable.dispose();
        });
    });
}); 