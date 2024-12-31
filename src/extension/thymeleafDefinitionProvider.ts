import * as vscode from 'vscode';
import * as path from 'path';
import { ThymeleafDefinitionParser } from './thymeleafDefinitionParser';

interface FragmentDefinition {
    file: vscode.Uri;
    line: number;
    character: number;
}

export class ThymeleafDefinitionProvider implements vscode.DocumentLinkProvider, vscode.DefinitionProvider {
    private fileCache: Map<string, vscode.Uri[]> = new Map();
    private fragmentCache: Map<string, FragmentDefinition> = new Map();
    private lastCacheUpdate: number = 0;
    private readonly CACHE_TTL = 5000; // 5 seconds
    private readonly parser: ThymeleafDefinitionParser;

    constructor() {
        this.parser = new ThymeleafDefinitionParser();
        vscode.workspace.onDidCreateFiles(() => this.clearCache());
        vscode.workspace.onDidDeleteFiles(() => this.clearCache());
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.fileName.endsWith('.html')) {
                this.clearFragmentCache();
            }
        });
    }

    private clearCache() {
        this.fileCache.clear();
        this.fragmentCache.clear();
        this.lastCacheUpdate = 0;
    }

    private clearFragmentCache() {
        this.fragmentCache.clear();
    }

    private async getFiles(templatePath: string): Promise<vscode.Uri[]> {
        const now = Date.now();
        const cacheKey = templatePath;

        if (this.fileCache.has(cacheKey) && now - this.lastCacheUpdate < this.CACHE_TTL) {
            return this.fileCache.get(cacheKey)!;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return [];

        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspaceFolder, path.join(templatePath, '**/*.html'))
        );
        
        this.fileCache.set(cacheKey, files);
        this.lastCacheUpdate = now;
        
        return files;
    }

    async provideDocumentLinks(document: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
        const links: vscode.DocumentLink[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            
            // Skip fragment definitions and dynamic links
            if (this.parser.isFragmentDefinition(line) || this.parser.isDynamicLink(line)) continue;

            const matches = this.parser.findTemplateReferences(line);
            for (const {path, startIndex} of matches) {
                const range = new vscode.Range(i, startIndex, i, startIndex + path.length);
                const link = new vscode.DocumentLink(range);
                link.tooltip = `Go to ${path}`;
                links.push(link);
            }
        }

        return links;
    }

    async resolveDocumentLink(link: vscode.DocumentLink): Promise<vscode.DocumentLink> {
        const document = vscode.window.activeTextEditor?.document;
        if (!document) return link;

        const fragmentInfo = await this.findFragmentAtPosition(document, link.range.start);
        if (fragmentInfo) {
            link.target = fragmentInfo.file;
        }
        return link;
    }

    async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | undefined> {
        const fragmentInfo = await this.findFragmentAtPosition(document, position);
        if (fragmentInfo) {
            return new vscode.Location(
                fragmentInfo.file,
                new vscode.Position(fragmentInfo.line, fragmentInfo.character)
            );
        }
        return undefined;
    }

    private findTemplateReferences(line: string): Array<{path: string, startIndex: number}> {
        return this.parser.findTemplateReferences(line);
    }

    private async findFragmentAtPosition(document: vscode.TextDocument, position: vscode.Position): Promise<FragmentDefinition & { startPos: number, endPos: number } | undefined> {
        if (!document.fileName.endsWith('.html')) return undefined;

        const line = document.lineAt(position).text;
        const templatePath = vscode.workspace.getConfiguration('thymelab.resources').get<string>('templatePath') || '';
        const staticPath = vscode.workspace.getConfiguration('thymelab.resources').get<string>('staticPath') || '';
        
        if (!templatePath && !staticPath) return undefined;

        // Check all template references
        const references = this.parser.findTemplateReferences(line);
        for (const {path, startIndex} of references) {
            const endIndex = startIndex + path.length;
            
            if (position.character >= startIndex && position.character <= endIndex) {
                // Check if it's a static resource
                if (line.includes('@{') && staticPath) {
                    const resourcePath = this.parser.normalizeResourcePath(path);
                    const fragmentDef = await this.findStaticResource(resourcePath, staticPath);
                    if (fragmentDef) {
                        return {
                            ...fragmentDef,
                            startPos: startIndex,
                            endPos: endIndex
                        };
                    }
                }
                // Check if it's a template reference
                else if (templatePath) {
                    const { templateFile, fragmentId } = this.parser.parseFragmentReference(path);
                    
                    const fragmentDef = await this.findFragmentDefinitionInternal(
                        fragmentId,
                        templatePath,
                        templateFile
                    );
                    if (fragmentDef) {
                        return {
                            ...fragmentDef,
                            startPos: startIndex,
                            endPos: endIndex
                        };
                    }
                }
            }
        }

        return undefined;
    }

    private async findFragmentDefinitionInternal(
        fragmentName: string | null,
        templatePath: string,
        templateFile?: string
    ): Promise<FragmentDefinition | undefined> {
        const files = await this.getFiles(templatePath);

        // If we're looking for a specific template file
        if (templateFile) {
            const templateFileWithExt = templateFile.endsWith('.html') ? templateFile : `${templateFile}.html`;
            const targetFile = this.findMatchingFile(files, templatePath, templateFileWithExt);

            if (targetFile) {
                // If we're just looking for the file (layout:decorate case)
                if (!fragmentName) {
                    return { file: targetFile, line: 0, character: 0 };
                }

                // Check fragment cache first
                const cacheKey = `${targetFile.fsPath}#${fragmentName}`;
                if (this.fragmentCache.has(cacheKey)) {
                    return this.fragmentCache.get(cacheKey);
                }

                return await this.findFragmentInFile(targetFile, fragmentName);
            }
        }
        // If we're just looking for a fragment name in any file
        else if (fragmentName) {
            // Check fragment cache first
            const cacheKey = `*#${fragmentName}`;
            if (this.fragmentCache.has(cacheKey)) {
                return this.fragmentCache.get(cacheKey);
            }

            for (const file of files) {
                const result = await this.findFragmentInFile(file, fragmentName);
                if (result) return result;
            }
        }

        return undefined;
    }

    private findMatchingFile(files: vscode.Uri[], templatePath: string, templateFile: string): vscode.Uri | undefined {
        return files.find(file => {
            const relativePath = vscode.workspace.asRelativePath(file);
            const normalizedPath = this.parser.normalizePath(relativePath);
            const normalizedTemplate = this.parser.normalizePath(templateFile);
            
            const templatePathPrefix = this.parser.normalizePath(templatePath) + '/';
            const pathWithoutPrefix = this.parser.getPathWithoutPrefix(normalizedPath, templatePathPrefix);
            
            return pathWithoutPrefix === normalizedTemplate;
        });
    }

    private async findFragmentInFile(file: vscode.Uri, fragmentName: string): Promise<FragmentDefinition | undefined> {
        const content = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(content).toString('utf8');
        
        const fragmentDef = this.parser.findFragmentInText(text, fragmentName);
        if (fragmentDef) {
            const result = {
                file,
                line: fragmentDef.line,
                character: fragmentDef.character
            };
            this.fragmentCache.set(`${file.fsPath}#${fragmentName}`, result);
            return result;
        }
        return undefined;
    }

    private async findStaticResource(resourcePath: string, staticPath: string): Promise<FragmentDefinition | undefined> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return undefined;

        // Check cache first
        const cacheKey = `static#${resourcePath}`;
        if (this.fragmentCache.has(cacheKey)) {
            return this.fragmentCache.get(cacheKey);
        }

        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspaceFolder, path.join(staticPath, '**/*'))
        );

        // Try exact match first, then with extensions
        const possiblePaths = [resourcePath, ...this.parser.getPossibleStaticPaths(resourcePath)];
        for (const file of files) {
            const relativePath = vscode.workspace.asRelativePath(file);
            const normalizedPath = this.parser.normalizePath(relativePath);
            const staticPrefix = this.parser.normalizePath(staticPath) + '/';
            const pathWithoutPrefix = this.parser.getPathWithoutPrefix(normalizedPath, staticPrefix);

            if (possiblePaths.includes(pathWithoutPrefix)) {
                const result = { file, line: 0, character: 0 };
                this.fragmentCache.set(cacheKey, result);
                return result;
            }
        }

        return undefined;
    }
} 