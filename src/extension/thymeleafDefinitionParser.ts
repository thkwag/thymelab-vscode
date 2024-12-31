export interface TemplateReference {
    path: string;
    startIndex: number;
}

export interface TextPosition {
    line: number;
    character: number;
}

export class ThymeleafDefinitionParser {
    private readonly TEMPLATE_REFERENCE_PATTERN = /th:(?:replace|insert|include|substituteby)="([^"]+)"|@{([^}]+)}/g;
    private readonly FRAGMENT_PATTERN = /~\{([^}]+)\}/g;
    private readonly CONDITIONAL_PATTERN = /\$\{([^}]+)\}\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g;
    private readonly INVALID_PATH_CHARS = /[<>:"|?*]/;
    private readonly FRAGMENT_DEFINITION_PATTERN = /th:fragment\s*=\s*["']([^"']+)["']/;
    private readonly DYNAMIC_LINK_PATTERN = /@{\${/;

    public isFragmentDefinition(line: string): boolean {
        return this.FRAGMENT_DEFINITION_PATTERN.test(line);
    }

    public isDynamicLink(line: string): boolean {
        return this.DYNAMIC_LINK_PATTERN.test(line);
    }

    public findFragmentInText(text: string, fragmentName: string): TextPosition | undefined {
        const lines = text.split('\n');
        const pattern = new RegExp(`th:fragment\\s*=\\s*["']${fragmentName}["']`);
        
        for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
                return {
                    line: i,
                    character: lines[i].indexOf('th:fragment')
                };
            }
        }
        return undefined;
    }

    public parseFragmentReference(path: string): { templateFile: string; fragmentId: string | null } {
        const parts = path.split('::').map(p => p.trim());
        return {
            templateFile: parts[0],
            fragmentId: parts[1] || null
        };
    }

    public findTemplateReferences(line: string): Array<{path: string, startIndex: number}> {
        const references: Array<{path: string, startIndex: number}> = [];
        const seen = new Set<string>();

        // Handle standard template references and static resources
        const matches = Array.from(line.matchAll(this.TEMPLATE_REFERENCE_PATTERN));
        for (const match of matches) {
            const [fullMatch, thContent, staticContent] = match;
            const content = thContent || staticContent;
            if (!content) continue;

            const startIndex = line.indexOf(fullMatch) + (thContent ? fullMatch.indexOf(thContent) : fullMatch.indexOf(staticContent));
            this.extractTemplateReferences(content, startIndex, references, seen);
        }

        // Handle conditional references
        const conditionalMatches = Array.from(line.matchAll(/th:(?:replace|insert|include|substituteby)="([^"]+)"/g));
        for (const match of conditionalMatches) {
            const [fullMatch, content] = match;
            if (!content) continue;

            const startIndex = line.indexOf(fullMatch);
            if (content.includes('?')) {
                const conditionalMatch = content.match(/\$\{[^}]+\}\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/);
                if (conditionalMatch) {
                    const [, truePath, falsePath] = conditionalMatch;
                    const paths = [truePath, falsePath].filter(Boolean);
                    for (const path of paths) {
                        const cleanPath = path.split('::')[0].trim();
                        if (!seen.has(cleanPath)) {
                            const actualStartIndex = line.indexOf(cleanPath);
                            references.push({
                                path: cleanPath,
                                startIndex: actualStartIndex >= 0 ? actualStartIndex : startIndex
                            });
                            seen.add(cleanPath);
                        }
                    }
                }
            } else {
                const path = this.extractPathFromReference(content);
                if (path && !seen.has(path)) {
                    const actualStartIndex = line.indexOf(path);
                    references.push({
                        path,
                        startIndex: actualStartIndex >= 0 ? actualStartIndex : startIndex
                    });
                    seen.add(path);
                }
            }
        }

        // Handle fragment expressions
        const fragmentMatches = Array.from(line.matchAll(this.FRAGMENT_PATTERN));
        for (const match of fragmentMatches) {
            const [, content] = match;
            if (!content) continue;

            const startIndex = line.indexOf(match[0]) + 2; // Skip ~{
            const parts = content.split('::');
            const path = this.extractPathFromReference(parts[0]);
            if (path && !seen.has(path)) {
                const actualStartIndex = line.indexOf(path);
                references.push({ 
                    path, 
                    startIndex: actualStartIndex >= 0 ? actualStartIndex : startIndex 
                });
                seen.add(path);
            }
        }

        return references.filter(ref => {
            if (!ref.path) return false;
            if (ref.path === '::' || ref.path === '') return false;
            
            // Allow paths with expressions
            if (ref.path.includes('${')) {
                const parts = ref.path.split(/\$\{[^}]+\}/);
                return parts.every(part => !this.INVALID_PATH_CHARS.test(part)) && !ref.path.includes('?') && !ref.path.includes(':');
            }

            return !this.INVALID_PATH_CHARS.test(ref.path);
        });
    }

    private extractTemplateReferences(content: string, startIndex: number, references: Array<{path: string, startIndex: number}>, seen: Set<string>): void {
        if (!content || content === '::') return;

        // Handle fragment notation (path :: fragment)
        const parts = content.split('::');
        const path = this.extractPathFromReference(parts[0]);
        if (path && !seen.has(path)) {
            const actualStartIndex = content.indexOf(path);
            references.push({ 
                path, 
                startIndex: actualStartIndex >= 0 ? startIndex + actualStartIndex : startIndex 
            });
            seen.add(path);
        }
    }

    private extractPathFromReference(reference: string): string | null {
        if (!reference) return null;

        // Remove quotes, trim, and remove leading @{ or ~{
        let path = reference.trim()
            .replace(/^['"]|['"]$/g, '')
            .replace(/^@{/, '')
            .replace(/^~{/, '')
            .replace(/}$/, '')
            .trim();
        
        // Remove leading slash
        path = path.replace(/^\//, '');

        // Extract path before any parameters or selectors
        const parts = path.split(/[\s(]/);
        return parts[0].trim();
    }

    private isValidPath(path: string): boolean {
        if (!path || path === '::' || path === '') return false;
        
        // Allow paths with expressions
        if (path.includes('${')) {
            // Check if the path has valid structure around the expression
            const parts = path.split(/\$\{[^}]+\}/);
            return parts.every(part => !this.INVALID_PATH_CHARS.test(part));
        }

        return !this.INVALID_PATH_CHARS.test(path);
    }

    public normalizeResourcePath(path: string): string {
        return path.replace(/^\//, '');
    }

    public normalizePath(path: string): string {
        return path.replace(/\\/g, '/');
    }

    public getPathWithoutPrefix(path: string, prefix: string): string {
        return path.startsWith(prefix) ? path.slice(prefix.length) : path;
    }

    public getPossibleStaticPaths(basePath: string): string[] {
        const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif'];
        return extensions.map(ext => basePath + ext);
    }
} 