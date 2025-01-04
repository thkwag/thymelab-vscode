export interface TemplateReference {
    path: string;
    startIndex: number;
}

export interface TextPosition {
    line: number;
    character: number;
}

export class ThymeleafDefinitionParser {
    private readonly TEMPLATE_REFERENCE_PATTERN = /th:(?:replace|insert|include|substituteby)="([^"]+)"|@{([^}]+)}|layout:(?:decorate|fragment)="([^"]+)"/g;
    private readonly FRAGMENT_PATTERN = /~\{([^}]+)\}/g;
    private readonly CONDITIONAL_PATTERN = /\$\{[^}]+\}\s*\?\s*'([^']+)'\s*:\s*(?:'([^']+)'|_)/g;
    private readonly ELVIS_PATTERN = /\$\{[^}]+\}\s*\?:\s*'([^']+)'/g;
    private readonly INVALID_PATH_CHARS = /[<>"|?*]/;
    private readonly FRAGMENT_DEFINITION_PATTERN = /(?:th|layout):fragment\s*=\s*["']([^"']+)["']/;
    private readonly DYNAMIC_LINK_PATTERN = /@{\${/;
    private readonly SELECTION_PATTERN = /\*{([^}]+)}/g;
    private readonly LITERAL_SUBSTITUTION_PATTERN = /\|([^|]+)\|/g;

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
            const [fullMatch, thContent, staticContent, layoutContent] = match;
            const content = thContent || staticContent || layoutContent;
            if (!content) continue;

            const startIndex = line.indexOf(fullMatch) + (thContent ? fullMatch.indexOf(thContent) : 
                layoutContent ? fullMatch.indexOf(layoutContent) : fullMatch.indexOf(staticContent));
            
            // Handle conditional expressions within template references
            if (content.includes('?') && !content.includes('?:')) {
                const conditionalMatches = Array.from(content.matchAll(this.CONDITIONAL_PATTERN));
                for (const condMatch of conditionalMatches) {
                    const [, truePath, falsePath] = condMatch;
                    if (truePath) {
                        const cleanPath = this.extractPathFromReference(truePath);
                        if (cleanPath && !seen.has(cleanPath)) {
                            references.push({
                                path: cleanPath,
                                startIndex: line.indexOf(truePath)
                            });
                            seen.add(cleanPath);
                        }
                    }
                    if (falsePath && falsePath !== '_') {
                        const cleanPath = this.extractPathFromReference(falsePath);
                        if (cleanPath && !seen.has(cleanPath)) {
                            references.push({
                                path: cleanPath,
                                startIndex: line.indexOf(falsePath)
                            });
                            seen.add(cleanPath);
                        }
                    }
                }
            } else if (content.includes('?:')) {
                const elvisMatches = Array.from(content.matchAll(this.ELVIS_PATTERN));
                for (const elvisMatch of elvisMatches) {
                    const [, defaultPath] = elvisMatch;
                    if (defaultPath) {
                        const cleanPath = this.extractPathFromReference(defaultPath);
                        if (cleanPath && !seen.has(cleanPath)) {
                            references.push({
                                path: cleanPath,
                                startIndex: line.indexOf(defaultPath)
                            });
                            seen.add(cleanPath);
                        }
                    }
                }
            } else {
                // Extract path before any parameters or expressions
                const path = this.extractPathFromReference(content);
                if (path && !seen.has(path)) {
                    references.push({
                        path,
                        startIndex: content.indexOf(path) >= 0 ? startIndex + content.indexOf(path) : startIndex
                    });
                    seen.add(path);
                }
            }
        }

        // Handle literal substitutions
        const literalMatches = Array.from(line.matchAll(this.LITERAL_SUBSTITUTION_PATTERN));
        for (const match of literalMatches) {
            const [fullMatch, content] = match;
            if (!content) continue;

            const startIndex = line.indexOf(fullMatch);
            const path = this.extractPathFromReference(content);
            if (path && !seen.has(path)) {
                references.push({
                    path,
                    startIndex
                });
                seen.add(path);
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
                references.push({ 
                    path, 
                    startIndex: line.indexOf(path) >= 0 ? line.indexOf(path) : startIndex 
                });
                seen.add(path);
            }
        }

        // Handle complex fragment expressions with parameters
        const complexFragmentPattern = /(?:th:(?:replace|insert|include))\s*=\s*["']([^"']+)\s*::\s*[^"']+\([^)]+\)["']/g;
        const complexMatches = Array.from(line.matchAll(complexFragmentPattern));
        for (const match of complexMatches) {
            const [fullMatch, content] = match;
            if (!content) continue;

            const startIndex = line.indexOf(fullMatch);
            const path = this.extractPathFromReference(content);
            if (path && !seen.has(path)) {
                references.push({
                    path,
                    startIndex
                });
                seen.add(path);
            }
        }

        // Filter and normalize references
        const filteredRefs = references.filter(ref => {
            if (!ref.path) return false;
            if (ref.path === '::' || ref.path === '') return false;
            
            // Allow paths with expressions
            if (ref.path.includes('${') || ref.path.includes('*{') || ref.path.includes('#{')) {
                const parts = ref.path.split(/\$\{[^}]+\}|\*\{[^}]+\}|#\{[^}]+\}/);
                return parts.every(part => !this.INVALID_PATH_CHARS.test(part));
            }

            // Handle template resolver prefixes
            if (ref.path.startsWith('classpath:') || ref.path.startsWith('file:')) {
                return !this.INVALID_PATH_CHARS.test(ref.path.substring(ref.path.indexOf(':') + 1));
            }

            return !this.INVALID_PATH_CHARS.test(ref.path);
        });

        // Remove duplicates while preserving order
        const uniqueRefs: Array<{path: string, startIndex: number}> = [];
        const seenPaths = new Set<string>();
        for (const ref of filteredRefs) {
            const normalizedPath = this.normalizePath(ref.path);
            if (!seenPaths.has(normalizedPath)) {
                uniqueRefs.push(ref);
                seenPaths.add(normalizedPath);
            }
        }

        return uniqueRefs;
    }

    private extractTemplateReferences(content: string, startIndex: number, references: Array<{path: string, startIndex: number}>, seen: Set<string>): void {
        if (!content || content === '::') return;

        // Handle fragment notation (path :: fragment)
        const parts = content.split('::').map(p => p.trim());
        const path = this.extractPathFromReference(parts[0]);
        
        if (path && !seen.has(path)) {
            references.push({ 
                path, 
                startIndex: content.indexOf(path) >= 0 ? startIndex + content.indexOf(path) : startIndex 
            });
            seen.add(path);
        }
    }

    private extractPathFromReference(reference: string): string | null {
        if (!reference) return null;

        // Remove quotes and trim
        let path = reference.trim()
            .replace(/^['"]|['"]$/g, '')
            .replace(/^@{/, '')
            .replace(/^~{/, '')
            .replace(/}$/, '')
            .trim();
        
        // Handle template resolver prefixes
        if (path.startsWith('classpath:') || path.startsWith('file:')) {
            path = path.substring(path.indexOf(':') + 1);
        }

        // Handle context-relative URLs
        if (path.startsWith('~/')) {
            path = path.substring(2);
        }

        // Remove leading slash
        path = path.replace(/^\//, '');

        // Handle preprocessed expressions
        if (path.startsWith('__') && path.endsWith('__')) {
            return path;
        }

        // Handle URL parameters
        const urlParamIndex = path.indexOf('(');
        if (urlParamIndex > -1) {
            path = path.substring(0, urlParamIndex);
        }

        // Handle fragment notation with parameters
        const fragmentParts = path.split('::').map(p => p.trim());
        const pathWithoutFragment = fragmentParts[0].trim();

        // If there's a fragment part with parameters, extract just the fragment name
        if (fragmentParts.length > 1) {
            const fragmentPart = fragmentParts[1];
            const paramIndex = fragmentPart.indexOf('(');
            if (paramIndex > -1) {
                // Return the template path part
                return pathWithoutFragment;
            }
        }

        // Handle expressions in path
        if (pathWithoutFragment.includes('${') || 
            pathWithoutFragment.includes('*{') || 
            pathWithoutFragment.includes('#{') ||
            pathWithoutFragment.includes('|')) {
            return pathWithoutFragment;
        }

        return pathWithoutFragment || null;
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