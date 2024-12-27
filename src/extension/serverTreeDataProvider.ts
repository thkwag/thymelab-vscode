import * as vscode from 'vscode';
import { ServerState } from './serverState';
import { ServerManager } from './serverManager';

export class ServerTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly contextValue?: string,
        public readonly customIcon?: vscode.ThemeIcon
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.command = command;
        this.contextValue = contextValue;
        this.iconPath = customIcon;

        if (label === 'URL') {
            this.tooltip = 'Click to open in browser';
        }
    }
}

export class ServerTreeDataProvider implements vscode.TreeDataProvider<ServerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ServerTreeItem | undefined | null | void> = new vscode.EventEmitter<ServerTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ServerTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private readonly serverManager: ServerManager;

    constructor(serverManager: ServerManager) {
        this.serverManager = serverManager;

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('thymelab.processor')) {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ServerTreeItem): vscode.TreeItem {
        return element;
    }

    private getStatusItem(): ServerTreeItem {
        const state = this.serverManager.getState();
        switch (state) {
            case ServerState.Starting:
                return new ServerTreeItem(
                    'Status',
                    'Starting... (Please wait)',
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    'server-starting',
                    new vscode.ThemeIcon('sync~spin')
                );
            case ServerState.Running:
                return new ServerTreeItem(
                    'Status',
                    'Running',
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    'server-running',
                    new vscode.ThemeIcon('pass-filled')
                );
            default:
                return new ServerTreeItem(
                    'Status',
                    'Stopped',
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    'server-stopped',
                    new vscode.ThemeIcon('circle-outline')
                );
        }
    }

    private getPortItem(port: number): ServerTreeItem {
        return new ServerTreeItem(
            'Port',
            port.toString(),
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'server-port',
            new vscode.ThemeIcon('symbol-number')
        );
    }

    private getLogLevelItem(logLevel: string): ServerTreeItem {
        return new ServerTreeItem(
            'Log Level',
            logLevel,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'server-log-level',
            new vscode.ThemeIcon('output')
        );
    }

    private getUrlItem(port: number): ServerTreeItem {
        const url = `http://localhost:${port}`;
        return new ServerTreeItem(
            'URL',
            url,
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'thymelab.openBrowser',
                title: 'Open in Browser',
                arguments: [vscode.Uri.parse(url)]
            },
            'server-url',
            new vscode.ThemeIcon('globe')
        );
    }

    async getChildren(element?: ServerTreeItem): Promise<ServerTreeItem[]> {
        if (!element) {
            const config = vscode.workspace.getConfiguration('thymelab.processor');
            const items: ServerTreeItem[] = [];

            // Server Status
            items.push(this.getStatusItem());

            // Log Level
            const logLevel = config.get<string>('logLevel', 'INFO');
            items.push(this.getLogLevelItem(logLevel));
            
            // Port
            const port = config.get<number>('port', 8080);
            items.push(this.getPortItem(port));

            // Server URL (only when running)
            if (this.serverManager.getState() === ServerState.Running) {
                items.push(this.getUrlItem(port));
            }

            return items;
        }
        return [];
    }
} 