import * as path from 'path';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';

async function main() {
    try {
        // Suppress unnecessary messages and warnings
        process.env.ELECTRON_DISABLE_GPU = '1';
        process.env.ELECTRON_NO_ATTACH_CONSOLE = '1';
        process.env.ELECTRON_ENABLE_LOGGING = '0';
        process.env.NODE_NO_WARNINGS = '1';
        process.env.VSCODE_SKIP_BUILTIN_EXTENSION_LOAD = '1';

        const vscodeExecutablePath = await downloadAndUnzipVSCode();
        const [, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, '../../dist/test/suite/index');

        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                ...args,
                '--disable-extensions',
                '--disable-gpu',
                '--disable-updates',
                '--skip-welcome',
                '--skip-release-notes',
                '--disable-workspace-trust',
                '--disable-telemetry',
                '--no-sandbox',
                '--disable-crash-reporter'
            ]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main(); 