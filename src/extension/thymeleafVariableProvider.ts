import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ThymeleafVariableParser } from './thymeleafVariableParser';

type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

interface VariableDefinition {
    file: vscode.Uri;
    line: number;
    character: number;
    value?: JsonValue;
}

interface PathInfo {
    workspaceFolder: vscode.WorkspaceFolder;
    templatePath: string;
    dataPath: string;
    targetFile: vscode.Uri;
    targetDir: vscode.Uri;
}

export class ThymeleafVariableProvider implements vscode.DefinitionProvider, vscode.CodeLensProvider {
    private variableCache: Map<string, VariableDefinition> = new Map();
    private lastCacheUpdate: number = 0;
    private readonly CACHE_TTL = 5000; // 5 seconds
    private statusBarItem!: vscode.StatusBarItem;
    private readonly parser: ThymeleafVariableParser;

    constructor() {
        this.parser = new ThymeleafVariableParser();
        this.setupEventListeners();
        this.setupStatusBarItem();
    }

    private setupEventListeners() {
        vscode.workspace.onDidCreateFiles(() => this.clearCache());
        vscode.workspace.onDidDeleteFiles(() => this.clearCache());
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.fileName.endsWith('.json')) {
                this.clearCache();
            }
        });
    }

    private setupStatusBarItem() {
        // Create a command to process variables
        vscode.commands.registerCommand('thymelab.generateVariablesButton', async () => {
            await this.processAllVariables();
        });
    }

    private clearCache() {
        this.variableCache.clear();
        this.lastCacheUpdate = 0;
    }

    async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | undefined> {
        const variableInfo = await this.findVariableAtPosition(document, position);
        if (variableInfo) {
            return new vscode.Location(
                variableInfo.file,
                new vscode.Position(variableInfo.line, variableInfo.character)
            );
        }
        return undefined;
    }

    private findVariableReferences(line: string): Array<{variable: string, startIndex: number, isIteratorVar: boolean}> {
        return this.parser.findVariableReferences(line);
    }

    private findIteratorVariables(text: string) {
        return this.parser.findIteratorVariables(text);
    }

    private findAllVariableMatches(line: string): Array<[string, string]> {
        return this.parser.findAllVariableMatches(line);
    }

    private async getPathInfo(document: vscode.TextDocument): Promise<PathInfo | undefined> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return undefined;

        const templatePath = vscode.workspace.getConfiguration('thymelab.resources').get<string>('templatePath') || '';
        const dataPath = vscode.workspace.getConfiguration('thymelab.resources').get<string>('dataPath') || '';
        
        if (!templatePath || !dataPath) return undefined;

        const fullPath = document.uri.fsPath;
        const workspacePath = workspaceFolder.uri.fsPath;
        const templateFullPath = path.join(workspacePath, templatePath);
        const relativePath = fullPath.substring(templateFullPath.length + 1);

        // Check if the file is a fragment or layout
        const content = document.getText();
        const isFragment = content.includes('th:fragment');
        const isLayout = content.includes('layout:fragment') || content.includes('layout:decorate');
        const shouldUseGlobalJson = isFragment || isLayout;

        let jsonPath;
        if (shouldUseGlobalJson) {
            // Use global.json for fragments and layouts
            jsonPath = 'global.json';
        } else {
            // Use file-specific json for regular templates
            jsonPath = relativePath.replace(/\.html$/, '.json');
        }
        
        const targetFile = vscode.Uri.joinPath(workspaceFolder.uri, dataPath, jsonPath);
        const targetDir = vscode.Uri.joinPath(targetFile, '..');

        return {
            workspaceFolder,
            templatePath,
            dataPath,
            targetFile,
            targetDir
        };
    }

    private async readJsonFile(targetFile: vscode.Uri): Promise<JsonObject> {
        try {
            const content = await vscode.workspace.fs.readFile(targetFile);
            const rawJson = JSON.parse(Buffer.from(content).toString('utf8'));
            return isJsonObject(rawJson) ? rawJson : {};
        } catch {
            return {};
        }
    }

    private async writeJsonFile(targetFile: vscode.Uri, json: JsonObject) {
        await vscode.workspace.fs.writeFile(
            targetFile,
            Buffer.from(JSON.stringify(json, null, 2), 'utf8')
        );
    }

    private async findVariableAtPosition(document: vscode.TextDocument, position: vscode.Position): Promise<VariableDefinition | undefined> {
        if (!document.fileName.endsWith('.html')) return undefined;

        const line = document.lineAt(position).text;
        const references = this.findVariableReferences(line);

        for (const {variable, startIndex, isIteratorVar} of references) {
            const endIndex = startIndex + variable.length;
            
            if (position.character >= startIndex && position.character <= endIndex) {
                const variableDef = await this.findVariableDefinition(variable);
                if (variableDef) {
                    return variableDef;
                } else if (!isIteratorVar) {
                    return await this.createVariableDefinition(variable);
                }
            }
        }

        return undefined;
    }

    private async findVariableDefinition(variable: string): Promise<VariableDefinition | undefined> {
        if (this.isCacheValid(variable)) {
            return this.variableCache.get(variable);
        }

        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor?.document.fileName.endsWith('.html')) return undefined;

        const pathInfo = await this.getPathInfo(activeEditor.document);
        if (!pathInfo) return undefined;

        try {
            const json = await this.readJsonFile(pathInfo.targetFile);
            const result = this.searchInJson(json, variable.split('.'), pathInfo.targetFile);
            if (result) {
                this.variableCache.set(variable, result);
                return result;
            }
        } catch (error) {
            console.error(`Error reading JSON file ${pathInfo.targetFile.fsPath}:`, error);
        }

        return undefined;
    }

    private isCacheValid(variable: string): boolean {
        return this.variableCache.has(variable) && Date.now() - this.lastCacheUpdate < this.CACHE_TTL;
    }

    private searchInJson(obj: JsonValue, path: string[], file: vscode.Uri, parentPath: string[] = []): VariableDefinition | undefined {
        if (path.length === 0) return undefined;

        const [current, ...rest] = path;
        
        if (Array.isArray(obj)) {
            return this.searchInJsonArray(obj, current, rest, file, parentPath);
        }

        if (!isJsonObject(obj)) return undefined;

        return this.searchInJsonObject(obj, current, rest, file, parentPath);
    }

    private searchInJsonArray(array: JsonValue[], current: string, rest: string[], file: vscode.Uri, parentPath: string[]): VariableDefinition | undefined {
        for (let i = 0; i < array.length; i++) {
            const item = array[i];
            if (isJsonObject(item) && current in item) {
                const value = item[current];
                if (rest.length === 0) {
                    return {
                        file,
                        line: this.findLineInJsonArray(file.fsPath, [...parentPath].join('.'), current, i),
                        character: 0,
                        value
                    };
                } else {
                    return this.searchInJson(value, rest, file, [...parentPath, `[${i}]`, current]);
                }
            }
        }
        return undefined;
    }

    private searchInJsonObject(obj: JsonObject, current: string, rest: string[], file: vscode.Uri, parentPath: string[]): VariableDefinition | undefined {
        for (const [key, value] of Object.entries(obj)) {
            if (key === current) {
                if (rest.length === 0) {
                    return {
                        file,
                        line: this.findLineInJson(file.fsPath, [...parentPath, key].join('.')),
                        character: 0,
                        value
                    };
                } else if (isJsonObject(value) || Array.isArray(value)) {
                    return this.searchInJson(value, rest, file, [...parentPath, key]);
                }
            } else if (isJsonObject(value) || Array.isArray(value)) {
                const result = this.searchInJson(value, rest, file, [...parentPath, key]);
                if (result) return result;
            }
        }
        return undefined;
    }

    private findLineInJson(filePath: string, targetPath: string): number {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`"${targetPath.split('.').pop()}":`)) {
                    return i;
                }
            }
        } catch (error) {
            console.error(`Error finding line in JSON file:`, error);
        }
        return 0;
    }

    private findLineInJsonArray(filePath: string, arrayPath: string, property: string, index: number): number {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            let bracketCount = 0;
            let inArray = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line.includes(`"${arrayPath}": [`)) {
                    inArray = true;
                    bracketCount = 1;
                    continue;
                }

                if (inArray) {
                    bracketCount += (line.match(/\[/g) || []).length;
                    bracketCount -= (line.match(/\]/g) || []).length;

                    if (line.includes('{')) {
                        index--;
                        if (index < 0) {
                            for (let j = i; j < lines.length; j++) {
                                if (lines[j].includes(`"${property}":`)) {
                                    return j;
                                }
                                if (lines[j].includes('}')) break;
                            }
                            break;
                        }
                    }

                    if (bracketCount === 0) break;
                }
            }
        } catch (error) {
            console.error(`Error finding line in JSON file:`, error);
        }
        return 0;
    }

    private async createVariableDefinition(variable: string): Promise<VariableDefinition | undefined> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor?.document.fileName.endsWith('.html')) return undefined;

        const pathInfo = await this.getPathInfo(activeEditor.document);
        if (!pathInfo) return undefined;

        try {
            await vscode.workspace.fs.createDirectory(pathInfo.targetDir);
            const json = await this.readJsonFile(pathInfo.targetFile);

            const iteratorInfo = this.findIteratorVariables(activeEditor.document.getText());
            const parts = variable.split('.');

            if (iteratorInfo.iteratorVars.has(parts[0])) {
                return await this.createArrayVariable(json, iteratorInfo.parentVars.get(parts[0])!, parts[0], parts.slice(1), activeEditor.document.getText(), pathInfo.targetFile);
            } else {
                return await this.createSimpleVariable(json, parts, pathInfo.targetFile);
            }
        } catch (error) {
            console.error('Error creating variable definition:', error);
            return undefined;
        }
    }

    private async createArrayVariable(json: JsonObject, arrayVar: string, iteratorVar: string, itemParts: string[], text: string, targetFile: vscode.Uri): Promise<VariableDefinition | undefined> {
        const arrayParts = arrayVar.split('.');
        let current = json;

        for (let i = 0; i < arrayParts.length - 1; i++) {
            if (!current[arrayParts[i]] || !isJsonObject(current[arrayParts[i]])) {
                current[arrayParts[i]] = {};
            }
            current = current[arrayParts[i]] as JsonObject;
        }

        const arrayKey = arrayParts[arrayParts.length - 1];
        if (!current[arrayKey]) {
            current[arrayKey] = [];
        } else if (!Array.isArray(current[arrayKey])) {
            current[arrayKey] = [];
        }

        const array = current[arrayKey] as JsonValue[];

        if (array.length === 0) {
            const newItem = this.createArrayItem(iteratorVar, text);
            array.push(newItem);
        }

        await this.writeJsonFile(targetFile, json);

        return {
            file: targetFile,
            line: this.findLineInJsonArray(targetFile.fsPath, arrayParts.join('.'), itemParts[itemParts.length - 1], 0),
            character: 0,
            value: ''
        };
    }

    private createArrayItem(iteratorVar: string, text: string): JsonObject {
        const newItem: JsonObject = {};
        const allProps = new Set<string>();
        
        // Find all properties used with this iterator
        const patterns = [
            // Direct property access
            new RegExp(`\\\${${iteratorVar}\\.([^}]+)}`, 'g'),
            // Properties in th:if conditions
            new RegExp(`th:if=["']\\\${${iteratorVar}\\.([^}"']+)}["']`, 'g'),
            // Properties in th:unless conditions
            new RegExp(`th:unless=["']\\\${${iteratorVar}\\.([^}"']+)}["']`, 'g'),
            // Properties in th:text
            new RegExp(`th:text=["']\\\${${iteratorVar}\\.([^}"']+)}["']`, 'g'),
            // Properties in th:utext
            new RegExp(`th:utext=["']\\\${${iteratorVar}\\.([^}"']+)}["']`, 'g'),
            // Properties in th:value
            new RegExp(`th:value=["']\\\${${iteratorVar}\\.([^}"']+)}["']`, 'g'),
            // Properties in th:field
            new RegExp(`th:field=["']\\\${${iteratorVar}\\.([^}"']+)}["']`, 'g'),
            // Properties in th:style
            new RegExp(`th:style=["'].*?\\\${${iteratorVar}\\.([^}]+)}.*?["']`, 'g'),
            // Properties in th:class
            new RegExp(`th:class=["'].*?\\\${${iteratorVar}\\.([^}]+)}.*?["']`, 'g'),
            // Properties in template literals
            new RegExp(`\\|[^|]*?\\\${${iteratorVar}\\.([^}]+)}[^|]*?\\|`, 'g')
        ];
        
        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const prop = match[1].trim();
                if (!prop.includes('(')) {  // Skip method calls
                    allProps.add(prop.split(/[\s+\-*/%?:!&|=<>]+/)[0]);
                }
            }
        }

        for (const prop of allProps) {
            let current = newItem;
            const propParts = prop.split('.');
            
            for (let i = 0; i < propParts.length - 1; i++) {
                if (!current[propParts[i]]) {
                    current[propParts[i]] = {};
                }
                current = current[propParts[i]] as JsonObject;
            }
            
            current[propParts[propParts.length - 1]] = '';
        }

        return newItem;
    }

    private async createSimpleVariable(json: JsonObject, parts: string[], targetFile: vscode.Uri): Promise<VariableDefinition | undefined> {
        let current = json;
        const last = parts.pop()!;

        for (const part of parts) {
            if (!current[part] || !isJsonObject(current[part])) {
                current[part] = {};
            }
            current = current[part] as JsonObject;
        }

        if (!current[last]) {
            current[last] = '';
            await this.writeJsonFile(targetFile, json);

            return {
                file: targetFile,
                line: this.findLineInJson(targetFile.fsPath, parts.concat(last).join('.')),
                character: 0,
                value: ''
            };
        }

        return undefined;
    }

    public async processAllVariables() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor?.document.fileName.endsWith('.html')) {
            vscode.window.showInformationMessage('Please open an HTML file first.');
            return;
        }

        const pathInfo = await this.getPathInfo(activeEditor.document);
        if (!pathInfo) return;

        try {
            await vscode.workspace.fs.createDirectory(pathInfo.targetDir);
            const json = await this.readJsonFile(pathInfo.targetFile);

            const text = activeEditor.document.getText();
            const iteratorInfo = this.findIteratorVariables(text);
            const allVariables = this.collectAllVariables(text, iteratorInfo.parentVars);

            await this.processVariables(json, allVariables, text, iteratorInfo.parentVars);
            await this.writeJsonFile(pathInfo.targetFile, json);

            const document = await vscode.workspace.openTextDocument(pathInfo.targetFile);
            await vscode.window.showTextDocument(document, { preview: false });

            vscode.window.showInformationMessage('All variables have been processed.');
        } catch (error) {
            console.error('Error updating JSON file:', error);
            vscode.window.showErrorMessage('Failed to process variables.');
        }
    }

    private collectAllVariables(text: string, iteratorMap: Map<string, string>): Set<string> {
        const allVariables = new Set<string>();
        const matches = this.parser.findAllVariableMatches(text);

        for (const [, variable] of matches) {
            const parts = variable.split('.');
            
            if (iteratorMap.has(parts[0])) {
                allVariables.add(iteratorMap.get(parts[0])!);
            } else {
                allVariables.add(variable);
            }
        }

        return allVariables;
    }

    private async processVariables(json: JsonObject, variables: Set<string>, text: string, iteratorMap: Map<string, string>) {
        for (const variable of variables) {
            const parts = variable.split('.');
            const iteratorVar = [...iteratorMap.entries()].find(([, v]) => v === variable)?.[0];
            
            if (iteratorVar) {
                const itemParts = parts.slice(1);
                const targetFile = await this.getTargetFile();
                if (targetFile) {
                    await this.createArrayVariable(json, variable, iteratorVar, itemParts, text, targetFile);
                }
            } else {
                await this.processSimpleVariable(json, parts);
            }
        }
    }

    private async getTargetFile(): Promise<vscode.Uri | undefined> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor?.document.fileName.endsWith('.html')) return undefined;

        const pathInfo = await this.getPathInfo(activeEditor.document);
        return pathInfo?.targetFile;
    }

    private async processSimpleVariable(json: JsonObject, parts: string[]) {
        let current = json;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]] || !isJsonObject(current[parts[i]])) {
                current[parts[i]] = {};
            }
            current = current[parts[i]] as JsonObject;
        }
        
        const last = parts[parts.length - 1];
        if (!current[last]) {
            current[last] = '';
        }
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        if (!document.fileName.endsWith('.html')) {
            return [];
        }

        const range = new vscode.Range(0, 0, 0, 0);
        return [
            new vscode.CodeLens(range, {
                title: '$(symbol-variable) Generate Thymeleaf Variables',
                command: 'thymelab.generateVariablesButton'
            })
        ];
    }
}

function isJsonObject(value: JsonValue): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
} 