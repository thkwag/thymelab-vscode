import * as vscode from 'vscode';
import * as path from 'path';

export class ResourceTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourcePath?: string,
        public readonly command?: vscode.Command,
        public readonly contextValue?: string,
        public readonly isDirectory: boolean = true
    ) {
        super(label, collapsibleState);
        this.description = description || '';
        this.command = command;
        this.contextValue = contextValue;
        
        // Show warning icon for unselected folders
        if (isDirectory && !resourcePath) {
            this.iconPath = new vscode.ThemeIcon('warning');
        } else {
            this.iconPath = new vscode.ThemeIcon(isDirectory ? 'folder' : 'file');
        }
        
        if (resourcePath) {
            this.tooltip = resourcePath;
            this.resourceUri = vscode.Uri.file(resourcePath);
        } else if (isDirectory) {
            this.tooltip = 'Folder not selected';
        }
    }
}

export class ResourcesTreeDataProvider implements vscode.TreeDataProvider<ResourceTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ResourceTreeItem | undefined | null | void> = new vscode.EventEmitter<ResourceTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ResourceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private fileSystemWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        // Watch for configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('thymelab.resources')) {
                    this.refresh();
                    this.setupFileSystemWatcher();
                }
            })
        );

        this.setupFileSystemWatcher();
        this.registerCommands();
    }

    private registerCommands(): void {
        this.disposables.push(
            vscode.commands.registerCommand('thymelab.resources.createFile', async (item: ResourceTreeItem) => {
                if (!item.resourcePath) return;
                
                const fileName = await vscode.window.showInputBox({
                    prompt: 'Enter file name',
                    validateInput: text => {
                        return text && !text.includes('/') && !text.includes('\\') 
                            ? null 
                            : 'Invalid file name';
                    }
                });
                
                if (fileName) {
                    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
                    if (!workspaceRoot) return;

                    const filePath = vscode.Uri.joinPath(workspaceRoot, item.resourcePath, fileName);
                    await vscode.workspace.fs.writeFile(filePath, new Uint8Array());
                    await vscode.commands.executeCommand('vscode.open', filePath);
                }
            }),

            vscode.commands.registerCommand('thymelab.resources.createFolder', async (item: ResourceTreeItem) => {
                if (!item.resourcePath) return;
                
                const folderName = await vscode.window.showInputBox({
                    prompt: 'Enter folder name',
                    validateInput: text => {
                        return text && !text.includes('/') && !text.includes('\\') 
                            ? null 
                            : 'Invalid folder name';
                    }
                });
                
                if (folderName) {
                    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
                    if (!workspaceRoot) return;

                    const folderPath = vscode.Uri.joinPath(workspaceRoot, item.resourcePath, folderName);
                    await vscode.workspace.fs.createDirectory(folderPath);
                }
            }),

            vscode.commands.registerCommand('thymelab.resources.rename', async (item: ResourceTreeItem) => {
                if (!item.resourcePath) return;
                
                const oldName = path.basename(item.resourcePath);
                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter new name',
                    value: oldName,
                    validateInput: text => {
                        return text && !text.includes('/') && !text.includes('\\') 
                            ? null 
                            : 'Invalid name';
                    }
                });
                
                if (newName && newName !== oldName) {
                    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
                    if (!workspaceRoot) return;

                    const oldPath = vscode.Uri.joinPath(workspaceRoot, item.resourcePath);
                    const newPath = vscode.Uri.joinPath(oldPath.with({ path: path.dirname(oldPath.path) }), newName);
                    await vscode.workspace.fs.rename(oldPath, newPath);
                }
            }),

            vscode.commands.registerCommand('thymelab.resources.delete', async (item: ResourceTreeItem) => {
                if (!item.resourcePath) return;
                
                const fileName = path.basename(item.resourcePath);
                const type = item.isDirectory ? 'folder' : 'file';
                const answer = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete ${type} '${fileName}'?`,
                    { modal: true },
                    'Delete'
                );
                
                if (answer === 'Delete') {
                    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
                    if (!workspaceRoot) return;

                    const resourcePath = vscode.Uri.joinPath(workspaceRoot, item.resourcePath);
                    await vscode.workspace.fs.delete(resourcePath, { recursive: true });
                }
            })
        );
    }

    private setupFileSystemWatcher(): void {
        // Dispose old watcher if exists
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) return;

        const config = vscode.workspace.getConfiguration('thymelab.resources');
        const paths = [
            config.get<string>('templatePath'),
            config.get<string>('staticPath'),
            config.get<string>('dataPath')
        ].filter(Boolean) as string[];

        if (paths.length === 0) return;

        // Create pattern for all resource directories
        const pattern = new vscode.RelativePattern(
            workspaceRoot,
            `{${paths.join(',')}}/**`
        );

        // Setup new watcher
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        // Watch for all file system events
        this.disposables.push(
            this.fileSystemWatcher.onDidCreate(() => this.refresh()),
            this.fileSystemWatcher.onDidDelete(() => this.refresh()),
            this.fileSystemWatcher.onDidChange(() => this.refresh())
        );

        this.disposables.push(this.fileSystemWatcher);
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ResourceTreeItem): vscode.TreeItem {
        return element;
    }

    private createResourceItem(label: string, path: string): ResourceTreeItem {
        let contextValue;
        if (label === 'Templates') {
            contextValue = 'template-dir';
        } else if (label === 'Static Files') {
            contextValue = 'static-dir';
        } else if (label === 'Data Files') {
            contextValue = 'data-dir';
        }

        return new ResourceTreeItem(
            label,
            path || '',
            path ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
            path,
            undefined,
            contextValue
        );
    }

    private async getResourceEntries(fullPath: vscode.Uri): Promise<[string, vscode.FileType][]> {
        try {
            return await vscode.workspace.fs.readDirectory(fullPath);
        } catch {
            return [];
        }
    }

    private createFileSystemItem(
        name: string,
        relativePath: string,
        fullPath: vscode.Uri,
        isDirectory: boolean
    ): ResourceTreeItem {
        return new ResourceTreeItem(
            name,
            '',
            isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            relativePath,
            isDirectory ? undefined : {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.joinPath(fullPath, name)]
            },
            isDirectory ? 'directory' : 'file',
            isDirectory
        );
    }

    async getChildren(element?: ResourceTreeItem): Promise<ResourceTreeItem[]> {
        if (!element) {
            const config = vscode.workspace.getConfiguration('thymelab.resources');
            return [
                this.createResourceItem('Templates', config.get<string>('templatePath') || ''),
                this.createResourceItem('Static Files', config.get<string>('staticPath') || ''),
                this.createResourceItem('Data Files', config.get<string>('dataPath') || '')
            ];
        }

        if (!element.resourcePath) {
            return [];
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) {
            return [];
        }

        const fullPath = vscode.Uri.joinPath(workspaceRoot, element.resourcePath);
        const entries = await this.getResourceEntries(fullPath);

        return entries
            .map(([name, type]) => {
                const relativePath = vscode.workspace.asRelativePath(vscode.Uri.joinPath(fullPath, name));
                const isDirectory = (type & vscode.FileType.Directory) !== 0;
                return this.createFileSystemItem(name, relativePath, fullPath, isDirectory);
            })
            .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.label.localeCompare(b.label);
            });
    }
} 