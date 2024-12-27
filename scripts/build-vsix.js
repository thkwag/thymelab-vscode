/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require('os');
const { execSync } = require('child_process');
const { readFileSync, rmSync, mkdirSync } = require('fs');
const { join } = require('path');

const rootDir = join(__dirname, '..');
const buildDir = join(rootDir, 'build');

// Clean and create build directory
console.log('Cleaning build directory...');
rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });

// Get version and build vsix
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json')));
const version = packageJson.version;

const isWin = os.platform() === 'win32';
const versionStr = isWin ? '%npm_package_version%' : version;
const cmd = `vsce package -o build/thymelab-vscode-${versionStr}.vsix`;

console.log(`Building vsix package (version: ${version})...`);
const output = execSync(cmd, { encoding: 'utf8' });
console.log(output); 