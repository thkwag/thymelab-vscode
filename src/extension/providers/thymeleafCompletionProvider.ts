import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface ThymeleafVariable {
    name: string;
    type: string;
    children?: ThymeleafVariable[];
    source?: 'global' | 'template';
}

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

export class ThymeleafCompletionProvider implements vscode.CompletionItemProvider {
    private variableCache: Map<string, ThymeleafVariable[]> = new Map();
    private iteratorCache: Map<string, string> = new Map(); // key: iterator variable, value: collection variable
    private currentFilePath: string | undefined;

    constructor() {
        this.setupEventListeners();
    }

    private setupEventListeners() {
        vscode.workspace.onDidChangeTextDocument(() => this.clearCache());
        vscode.workspace.onDidCreateFiles(() => this.clearCache());
        vscode.workspace.onDidDeleteFiles(() => this.clearCache());
    }

    private clearCache() {
        this.variableCache.clear();
        this.iteratorCache.clear();
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.CompletionItem[] | undefined> {
        const line = document.lineAt(position).text;
        const linePrefix = line.substring(0, position.character);

        // Check for Thymeleaf variable expression
        if (!this.isThymeleafVariableExpression(linePrefix)) {
            return undefined;
        }

        // Load variables from current file
        const variables = await this.loadVariables(document);
        
        // Analyze variable path
        const { prefix, parentVariable } = this.analyzeVariablePath(linePrefix);

        // Handle iterator variables
        if (parentVariable && this.iteratorCache.has(parentVariable)) {
            const collectionVar = this.iteratorCache.get(parentVariable)!;
            const collectionVarObj = this.findVariable(variables, collectionVar);
            if (collectionVarObj?.children) {
                return this.createCompletionItems(collectionVarObj.children, prefix);
            }
        }

        // Handle regular variables
        if (parentVariable) {
            const parentVar = this.findVariable(variables, parentVariable);
            if (parentVar?.children) {
                return this.createCompletionItems(parentVar.children, prefix);
            }
        }

        // Return top-level variables
        return this.createCompletionItems(variables, prefix);
    }

    private isThymeleafVariableExpression(linePrefix: string): boolean {
        // Simple check for expression start
        return linePrefix.endsWith('${') || 
               linePrefix.endsWith('[[${') || 
               linePrefix.endsWith('[(${') ||
               linePrefix.includes('${') || 
               linePrefix.includes('[[${') || 
               linePrefix.includes('[(${');
    }

    private analyzeVariablePath(linePrefix: string): { prefix: string; parentVariable: string | null } {
        let match = linePrefix.match(/\[\[\${([^}]*)$/) || 
                   linePrefix.match(/\[\(\${([^}]*)$/) ||
                   linePrefix.match(/\${([^}]*)$/);
        
        if (!match) {
            // Try to match completed expressions
            match = linePrefix.match(/\[\[\${([^}]*)}?\]?\]?$/) || 
                   linePrefix.match(/\[\(\${([^}]*)}?\]?\)?$/) ||
                   linePrefix.match(/\${([^}]*)}?$/);
            
            if (!match) {
                return { prefix: '', parentVariable: null };
            }
        }

        const variablePath = match[1].trim();
        if (!variablePath) {
            return { prefix: '', parentVariable: null };
        }

        const parts = variablePath.split('.');
        const prefix = parts[parts.length - 1];
        const parentVariable = parts.length > 1 ? parts.slice(0, -1).join('.') : null;

        return { prefix, parentVariable };
    }

    private getConfiguredPath(workspaceFolder: vscode.WorkspaceFolder, pathType: 'templatePath' | 'dataPath' | 'staticPath'): string {
        const configPath = vscode.workspace.getConfiguration('thymelab.resources').get<string>(pathType, '');
        return configPath ? path.join(workspaceFolder.uri.fsPath, configPath) : '';
    }

    private async loadVariables(document: vscode.TextDocument): Promise<ThymeleafVariable[]> {
        this.currentFilePath = document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return [];
        }

        const templatePath = this.getConfiguredPath(workspaceFolder, 'templatePath');
        const dataPath = this.getConfiguredPath(workspaceFolder, 'dataPath');
        if (!templatePath || !dataPath) {
            console.error('Template or data path not configured');
            return [];
        }

        const documentRelativePath = path.relative(templatePath, document.uri.fsPath);
        const templateDir = path.dirname(documentRelativePath);
        const templateName = path.basename(documentRelativePath, '.html');

        // Return cached variables if available
        const cacheKey = documentRelativePath;
        if (this.variableCache.has(cacheKey)) {
            return this.variableCache.get(cacheKey)!;
        }

        const variables: ThymeleafVariable[] = [];

        // Load global.json
        const globalJsonPath = path.join(dataPath, 'global.json');
        if (fs.existsSync(globalJsonPath)) {
            try {
                const globalJson = JSON.parse(fs.readFileSync(globalJsonPath, 'utf-8'));
                variables.push(...this.convertJsonToVariables(globalJson, '', 'global'));
            } catch (error) {
                console.error('Error loading global.json:', error);
            }
        }

        // Load current file's variables
        const fileJsonPath = path.join(dataPath, templateDir, `${templateName}.json`);
        if (fs.existsSync(fileJsonPath)) {
            try {
                const fileJson = JSON.parse(fs.readFileSync(fileJsonPath, 'utf-8'));
                variables.push(...this.convertJsonToVariables(fileJson, '', 'template'));
            } catch (error) {
                console.error(`Error loading ${fileJsonPath}:`, error);
            }
        }

        // Update iterator cache
        this.updateIteratorCache(document.getText());

        // Update variable cache
        this.variableCache.set(cacheKey, variables);

        return variables;
    }

    private convertJsonToVariables(json: JsonObject, parentPath: string = '', source?: 'global' | 'template'): ThymeleafVariable[] {
        const variables: ThymeleafVariable[] = [];

        for (const [key, value] of Object.entries(json)) {
            const varName = parentPath ? `${parentPath}.${key}` : key;
            const variable: ThymeleafVariable = {
                name: varName,
                type: Array.isArray(value) ? 'array' : typeof value,
                source
            };

            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                        variable.children = this.convertJsonToVariables(value[0] as JsonObject, '', source);
                    }
                } else {
                    variable.children = this.convertJsonToVariables(value as JsonObject, varName, source);
                }
            }

            variables.push(variable);
        }

        return variables;
    }

    private updateIteratorCache(text: string) {
        const iteratorRegex = /th:each="(\w+)\s*:\s*\${([^}]+)}"/g;
        let match;

        while ((match = iteratorRegex.exec(text)) !== null) {
            const [, iterator, collection] = match;
            this.iteratorCache.set(iterator, collection);
        }
    }

    private findVariable(variables: ThymeleafVariable[], path: string): ThymeleafVariable | undefined {
        const parts = path.split('.');
        let current: ThymeleafVariable | undefined;

        for (const part of parts) {
            if (!current) {
                current = variables.find(v => v.name === part);
            } else {
                current = current.children?.find(v => v.name.endsWith(part));
            }

            if (!current) {
                return undefined;
            }
        }

        return current;
    }

    private createSectionLabel(label: string, sortText: string): vscode.CompletionItem {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Folder);
        item.sortText = sortText;
        item.insertText = ''; // Prevent insertion
        item.command = { command: '', title: '' }; // Disable selection
        return item;
    }

    private createCompletionItems(variables: ThymeleafVariable[], prefix: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const globalVars = variables.filter(v => v.source === 'global');
        const templateVars = variables.filter(v => v.source === 'template');

        if (globalVars.length > 0) {
            items.push(this.createSectionLabel('<<Global Variables>>', '0'));
            items.push(...this.createVariableItems(globalVars, prefix, '1', 'global.json'));
        }

        if (templateVars.length > 0) {
            items.push(this.createSectionLabel('<<Template Variables>>', '2'));
            const templatePath = path.relative(
                this.getConfiguredPath(vscode.workspace.workspaceFolders![0], 'templatePath'),
                this.currentFilePath || ''
            );
            const jsonPath = path.join(path.dirname(templatePath), path.basename(templatePath, '.html') + '.json');
            items.push(...this.createVariableItems(templateVars, prefix, '3', jsonPath));
        }

        return items;
    }

    private createVariableItems(variables: ThymeleafVariable[], prefix: string, sortTextPrefix: string, sourcePath: string): vscode.CompletionItem[] {
        return variables
            .filter(v => {
                const name = v.name.includes('.') ? v.name.split('.').pop()! : v.name;
                return name.toLowerCase().includes(prefix.toLowerCase());
            })
            .map(v => {
                const name = v.name.includes('.') ? v.name.split('.').pop()! : v.name;
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Text);
                item.detail = `(${v.type}) ${sourcePath}`;
                item.sortText = `${sortTextPrefix}${v.name}`;
                item.command = { command: 'editor.action.triggerSuggest', title: '' };
                return item;
            });
    }

    private getCompletionItemKind(type: string): vscode.CompletionItemKind {
        switch (type) {
            case 'object':
                return vscode.CompletionItemKind.Class;
            case 'array':
                return vscode.CompletionItemKind.Interface;
            case 'string':
                return vscode.CompletionItemKind.Text;
            case 'number':
                return vscode.CompletionItemKind.Value;
            case 'boolean':
                return vscode.CompletionItemKind.Value;
            default:
                return vscode.CompletionItemKind.Value;
        }
    }
} 