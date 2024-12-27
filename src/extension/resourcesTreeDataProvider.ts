import * as vscode from 'vscode';

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
        this.iconPath = new vscode.ThemeIcon(isDirectory ? 'folder' : 'file');
        
        if (resourcePath) {
            this.tooltip = resourcePath;
            this.resourceUri = vscode.Uri.file(resourcePath);
        }
    }
}

export class ResourcesTreeDataProvider implements vscode.TreeDataProvider<ResourceTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ResourceTreeItem | undefined | null | void> = new vscode.EventEmitter<ResourceTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ResourceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

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