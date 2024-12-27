# ThymeLab VSCode Extension Development Guide

This document describes the complete process from setting up the development environment to building the ThymeLab VSCode Extension.

## 1. Initial Project Setup

### 1.1 Prerequisites
- Node.js (v18 or higher)
- npm (comes with Node.js)
- Visual Studio Code
- Java Development Kit (JDK) 11 or higher
- VS Code Extension Manager (vsce):
  ```bash
  npm install -g @vscode/vsce
  ```

### 1.2 Project Clone
```bash
git clone https://github.com/thkwag/thymelab-vscode.git
cd thymelab-vscode
```

## 2. Development Environment Setup

### 2.1 Install Dependencies
```bash
npm install
```

Key dependencies:
- `@types/vscode`: VS Code API type definitions
- `typescript`: TypeScript compiler
- `webpack`: Module bundler
- `ts-loader`: TypeScript loader
- `axios`: HTTP client
- `minimatch`: File pattern matching

### 2.2 VS Code Configuration
Check the following settings in `.vscode/launch.json`:
- `Run VSCode Extension`: Run the extension
- `Debug ThymeLab Processor`: Debug Java processor
- `Extension + Server`: Run both extension and server simultaneously

## 3. Development

### 3.1 TypeScript Compilation
```bash
npm run compile  # Single compilation
npm run watch   # Watch mode for automatic compilation
```

### 3.2 Linting
```bash
npm run lint
```

### 3.3 Testing
1. Open the extension in VS Code
2. Press F5 to start debugging
3. A new VS Code window will open with the extension loaded
4. Use the extension and check the Debug Console for logs

### 3.4 Debugging
1. Set breakpoints in the TypeScript files
2. Use the Debug Console to inspect variables
3. Use the Debug toolbar to control execution
4. Check Output panel for extension logs

## 4. Build and Packaging

### 4.1 Project Build
1. TypeScript compilation:
```bash
npm run compile
```

2. Webpack bundling:
```bash
npx webpack --config webpack.config.js
```

### 4.2 VSIX Package Creation
```bash
npm run package
```
This command:
1. Creates build directory if it doesn't exist
2. Compiles TypeScript code
3. Creates VSIX package
4. Moves the generated VSIX file to the `build` folder

The generated VSIX file can be found at `build/thymelab-[version].vsix`.

## 5. Directory Structure
```
thymelab-vscode/
├── src/              # Source code
│   ├── extension/    # VS Code extension core code
│   └── test/         # Test code
├── dist/             # Compiled JavaScript files
├── build/            # Build artifacts (VSIX)
├── resources/        # Resource files
├── docs/            # Documentation
└── syntaxes/         # Syntax definitions
```

## 6. Important Notes
- `dist` folder contains compiled JavaScript files
- `build` folder contains the final VSIX package
- Remember to update the version field in `package.json` when updating the version
- Always test the extension in a new VS Code window before packaging
- Check the extension logs in the Output panel for debugging
- Use ESLint for code style consistency

## 7. Release Process

### 7.1 Preparing for Release
1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run all tests and ensure they pass
4. Build and test the extension locally

### 7.2 Creating a Release
1. Create a new tag:
   ```bash
   git tag v1.x.x
   git push origin v1.x.x
   ```
2. Create a new release on GitHub
3. Attach the VSIX file to the release
4. Update the release notes

### 7.3 Publishing to Marketplace
1. Ensure you have a Microsoft account
2. Get a Personal Access Token from Azure DevOps
3. Publish using vsce:
   ```bash
   vsce publish
   ```

## 8. Troubleshooting

### 8.1 Common Issues
1. **Build Failures**
   - Check Node.js version
   - Delete node_modules and reinstall
   - Clear the VS Code extension development host

2. **Runtime Errors**
   - Check the Debug Console
   - Check the Output panel
   - Verify Java version and path

3. **Packaging Issues**
   - Ensure vsce is installed globally
   - Check package.json for errors
   - Verify all required files are included 