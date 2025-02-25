/* eslint-disable no-unused-vars */
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import axios, { AxiosError } from 'axios';
import { existsSync } from 'fs';

interface GitHubRelease {
    tag_name: string;
    name: string;
}

interface FileSystem {
    writeFile(path: string, data: Buffer): Promise<void>;
}

class VSCodeFileSystem implements FileSystem {
    async writeFile(path: string, data: Buffer): Promise<void> {
        await vscode.workspace.fs.writeFile(vscode.Uri.file(path), data);
    }
}

export class ProcessManager {
    private process: ChildProcess | null = null;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private startTimeout: NodeJS.Timeout | null = null;
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;
    private statusBarItem: vscode.StatusBarItem;
    private fileSystem: FileSystem;

    constructor(
        outputChannel: vscode.OutputChannel, 
        context: vscode.ExtensionContext, 
        fileSystem?: FileSystem,
        skipInitialChecks: boolean = false
    ) {
        this.outputChannel = outputChannel;
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.fileSystem = fileSystem || new VSCodeFileSystem();
        
        if (!skipInitialChecks) {
            this.checkForUpdates();  // Check once at startup

            // Check if JAR file exists
            const jarPath = this.getConfig<string>('jarPath');
            if (!jarPath || !existsSync(jarPath)) {
                this.downloadJar();
            }
        }
    }

    private getConfig<T>(key: string, defaultValue?: T): T {
        const processorConfig = vscode.workspace.getConfiguration('thymelab.processor');
        const resourcesConfig = vscode.workspace.getConfiguration('thymelab.resources');
        
        switch (key) {
            case 'jarPath':
            case 'javaHome':
            case 'port':
            case 'logLevel':
            case 'autoUpdate':
                return processorConfig.get<T>(key, defaultValue as T) as T;
            case 'templatePath':
            case 'staticPath':
            case 'dataPath':
                return resourcesConfig.get<T>(key, defaultValue as T) as T;
            default:
                return defaultValue as T;
        }
    }

    private get port(): number {
        return this.getConfig<number>('port', 8080);
    }

    private handleError(error: unknown, operation: string, showMessage: boolean = true): never {
        const message = error instanceof Error ? error.message : String(error);
        const fullMessage = `Failed to ${operation}: ${message}`;
        
        if (showMessage) {
            vscode.window.showErrorMessage(fullMessage);
        }
        throw new Error(fullMessage);
    }

    private cleanupResources(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
        }
        if (this.process) {
            this.process.removeAllListeners();
        }
    }

    private async cleanup(): Promise<void> {
        this.cleanupResources();
        
        if (this.process && this.process.pid) {
            const currentProcess = this.process;  // Store reference
            try {
                // Kill process tree on Windows
                if (process.platform === 'win32') {
                    await new Promise<void>((resolve) => {
                        const taskkill = spawn('taskkill', ['/F', '/T', '/PID', (currentProcess.pid as number).toString()]);
                        taskkill.on('close', () => resolve());
                        taskkill.on('error', () => {
                            // Fallback to normal kill if taskkill fails
                            currentProcess.kill('SIGTERM');
                            resolve();
                        });
                    });
                } else {
                    // On Unix-like systems, use SIGTERM followed by SIGKILL if needed
                    currentProcess.kill('SIGTERM');
                    
                    // Wait for process to exit gracefully
                    await new Promise<void>((resolve) => {
                        const timeout = setTimeout(() => {
                            currentProcess.kill('SIGKILL');
                            resolve();
                        }, 5000);  // Wait 5 seconds before force kill

                        currentProcess.once('exit', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    });
                }
            } catch (error) {
                this.outputChannel.appendLine(`Error during process cleanup: ${error}`);
            } finally {
                this.process = null;
            }
        }

        // Double check port is free
        try {
            await this.makeRequest('/actuator/health');
            // If request succeeds, port is still in use
            throw new Error('Process is still running on port ' + this.port);
        } catch (error) {
            // Port is free, which is what we want
            if (error instanceof Error && error.message.includes('Process is still running')) {
                throw error;
            }
        }
    }

    private async makeRequest<T, D = unknown>(url: string, options: { method: 'GET' | 'POST', data?: D } = { method: 'GET' }): Promise<T> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500);
        
        try {
            const response = await axios({
                url: `http://localhost:${this.port}${url}`,
                method: options.method,
                data: options.data,
                signal: controller.signal
            });
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                throw new Error(`Request failed: ${error.message}`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async performHealthCheck(): Promise<boolean> {
        try {
            const response = await this.makeRequest<{ status: string }>('/actuator/health');
            return response.status === 'UP';
        } catch {
            return false;
        }
    }

    private startHealthCheck(): void {
        this.cleanupResources();

        const checkHealth = async () => {
            const isHealthy = await this.performHealthCheck();
            if (isHealthy) {
                clearInterval(this.healthCheckInterval!);
                this.healthCheckInterval = setInterval(async () => {
                    if (!await this.performHealthCheck()) {
                        await this.cleanup();
                    }
                }, 2000);
            }
        };

        this.healthCheckInterval = setInterval(checkHealth, 1000);
    }

    async downloadJar(isUpdate: boolean = false): Promise<string> {
        const jarPath = this.getConfig<string>('jarPath');
        if (jarPath && existsSync(jarPath) && !isUpdate) {
            return jarPath;
        }

        try {
            if (!isUpdate && !jarPath) {
                const selection = await vscode.window.showInformationMessage(
                    'ThymeLab Processor JAR file not found. Please select a version to download.',
                    'Download'
                );
                if (!selection) {
                    throw new Error('Download cancelled');
                }
            }

            const releasesResponse = await axios.get<GitHubRelease[]>('https://api.github.com/repos/thkwag/thymelab/releases');
            const releases = releasesResponse.data.map(release => ({
                version: release.tag_name.replace(/^v/, ''),
                name: release.name || release.tag_name
            }));

            let version: string;
            if (isUpdate) {
                version = releases[0].version;  // Select latest version
            } else {
                const selected = await vscode.window.showQuickPick(
                    releases.map(r => ({
                        label: r.name,
                        description: `Version ${r.version}`,
                        version: r.version
                    })),
                    { placeHolder: 'Select version to download' }
                );
                if (!selected) {
                    throw new Error('Version selection cancelled');
                }
                version = selected.version;
            }

            const downloadUrl = `https://github.com/thkwag/thymelab/releases/download/v${version}/thymelab-processor-${version}.jar`;
            const globalStoragePath = vscode.Uri.joinPath(this.context.globalStorageUri, `thymelab-processor-${version}.jar`).fsPath;

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Downloading ThymeLab Processor v${version}`,
                cancellable: false
            }, async (progress) => {
                // Download JAR file
                const response = await axios({
                    url: downloadUrl,
                    method: 'GET',
                    responseType: 'arraybuffer',
                    onDownloadProgress: (progressEvent) => {
                        const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total!);
                        progress.report({ message: `${percentage}%`, increment: percentage });
                    }
                });

                if (!response.data) {
                    throw new Error('Failed to download JAR file: No data received');
                }

                await this.fileSystem.writeFile(globalStoragePath, Buffer.from(response.data));
            });

            return globalStoragePath;
        } catch (error) {
            this.handleError(error, 'download JAR file');
        }
    }

    async checkForUpdates(): Promise<void> {
        if (!this.getConfig<boolean>('autoUpdate', true)) {
            this.statusBarItem.hide();
            return;
        }

        try {
            const response = await axios.get<GitHubRelease[]>('https://api.github.com/repos/thkwag/thymelab/releases');
            if (!response?.data?.length) {
                return;
            }

            const latestVersion = response.data[0].tag_name.replace(/^v/, '');
            const jarPath = this.getConfig<string>('jarPath');
            if (!jarPath) {
                return;
            }

            const currentVersion = jarPath.match(/thymelab-processor-(.+)\.jar/)?.[1];
            if (!currentVersion || currentVersion !== latestVersion) {
                await this.showUpdateNotification(latestVersion);
            }
        } catch (error) {
            this.handleError(error, 'check for updates', false);
        }
    }

    private async showUpdateNotification(version: string): Promise<void> {
        const selection = await vscode.window.showInformationMessage(
            `New version of ThymeLab Processor is available: ${version}`,
            'Update',
            'Later'
        );

        if (selection === 'Update') {
            await this.downloadJar(true);
        }
    }

    async startServer(): Promise<void> {
        try {
            if (this.process) {
                throw new Error('Server is already running');
            }

            const jarPath = await this.downloadJar();
            const args = [
                '-Dserver.port=' + this.port,
                '-Dlogging.level.com.github.thkwag.thymelab=' + this.getConfig('logLevel', 'INFO'),
                '-Dspring.output.ansi.enabled=never',
                '-jar',
                jarPath
            ];

            const templatePath = this.getConfig<string>('templatePath');
            const staticPath = this.getConfig<string>('staticPath');
            const dataPath = this.getConfig<string>('dataPath');

            if (templatePath) args.push('--watch.directory.templates=' + templatePath);
            if (staticPath) args.push('--watch.directory.static=' + staticPath);
            if (dataPath) args.push('--watch.directory.thymeleaf-data=' + dataPath);

            const javaHome = this.getConfig<string>('javaHome');
            const javaPath = javaHome ? `${javaHome}/bin/java` : 'java';
            
            this.process = spawn(javaPath, args, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });

            this.process.stdout?.on('data', (data) => this.outputChannel.append(data.toString()));
            this.process.stderr?.on('data', (data) => this.outputChannel.append(data.toString()));
            this.process.on('close', () => this.cleanup());

            await new Promise<void>((resolve) => {
                const checkHealth = async () => {
                    try {
                        const isHealthy = await this.performHealthCheck();
                        if (isHealthy) {
                            resolve();
                            return;
                        }
                    } catch {
                        // Continue trying even if error occurs
                    }
                    setTimeout(checkHealth, 1000);
                };
                checkHealth();
            });

            this.startHealthCheck();
        } catch (error) {
            await this.cleanup();
            this.handleError(error, 'start server');
        }
    }

    async stopServer(): Promise<void> {
        try {
            if (!this.process) {
                throw new Error('Server is not running');
            }
            await this.cleanup();
        } catch (error) {
            this.handleError(error, 'stop server');
        }
    }

    async setLogLevel(level: string): Promise<void> {
        try {
            if (!this.process) {
                throw new Error('Server is not running');
            }
            await this.makeRequest('/actuator/loggers/com.github.thkwag.thymelab', {
                method: 'POST',
                data: { configuredLevel: level }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Failed to change log level: ${message}`);
        }
    }
} 