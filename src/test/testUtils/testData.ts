/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode';

export interface TestServerConfig {
    port: number;
    logLevel: string;
    jarPath?: string;
    autoUpdate?: boolean;
}

export const DEFAULT_TEST_CONFIG: TestServerConfig = {
    port: 8080,
    logLevel: 'INFO',
    autoUpdate: false
};

export function createTestUri(path: string): vscode.Uri {
    return vscode.Uri.file(path);
}

export function createTestWorkspaceFolder(name: string = 'test-workspace'): vscode.WorkspaceFolder {
    return {
        uri: createTestUri(`/workspace/${name}`),
        name,
        index: 0
    };
}

export function createTestServerOutput(
    type: 'start' | 'stop' | 'error',
    config: TestServerConfig = DEFAULT_TEST_CONFIG
): string {
    switch (type) {
        case 'start':
            return `Server started on port ${config.port}`;
        case 'stop':
            return 'Server stopped';
        case 'error':
            return 'Error starting server';
        default:
            return '';
    }
}

export function createTestProcessOutput(
    type: 'stdout' | 'stderr',
    message: string
): {event: string, data: Buffer} {
    return {
        event: type,
        data: Buffer.from(message)
    };
}

export function createTestJarContent(): Buffer {
    return Buffer.from('mock jar content');
}

export function createTestReleaseData(version: string = '1.0.0'): any {
    return {
        tag_name: version,
        assets: [{
            name: `thymelab-processor-${version}.jar`,
            browser_download_url: `https://example.com/thymelab-processor-${version}.jar`
        }]
    };
} 