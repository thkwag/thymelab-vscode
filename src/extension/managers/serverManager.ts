import * as vscode from 'vscode';
import { ProcessManager } from './processManager';
import { ServerState } from '../types/serverState';
import { existsSync } from 'fs';

export class ServerManager {
    private processManager: ProcessManager;
    private outputChannel: vscode.OutputChannel;
    private currentState: ServerState = ServerState.Stopped;

    constructor(context: vscode.ExtensionContext, isTest: boolean = false) {
        this.outputChannel = vscode.window.createOutputChannel('ThymeLab Processor');
        this.processManager = new ProcessManager(this.outputChannel, context, undefined, isTest);

        // Add configuration change listener for auto update
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('thymelab.processor.autoUpdate')) {
                    this.checkForUpdates();
                }
            })
        );

        // Initial update check
        if (!isTest) {
            this.checkForUpdates();
        }
    }

    private async checkForUpdates(): Promise<void> {
        const config = vscode.workspace.getConfiguration('thymelab.processor');
        const autoUpdate = config.get<boolean>('autoUpdate', true);
        
        if (autoUpdate) {
            await this.processManager.checkForUpdates();
        }
    }

    private async setState(state: ServerState): Promise<void> {
        this.currentState = state;
        await vscode.commands.executeCommand('setContext', 'thymelab:isStarting', state === ServerState.Starting);
        await vscode.commands.executeCommand('setContext', 'thymelab:isRunning', state === ServerState.Running);
        vscode.commands.executeCommand('thymelab.refreshServer');
    }

    private validateRequiredDirectories(): string[] {
        const config = this.getConfig();
        const missingDirs = [];
        
        if (!config.templatePath) {
            missingDirs.push('Templates');
        }
        if (!config.staticPath) {
            missingDirs.push('Static Files');
        }
        if (!config.dataPath) {
            missingDirs.push('Data Files');
        }
        
        return missingDirs;
    }

    async start(): Promise<void> {
        try {
            // Check JAR file first
            const config = this.getConfig();
            if (!config.jarPath || !existsSync(config.jarPath)) {
                await this.processManager.downloadJar();
                return;
            }

            // Then check directories
            const missingDirs = this.validateRequiredDirectories();
            if (missingDirs.length > 0) {
                await vscode.window.showInformationMessage(
                    `Please select the following directories to start the server: ${missingDirs.join(', ')}`
                );
                return;
            }

            this.outputChannel.show();
            await this.setState(ServerState.Starting);
            await this.processManager.startServer();
            await this.setState(ServerState.Running);
        } catch (error) {
            await this.setState(ServerState.Stopped);
            throw error;
        }
    }

    async stop(): Promise<void> {
        this.outputChannel.show();
        await this.processManager.stopServer();
        await this.setState(ServerState.Stopped);
    }

    async restart(): Promise<void> {
        try {
            this.outputChannel.show();
            await this.setState(ServerState.Starting);
            await this.processManager.stopServer();
            await new Promise(resolve => setTimeout(resolve, 1000));

            const missingDirs = this.validateRequiredDirectories();
            if (missingDirs.length > 0) {
                await this.setState(ServerState.Stopped);
                await vscode.window.showInformationMessage(
                    `Please select the following directories to restart the server: ${missingDirs.join(', ')}`
                );
                return;
            }

            await this.processManager.startServer();
            await this.setState(ServerState.Running);
        } catch (error) {
            await this.setState(ServerState.Stopped);
            throw error;
        }
    }

    async changeLogLevel(level: string): Promise<void> {
        try {
            // Send log level change request to actuator if server is running
            if (this.currentState === ServerState.Running) {
                await this.processManager.setLogLevel(level);
            }
        } catch (error) {
            // Ignore error and only update settings
            console.error(`Failed to change server log level: ${error}`);
        }
    }

    getState(): ServerState {
        return this.currentState;
    }

    private getConfig() {
        const processorConfig = vscode.workspace.getConfiguration('thymelab.processor');
        const resourcesConfig = vscode.workspace.getConfiguration('thymelab.resources');
        return {
            jarPath: processorConfig.get<string>('jarPath', ''),
            javaHome: processorConfig.get<string>('javaHome', ''),
            port: processorConfig.get<number>('port', 8080),
            logLevel: processorConfig.get<string>('logLevel', 'INFO'),
            templatePath: resourcesConfig.get<string>('templatePath', ''),
            staticPath: resourcesConfig.get<string>('staticPath', ''),
            dataPath: resourcesConfig.get<string>('dataPath', '')
        };
    }

    async downloadJar(isUpdate: boolean = false): Promise<string> {
        return this.processManager.downloadJar(isUpdate);
    }
} 