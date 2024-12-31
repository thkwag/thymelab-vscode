import * as vscode from 'vscode';
import { ServerManager } from './serverManager';
import { ServerTreeDataProvider, ServerTreeItem } from './serverTreeDataProvider';
import { ResourcesTreeDataProvider } from './resourcesTreeDataProvider';
import { ThymeleafDefinitionProvider } from './thymeleafDefinitionProvider';
import { ThymeleafVariableProvider } from './thymeleafVariableProvider';

let serverManager: ServerManager;

export async function activate(context: vscode.ExtensionContext) {
    await vscode.commands.executeCommand('setContext', 'thymelab:isStarting', false);
    await vscode.commands.executeCommand('setContext', 'thymelab:isRunning', false);

    serverManager = new ServerManager(context);

    const serverTreeDataProvider = new ServerTreeDataProvider(serverManager);
    const resourcesTreeDataProvider = new ResourcesTreeDataProvider();

    // Add configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('thymelab.resources.templatePath') ||
                e.affectsConfiguration('thymelab.resources.staticPath') ||
                e.affectsConfiguration('thymelab.resources.dataPath')) {
                resourcesTreeDataProvider.refresh();
            }
        })
    );

    async function selectDirectory(title: string, configKey: string): Promise<void> {
        const uri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title,
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
            openLabel: 'Select Folder'
        });
        if (uri && uri[0]) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder is opened');
                return;
            }
            
            const selectedPath = uri[0].fsPath;
            const workspacePath = workspaceFolder.uri.fsPath;
            
            if (!selectedPath.startsWith(workspacePath)) {
                vscode.window.showErrorMessage('Selected folder must be inside the workspace');
                return;
            }

            const relativePath = vscode.workspace.asRelativePath(uri[0]);
            await vscode.workspace.getConfiguration('thymelab.resources').update(configKey, relativePath, vscode.ConfigurationTarget.Workspace);
            resourcesTreeDataProvider.refresh();
        }
    }

    // Register Thymeleaf Fragment Definition Provider
    const provider = new ThymeleafDefinitionProvider();
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'html' }, provider),
        vscode.languages.registerDocumentLinkProvider({ scheme: 'file', language: 'html' }, provider)
    );

    // Register Thymeleaf variable provider
    const variableProvider = new ThymeleafVariableProvider();
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { scheme: 'file', language: 'html' },
            variableProvider
        ),
        vscode.languages.registerCodeLensProvider(
            { scheme: 'file', language: 'html' },
            variableProvider
        ),
        vscode.commands.registerCommand('thymelab.processAllVariables', () => {
            variableProvider.processAllVariables();
        })
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('thymelab-server', serverTreeDataProvider),
        vscode.window.registerTreeDataProvider('thymelab-resources', resourcesTreeDataProvider),

        vscode.commands.registerCommand('thymelab.startServer', async () => {
            try {
                await serverManager.start();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start server: ${error}`);
            }
        }),

        vscode.commands.registerCommand('thymelab.stopServer', async () => {
            try {
                await serverManager.stop();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop server: ${error}`);
            }
        }),

        vscode.commands.registerCommand('thymelab.restartServer', async () => {
            try {
                await serverManager.restart();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restart server: ${error}`);
            }
        }),

        vscode.commands.registerCommand('thymelab.refreshServer', () => {
            serverTreeDataProvider.refresh();
        }),

        vscode.commands.registerCommand('thymelab.refreshResources', () => {
            resourcesTreeDataProvider.refresh();
        }),

        vscode.commands.registerCommand('thymelab.changeLogLevel', async () => {
            const levels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
            const level = await vscode.window.showQuickPick(levels, {
                placeHolder: 'Select log level'
            });
            if (level) {
                try {
                    await vscode.workspace.getConfiguration('thymelab.processor').update('logLevel', level, true);
                    await serverManager.changeLogLevel(level);
                    vscode.commands.executeCommand('thymelab.refreshServer');
                } catch (error) {
                    console.error(`Failed to change log level: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('thymelab.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'thymelab');
        }),

        vscode.commands.registerCommand('thymelab.setPort', async () => {
            const port = await vscode.window.showInputBox({
                prompt: 'Enter port number',
                placeHolder: '8080',
                validateInput: (value) => {
                    const port = parseInt(value);
                    if (isNaN(port) || port < 1 || port > 65535) {
                        return 'Please enter a valid port number (1-65535)';
                    }
                    return null;
                }
            });
            if (port) {
                await vscode.workspace.getConfiguration('thymelab.processor').update('port', parseInt(port), true);
                vscode.commands.executeCommand('thymelab.refreshServer');
            }
        }),

        vscode.commands.registerCommand('thymelab.openBrowser', async (uriOrItem?: vscode.Uri | ServerTreeItem) => {
            const port = vscode.workspace.getConfiguration('thymelab.processor').get<number>('port', 8080);
            let url: vscode.Uri;
            
            if (uriOrItem && 'command' in uriOrItem) {
                // Called from TreeItem
                url = uriOrItem.command!.arguments![0] as vscode.Uri;
            } else if (uriOrItem instanceof vscode.Uri) {
                // Direct URI passed
                url = uriOrItem;
            } else {
                // Default URL
                url = vscode.Uri.parse(`http://localhost:${port}`);
            }
            
            // Open in VS Code's right panel
            await vscode.commands.executeCommand('simpleBrowser.api.open', url.toString(), {
                viewColumn: vscode.ViewColumn.Two,
                preserveFocus: true
            });
        }),

        vscode.commands.registerCommand('thymelab.openExternalBrowser', async () => {
            const port = vscode.workspace.getConfiguration('thymelab.processor').get<number>('port', 8080);
            const url = vscode.Uri.parse(`http://localhost:${port}`);
            await vscode.env.openExternal(url);
        }),

        vscode.commands.registerCommand('thymelab.selectTemplateDir', () => selectDirectory('Select Template Directory', 'templatePath')),
        vscode.commands.registerCommand('thymelab.selectStaticDir', () => selectDirectory('Select Static Directory', 'staticPath')),
        vscode.commands.registerCommand('thymelab.selectDataDir', () => selectDirectory('Select Data Directory', 'dataPath')),

        vscode.commands.registerCommand('thymelab.updateProcessor', async (showNotification: () => Promise<void>) => {
            await showNotification();
        })
    );
}

export function deactivate() {
    if (serverManager) {
        return serverManager.stop();
    }
    return undefined;
} 