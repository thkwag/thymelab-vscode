export interface IteratorInfo {
    iteratorVars: Set<string>;
    parentVars: Map<string, string>;
    statVars: Map<string, string>;
}

export class ThymeleafVariableParser {
    private static readonly VARIABLE_REGEX = /\${([^}]+)}/g;
    private static readonly MESSAGE_REGEX = /#{([^}]+)}/g;
    private static readonly LINK_REGEX = /@{([^}]+)}/g;
    private static readonly SELECTION_REGEX = /\*{([^}]+)}/g;
    private static readonly MARKUP_SELECTOR_REGEX = /([^>]+)>([^>]+)/g;
    private static readonly ATTRIBUTE_SELECTOR_REGEX = /\[([^\]]+)\]/g;
    private static readonly POSITION_SELECTOR_REGEX = /:nth-child\(([^)]+)\)/g;
    private static readonly JQUERY_SELECTOR_REGEX = /([^:]+):([^:]+)/g;
    private static readonly REFERENCE_SELECTOR_REGEX = /#([^#]+)/g;
    private static readonly HTML_COMMENT_REGEX = /<!--(.*?)-->/gs;
    private static readonly PARSER_COMMENT_REGEX = /\/\*\[(.*?)\]\*\//gs;
    private static readonly PROTOTYPE_COMMENT_REGEX = /\/\*\[(.*?)\]\*\//gs;
    private static readonly UTILITY_OBJECTS = ['#temporals', '#numbers', '#strings', '#dates', 
        '#calendars', '#objects', '#bools', '#arrays', '#lists', '#sets', '#maps', '#aggregates', 
        '#messages', '#uris', '#conversions', '#ctx', '#vars', '#locale', '#request', '#response', 
        '#session', '#servletContext', '#httpServletRequest', '#httpSession'];

    private static readonly ESCAPED_EXPRESSION_REGEX = /\\(\${[^}]+}|#{[^}]+}|@{[^}]+}|\*{[^}]+})/g;

    private preprocessText(text: string): string {
        // Replace escaped expressions with a placeholder
        return text.replace(ThymeleafVariableParser.ESCAPED_EXPRESSION_REGEX, '');
    }

    public findAllVariableMatches(text: string): [string, string][] {
        // Preprocess text to handle escaped expressions
        const processedText = this.preprocessText(text);
        const matches: [string, string][] = [];
        let match;

        // Process ${...} expressions
        while ((match = ThymeleafVariableParser.VARIABLE_REGEX.exec(processedText)) !== null) {
            const expression = match[1];
            matches.push(...this.extractVariablesFromExpression(expression));
        }

        // Process #{...} expressions
        while ((match = ThymeleafVariableParser.MESSAGE_REGEX.exec(processedText)) !== null) {
            const expression = match[1];
            if (expression.includes('(')) {
                const [messageName, params] = expression.split('(');
                matches.push([match[0], messageName.trim()]);
                if (params) {
                    const cleanParams = params.replace(')', '');
                    matches.push(...this.extractVariablesFromParameters(cleanParams));
                }
            } else {
                matches.push([match[0], expression.trim()]);
            }
        }

        // Process @{...} expressions
        while ((match = ThymeleafVariableParser.LINK_REGEX.exec(processedText)) !== null) {
            const expression = match[1];
            if (expression.includes('(')) {
                const [path, params] = expression.split('(');
                if (path.includes('${')) {
                    matches.push(...this.extractVariablesFromExpression(path));
                }
                if (params) {
                    const cleanParams = params.replace(')', '');
                    const paramPairs = cleanParams.split(',');
                    for (const pair of paramPairs) {
                        if (pair.includes('=')) {
                            const [, value] = pair.split('=');
                            matches.push(...this.extractVariablesFromExpression(value.trim()));
                        }
                    }
                }
            } else {
                const parts = expression.split('/');
                for (const part of parts) {
                    if (part.includes('${')) {
                        matches.push(...this.extractVariablesFromExpression(part));
                    }
                }
            }
        }

        // Process *{...} expressions
        while ((match = ThymeleafVariableParser.SELECTION_REGEX.exec(processedText)) !== null) {
            const expression = match[1];
            matches.push([match[0], expression.trim()]);
            const parts = expression.split('.');
            if (parts.length > 1) {
                let currentPath = '';
                for (const part of parts) {
                    currentPath = currentPath ? `${currentPath}.${part}` : part;
                    matches.push([match[0], currentPath]);
                }
            }
        }

        // Process th:each expressions
        const eachRegex = /th:each="([^"]+)"/g;
        while ((match = eachRegex.exec(processedText)) !== null) {
            const iterExpression = match[1];
            const parts = iterExpression.split(':');
            if (parts.length >= 2) {
                const iterVarParts = parts[0].split(',').map(p => p.trim());
                const collectionExpr = parts[1].trim();
                if (collectionExpr.startsWith('${') && collectionExpr.endsWith('}')) {
                    const collection = collectionExpr.slice(2, -1);
                    matches.push([collectionExpr, collection]);
                    const [iterVar, statVar] = iterVarParts[0].split(',').map(v => v.trim());
                    if (statVar) {
                        matches.push([`\${${statVar}}`, statVar]);
                    }
                    matches.push([`\${${iterVar}}`, iterVar]);
                }
            }
        }

        // Process th:if expressions
        const ifRegex = /th:if="([^"]+)"/g;
        while ((match = ifRegex.exec(processedText)) !== null) {
            const expression = match[1];
            matches.push(...this.extractVariablesFromExpression(expression));
        }

        // Process th:with expressions
        const withRegex = /th:with="([^"]+)"/g;
        while ((match = withRegex.exec(processedText)) !== null) {
            const expression = match[1];
            const assignments = expression.split(',');
            for (const assignment of assignments) {
                const [varName, value] = assignment.split('=').map(p => p.trim());
                matches.push(...this.extractVariablesFromExpression(value));
                matches.push([`\${${varName}}`, varName]);
            }
        }

        // Process th:object expressions
        const objectRegex = /th:object="\${([^}]+)}"/g;
        while ((match = objectRegex.exec(processedText)) !== null) {
            const expression = match[1];
            matches.push([`\${${expression}}`, expression]);
        }

        // Process th:field expressions
        const fieldRegex = /th:field="([^"]+)"/g;
        while ((match = fieldRegex.exec(processedText)) !== null) {
            const expression = match[1];
            matches.push(...this.extractVariablesFromExpression(expression));
        }

        // Process th:text expressions
        const textRegex = /th:text="([^"]+)"/g;
        while ((match = textRegex.exec(processedText)) !== null) {
            const expression = match[1];
            matches.push(...this.extractVariablesFromExpression(expression));
        }

        // Process th:value expressions
        const valueRegex = /th:value="([^"]+)"/g;
        while ((match = valueRegex.exec(processedText)) !== null) {
            const expression = match[1];
            matches.push(...this.extractVariablesFromExpression(expression));
        }

        // Process th:attr expressions
        const attrRegex = /th:attr="([^"]+)"/g;
        while ((match = attrRegex.exec(processedText)) !== null) {
            const expression = match[1];
            const assignments = expression.split(',');
            for (const assignment of assignments) {
                const [, value] = assignment.split('=').map(p => p.trim());
                matches.push(...this.extractVariablesFromExpression(value));
            }
        }

        // Process inline expressions [[...]]
        const inlineRegex = /\[\[([^\]]+)\]\]/g;
        while ((match = inlineRegex.exec(processedText)) !== null) {
            const expression = match[1];
            matches.push(...this.extractVariablesFromExpression(expression));
        }

        // Process comments
        this.processComments(processedText, matches, new Set());

        // Process selectors
        this.processSelectors(processedText, matches, new Set());

        // Process basic objects
        const basicObjectRegex = /#(ctx|vars|locale|request|response|session|servletContext|httpServletRequest|httpSession)\.([\w.]+)/g;
        while ((match = basicObjectRegex.exec(processedText)) !== null) {
            const [fullMatch, , property] = match;
            matches.push([`\${${fullMatch}}`, property]);
        }

        // Process security expressions
        const securityRegex = /(hasRole|hasAnyRole|hasAuthority|hasAnyAuthority|principal|authentication|permitAll|denyAll|isAnonymous|isAuthenticated|isFullyAuthenticated|hasIpAddress)\s*\(([^)]*)\)/g;
        while ((match = securityRegex.exec(processedText)) !== null) {
            const [fullMatch, securityFunction, params] = match;
            if (fullMatch.includes('#authentication.principal')) {
                const principalRegex = /#authentication\.principal\.([\w.]+)/g;
                let principalMatch;
                while ((principalMatch = principalRegex.exec(fullMatch)) !== null) {
                    const [, property] = principalMatch;
                    matches.push([fullMatch, `principal.${property}`]);
                    matches.push([fullMatch, 'principal']);
                }
            }
            if (securityFunction === 'hasRole' || securityFunction === 'hasAnyRole') {
                const roleRegex = /user\.([\w.]+)\(\)/g;
                let roleMatch;
                while ((roleMatch = roleRegex.exec(fullMatch)) !== null) {
                    const [, method] = roleMatch;
                    matches.push([fullMatch, 'user']);
                    matches.push([fullMatch, `user.${method}`]);
                }
            }
            if (params) {
                matches.push(...this.extractVariablesFromParameters(params));
            }
        }

        // Process fragment assertions
        const fragmentAssertionRegex = /\$\{([^}]+)\}\s*!=\s*(\d+)/g;
        while ((match = fragmentAssertionRegex.exec(processedText)) !== null) {
            const [fullMatch, variable] = match;
            matches.push([fullMatch, variable]);
        }

        // Process message expressions with parameters
        const messageWithParamsRegex = /#\{([^}(]+)\(([^)]+)\)\}/g;
        while ((match = messageWithParamsRegex.exec(processedText)) !== null) {
            const [fullMatch, messageName, params] = match;
            matches.push([fullMatch, messageName.trim()]);
            const paramVars = params.split(',').map(p => p.trim());
            for (const param of paramVars) {
                if (param.startsWith('${')) {
                    matches.push(...this.extractVariablesFromExpression(param.slice(2, -1)));
                }
            }
        }

        // Process nested method calls
        const nestedMethodRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*\(\s*\)\s*\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)/g;
        while ((match = nestedMethodRegex.exec(processedText)) !== null) {
            const [fullMatch, methodCall, chainedCall] = match;
            const expr = `\${${fullMatch}}`;

            // Process the initial method call
            const methodParts = methodCall.split('.');
            let currentPath = '';
            for (const part of methodParts) {
                currentPath = currentPath ? `${currentPath}.${part}` : part;
                matches.push([expr, currentPath]);
            }

            // Process the chained method call
            const chainedParts = chainedCall.split('.');
            currentPath = '';
            for (const part of chainedParts) {
                currentPath = currentPath ? `${currentPath}.${part}` : part;
                matches.push([expr, currentPath]);
            }

            // Process any selection expressions in the chain
            const selectionRegex = /\?{1,2}\[(.*?)\]/g;
            let selectionMatch;
            while ((selectionMatch = selectionRegex.exec(fullMatch)) !== null) {
                const [, condition] = selectionMatch;
                matches.push(...this.extractVariablesFromExpression(condition));
            }
        }

        // Remove duplicates while preserving order
        const seen = new Set<string>();
        return matches.filter(([expr, variable]) => {
            const key = `${expr}:${variable}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    private extractVariablesFromExpression(expression: string): [string, string][] {
        const matches: [string, string][] = [];
        const fullExpression = `\${${expression}}`;

        // Skip if expression is empty or only contains whitespace
        if (!expression || !expression.trim()) {
            return matches;
        }

        // Handle security expressions first
        if (expression.includes('#authentication')) {
            const principalRegex = /#authentication\.principal(?:\.(\w+))?/g;
            let authMatch;
            while ((authMatch = principalRegex.exec(expression)) !== null) {
                const [, property] = authMatch;
                matches.push([fullExpression, 'principal']);
                if (property) {
                    matches.push([fullExpression, `principal.${property}`]);
                }
            }
        }

        // Handle security function calls
        const securityFuncRegex = /(hasRole|hasAnyRole|hasAuthority|hasAnyAuthority)\s*\((.*?)\)/g;
        let secMatch;
        while ((secMatch = securityFuncRegex.exec(expression)) !== null) {
            const [, , params] = secMatch;  // Skip the security function name
            if (params) {
                const paramList = this.splitParameters(params);
                for (const param of paramList) {
                    if (!this.isStringLiteral(param) && !this.isNumericLiteral(param)) {
                        const paramVars = this.extractVariablesFromExpression(param.trim());
                        matches.push(...paramVars);
                    }
                }
            }
        }

        // Handle selection expressions
        const selectionRegex = /\?{1,2}\[(.*?)\]/g;
        let selMatch;
        while ((selMatch = selectionRegex.exec(expression)) !== null) {
            const [, condition] = selMatch;
            const parts = condition.split(/\s+/);
            for (const part of parts) {
                if (!this.isReservedWord(part) && !this.isOperator(part) && !this.isStringLiteral(part) && !this.isNumericLiteral(part)) {
                    const propertyRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)/g;
                    let propMatch;
                    while ((propMatch = propertyRegex.exec(part)) !== null) {
                        const [propertyPath] = propMatch;
                        if (!propertyPath.startsWith('#') && !this.isReservedWord(propertyPath.split('.')[0]) && !this.isSecurityFunction(propertyPath.split('.')[0])) {
                            matches.push([fullExpression, propertyPath]);
                        }
                    }
                }
            }
        }

        // Handle method calls with parameters
        const methodCallRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*\((.*?)\)/g;
        let methodMatch;
        while ((methodMatch = methodCallRegex.exec(expression)) !== null) {
            const [, methodPath, params] = methodMatch;
            const parts = methodPath.split('.');
            // Skip if the first part is a security function
            if (!this.isReservedWord(parts[0]) && !this.isSecurityFunction(parts[0])) {
                let currentPath = '';
                for (const part of parts) {
                    if (!this.isReservedWord(part)) {
                        currentPath = currentPath ? `${currentPath}.${part}` : part;
                        matches.push([fullExpression, currentPath]);
                    }
                }
                if (params) {
                    const paramList = this.splitParameters(params);
                    for (const param of paramList) {
                        if (!this.isStringLiteral(param) && !this.isNumericLiteral(param)) {
                            const paramVars = this.extractVariablesFromExpression(param.trim());
                            matches.push(...paramVars);
                        }
                    }
                }
            }
        }

        // Handle logical expressions (and, or, not)
        const logicalParts = expression.split(/\s+(and|or)\s+/);
        for (const part of logicalParts) {
            if (!this.isReservedWord(part) && !this.isOperator(part)) {
                // Handle comparison operators
                const comparisonParts = part.split(/\s*(?:==|!=|>=|<=|>|<)\s*/);
                for (const compPart of comparisonParts) {
                    if (!this.isReservedWord(compPart) && !this.isOperator(compPart) && !this.isStringLiteral(compPart) && !this.isNumericLiteral(compPart)) {
                        const propertyRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)/g;
                        let propMatch;
                        while ((propMatch = propertyRegex.exec(compPart)) !== null) {
                            const [propertyPath] = propMatch;
                            if (!propertyPath.startsWith('#') && !this.isReservedWord(propertyPath.split('.')[0]) && !this.isSecurityFunction(propertyPath.split('.')[0])) {
                                const parts = propertyPath.split('.');
                                let currentPath = '';
                                for (const part of parts) {
                                    if (!this.isReservedWord(part)) {
                                        currentPath = currentPath ? `${currentPath}.${part}` : part;
                                        matches.push([fullExpression, currentPath]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Handle ternary expressions
        const ternaryRegex = /(.*?)\s*\?\s*(.*?)\s*:\s*(.*)/;
        let ternMatch;
        if ((ternMatch = ternaryRegex.exec(expression)) !== null) {
            const [, condition, truePart, falsePart] = ternMatch;
            matches.push(...this.extractVariablesFromExpression(condition));
            matches.push(...this.extractVariablesFromExpression(truePart));
            matches.push(...this.extractVariablesFromExpression(falsePart));
        }

        // Handle Elvis operator
        const elvisRegex = /(.*?)\s*\?:\s*(.*)/;
        let elvisMatch;
        if ((elvisMatch = elvisRegex.exec(expression)) !== null) {
            const [, leftPart, rightPart] = elvisMatch;
            matches.push(...this.extractVariablesFromExpression(leftPart));
            matches.push(...this.extractVariablesFromExpression(rightPart));
        }

        // Remove duplicates while preserving order
        const seen = new Set<string>();
        return matches.filter(([expr, variable]) => {
            const key = `${expr}:${variable}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    private isOperator(word: string): boolean {
        const operators = new Set([
            '+', '-', '*', '/', '%',
            '==', '!=', '>', '<', '>=', '<=',
            'and', 'or', 'not',
            '&&', '||', '!',
            '?', ':', '?:',
            '.', ',', '(', ')', '[', ']',
            '=', '+=', '-=', '*=', '/=', '%='
        ]);
        return operators.has(word);
    }

    private isReservedWord(word: string): boolean {
        const reservedWords = new Set([
            'and', 'or', 'not', 'gt', 'ge', 'lt', 'le', 'eq', 'ne',
            'true', 'false', 'null', 'instanceof', 'new', 'return',
            'this', 'matches', 'contains', 'startsWith', 'endsWith',
            'size', 'length', 'hasRole', 'hasAnyRole', 'hasAuthority',
            'hasAnyAuthority', 'principal', 'authentication', 'permitAll',
            'denyAll', 'isAnonymous', 'isAuthenticated', 'isFullyAuthenticated',
            'hasIpAddress', 'hasAnyPermission'
        ]);
        return reservedWords.has(word.toLowerCase());
    }

    private isStringLiteral(value: string): boolean {
        return /^(['"]).*\1$/.test(value.trim());
    }

    private isNumericLiteral(value: string): boolean {
        return /^-?\d*\.?\d+$/.test(value.trim());
    }

    private splitParameters(params: string): string[] {
        const result: string[] = [];
        let currentParam = '';
        let parenCount = 0;
        let inQuote = false;
        let quoteChar = '';

        for (let i = 0; i < params.length; i++) {
            const char = params[i];
            
            if ((char === '\'' || char === '"') && params[i - 1] !== '\\') {
                if (!inQuote) {
                    inQuote = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuote = false;
                }
            } else if (char === '(' && !inQuote) {
                parenCount++;
            } else if (char === ')' && !inQuote) {
                parenCount--;
            } else if (char === ',' && parenCount === 0 && !inQuote) {
                if (currentParam.trim()) {
                    result.push(currentParam.trim());
                }
                currentParam = '';
                continue;
            }
            
            currentParam += char;
        }

        if (currentParam.trim()) {
            result.push(currentParam.trim());
        }

        return result;
    }

    public findVariableReferences(text: string): { variable: string; startIndex: number; isIteratorVar: boolean; }[] {
        const matches = this.findAllVariableMatches(text);
        const iterInfo = this.findIteratorVariables(text);
        const results: { variable: string; startIndex: number; isIteratorVar: boolean; }[] = [];

        for (const [fullMatch, variable] of matches) {
            const startIndex = text.indexOf(fullMatch);
            if (startIndex !== -1) {
                results.push({
                    variable,
                    startIndex,
                    isIteratorVar: iterInfo.iteratorVars.has(variable)
                });
            }
        }

        return results;
    }

    public findIteratorVariables(text: string): IteratorInfo {
        const iteratorVars = new Set<string>();
        const parentVars = new Map<string, string>();
        const statVars = new Map<string, string>();

        const eachRegex = /th:each="([^"]+)\s*:\s*\${([^}]+)}"/g;
        let match;

        while ((match = eachRegex.exec(text)) !== null) {
            const [, iterPart, collection] = match;
            const iterVars = iterPart.split(',').map(v => v.trim());
            
            if (iterVars.length >= 1) {
                const iterVar = iterVars[0];
                iteratorVars.add(iterVar);
                parentVars.set(iterVar, collection);

                if (iterVars.length >= 2) {
                    const statVar = iterVars[1];
                    iteratorVars.add(statVar);
                    statVars.set(iterVar, statVar);
                }
            }
        }

        return { iteratorVars, parentVars, statVars };
    }

    private processSelectors(text: string, results: [string, string][], processedExpressions: Set<string>): void {
        // Process markup selectors (direct children and descendants)
        let match;
        while ((match = ThymeleafVariableParser.MARKUP_SELECTOR_REGEX.exec(text)) !== null) {
            const [fullMatch, parent, child] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                if (parent.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(parent));
                }
                if (child.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(child));
                }
            }
        }

        // Process attribute selectors
        while ((match = ThymeleafVariableParser.ATTRIBUTE_SELECTOR_REGEX.exec(text)) !== null) {
            const [fullMatch, content] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                if (content.includes('=')) {
                    const [, value] = content.split('=').map(p => p.trim());
                    if (value.includes('${')) {
                        results.push(...this.extractVariablesFromExpression(value));
                    }
                } else if (content.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(content));
                }
            }
        }

        // Process position selectors
        while ((match = ThymeleafVariableParser.POSITION_SELECTOR_REGEX.exec(text)) !== null) {
            const [fullMatch, content] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                if (content.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(content));
                }
            }
        }

        // Process jQuery-like selectors
        while ((match = ThymeleafVariableParser.JQUERY_SELECTOR_REGEX.exec(text)) !== null) {
            const [fullMatch, selector, filter] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                if (selector.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(selector));
                }
                if (filter.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(filter));
                }
            }
        }

        // Process reference selectors
        while ((match = ThymeleafVariableParser.REFERENCE_SELECTOR_REGEX.exec(text)) !== null) {
            const [fullMatch, content] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                if (content.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(content));
                }
            }
        }

        // Process URL expressions
        const urlPattern = /@\{([^}]+)\}/g;
        while ((match = urlPattern.exec(text)) !== null) {
            const [fullMatch, urlPath] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                if (urlPath.includes('(')) {
                    const [path, params] = urlPath.split('(');
                    if (path.includes('${')) {
                        results.push(...this.extractVariablesFromExpression(path));
                    }
                    if (params) {
                        const cleanParams = params.replace(')', '');
                        const paramPairs = cleanParams.split(',');
                        for (const pair of paramPairs) {
                            if (pair.includes('=')) {
                                const [, value] = pair.split('=');
                                results.push(...this.extractVariablesFromExpression(value.trim()));
                            } else {
                                results.push(...this.extractVariablesFromExpression(pair.trim()));
                            }
                        }
                    }
                } else if (urlPath.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(urlPath));
                }
            }
        }

        // Process fragment expressions
        const fragmentPattern = /~\{([^}]+)\}/g;
        while ((match = fragmentPattern.exec(text)) !== null) {
            const [fullMatch, fragmentPath] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                if (fragmentPath.includes('(')) {
                    const [path, params] = fragmentPath.split('(');
                    if (path.includes('${')) {
                        results.push(...this.extractVariablesFromExpression(path));
                    }
                    if (params) {
                        const cleanParams = params.replace(')', '');
                        const paramPairs = cleanParams.split(',');
                        for (const pair of paramPairs) {
                            if (pair.includes('=')) {
                                const [, value] = pair.split('=');
                                results.push(...this.extractVariablesFromExpression(value.trim()));
                            }
                        }
                    }
                } else if (fragmentPath.includes('${')) {
                    results.push(...this.extractVariablesFromExpression(fragmentPath));
                }
            }
        }
    }

    private processComments(text: string, results: [string, string][], processedExpressions: Set<string>): void {
        // Process standard HTML comments
        let match;
        while ((match = ThymeleafVariableParser.HTML_COMMENT_REGEX.exec(text)) !== null) {
            const [fullMatch, content] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                const vars = this.extractVariablesFromExpression(content);
                vars.forEach(([, v]) => results.push([fullMatch, v]));
            }
        }

        // Process Thymeleaf parser-level comment blocks
        while ((match = ThymeleafVariableParser.PARSER_COMMENT_REGEX.exec(text)) !== null) {
            const [fullMatch, content] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                const vars = this.extractVariablesFromExpression(content);
                vars.forEach(([, v]) => results.push([fullMatch, v]));
            }
        }

        // Process Thymeleaf prototype-only comment blocks
        while ((match = ThymeleafVariableParser.PROTOTYPE_COMMENT_REGEX.exec(text)) !== null) {
            const [fullMatch, content] = match;
            if (!processedExpressions.has(fullMatch)) {
                processedExpressions.add(fullMatch);
                const vars = this.extractVariablesFromExpression(content);
                vars.forEach(([, v]) => results.push([fullMatch, v]));
            }
        }
    }

    private extractVariablesFromParameters(params: string): [string, string][] {
        const variables: [string, string][] = [];
        const paramList = this.splitParameters(params);
        
        for (const param of paramList) {
            if (param.includes('${')) {
                const varMatch = /\${([^}]+)}/.exec(param);
                if (varMatch) {
                    variables.push(...this.extractVariablesFromExpression(varMatch[1]));
                }
            } else if (!this.isStringLiteral(param) && !this.isNumericLiteral(param)) {
                variables.push(...this.extractVariablesFromExpression(param));
            }
        }

        return variables;
    }

    private isSecurityFunction(word: string): boolean {
        const securityFunctions = new Set([
            'hasRole', 'hasAnyRole', 'hasAuthority', 'hasAnyAuthority',
            'principal', 'authentication', 'permitAll', 'denyAll',
            'isAnonymous', 'isAuthenticated', 'isFullyAuthenticated',
            'hasIpAddress', 'hasAnyPermission'
        ]);
        return securityFunctions.has(word);
    }
}



