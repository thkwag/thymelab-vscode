export interface IteratorInfo {
    iteratorVars: Set<string>;
    parentVars: Map<string, string>;
    statVars: Map<string, string>;
}

export class ThymeleafVariableParser {
    private readonly EXPRESSION_PATTERNS = {
        VARIABLE:       /\${([^}]+)}/g,
        SELECTION:      /\*{([^}]+)}/g,
        FIELD:          /th:field="[*$]\{([^}]+)\}"/g,
        EACH:           /th:each="([^:\s,]+)(?:\s*,\s*([^:\s]+))?\s*:\s*\${([^}"']+)}"/g,
        UTILITY:        /#[a-zA-Z]+\.[a-zA-Z]+\((.*)\)/,
        PROJECTION:     /([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\.\{([^}]+)\}/,
        LIST_FILTER:    /([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\.\?\[(.*?)\]/,
        METHOD_CALL:    /([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\.[a-zA-Z][a-zA-Z0-9]*\([^)]*\)/g,
        PROPERTY:       /([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)/g,
        AUTH:           /#authentication\.([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)/,
        FIELDS:         /#fields\.hasErrors\(['"]([^'"]+)['"]\)/
    };

    private readonly SPECIAL_FUNCTIONS = new Set([
        'hasRole',
        'size',
        'hasPermission',
        'hasAuthority'
    ]);

    public findIteratorVariables(line: string): IteratorInfo {
        const eachMatches = [...line.matchAll(this.EXPRESSION_PATTERNS.EACH)];
        const iteratorVars = new Set<string>();
        const parentVars = new Map<string, string>();
        const statVars = new Map<string, string>();
        
        for (const [, itemVar, statVar, parentVar] of eachMatches) {
            if (itemVar) {
                const trimmedItem = itemVar.trim();
                iteratorVars.add(trimmedItem);
                parentVars.set(trimmedItem, parentVar.trim());
            }
            if (statVar) {
                const trimmedStat = statVar.trim();
                iteratorVars.add(trimmedStat);
                statVars.set(trimmedStat, parentVar.trim());
            }
        }
        
        return { iteratorVars, parentVars, statVars };
    }

    public findAllVariableMatches(text: string): [string, string][] {
        if (text.includes('\\${')) return [];
        
        const matches: [string, string][] = [];
        const seen = new Set<string>();
        
        this.processExpressions(text, matches, seen);
        this.processFieldExpressions(text, matches, seen);
        
        return matches;
    }

    private processExpressions(text: string, matches: [string, string][], seen: Set<string>): void {
        const allMatches = [
            ...(text.match(this.EXPRESSION_PATTERNS.VARIABLE) || []),
            ...(text.match(this.EXPRESSION_PATTERNS.SELECTION) || [])
        ];
        
        for (const match of allMatches) {
            const expression = match.slice(2, -1).trim();
            if (expression.includes('\\${')) continue;
            
            // Process entire expression
            const vars = this.extractVariablesFromExpression(expression);
            for (const v of vars) {
                const key = `${match}:${v}`;
                if (!seen.has(key)) {
                    matches.push([match, v]);
                    seen.add(key);
                }
            }
            
            // Process list filtering
            if (expression.includes('?[')) {
                const filterMatch = expression.match(/\?\[(.*?)\]/);
                if (filterMatch && filterMatch[1]) {
                    const condition = filterMatch[1].trim();
                    const conditionVars = this.extractVariablesFromExpression(condition);
                    for (const v of conditionVars) {
                        const key = `${match}:${v}`;
                        if (!seen.has(key)) {
                            matches.push([match, v]);
                            seen.add(key);
                        }
                    }
                }
            }
            
            // Process parts separated by logical operators
            const parts = expression.split(/\s*(?:and|or)\s*/);
            for (const part of parts) {
                const cleanPart = part.replace(/[()]/g, '').trim();
                if (this.isValidVariable(cleanPart) && !this.isLogicalOperator(cleanPart)) {
                    const key = `${match}:${cleanPart}`;
                    if (!seen.has(key)) {
                        matches.push([match, cleanPart]);
                        seen.add(key);
                    }
                }
            }
        }
    }

    private processFieldExpressions(text: string, matches: [string, string][], seen: Set<string>): void {
        const fieldMatches = text.match(this.EXPRESSION_PATTERNS.FIELD) || [];
        for (const match of fieldMatches) {
            const expressionMatch = match.match(/[*$]\{([^}]+)\}/);
            if (expressionMatch) {
                this.addVariables(match, expressionMatch[1].trim(), matches, seen);
            }
        }
    }

    private addVariables(match: string, expression: string, matches: [string, string][], seen: Set<string>): void {
        const vars = this.extractVariablesFromExpression(expression);
        vars.forEach(v => {
            const key = `${match}:${v}`;
            if (!seen.has(key)) {
                matches.push([match, v]);
                seen.add(key);
            }
        });
    }

    private extractVariablesFromExpression(expression: string): string[] {
        const vars = new Set<string>();
        const cleanExpression = this.cleanExpression(expression);
        
        // Handle utility expressions (#dates, #numbers, etc.)
        if (expression.startsWith('#')) {
            this.extractUtilityVariables(expression, vars);
            return Array.from(vars);
        }
        
        // Handle list filtering
        if (expression.includes('?[')) {
            const filterMatch = expression.match(/\?\[(.*?)\]/);
            if (filterMatch && filterMatch[1]) {
                const condition = filterMatch[1].trim();
                this.extractComplexExpressionVariables(condition, vars);
            }
            
            // Extract base variable before ?[
            const baseMatch = expression.match(/([^?]+)\?\[/);
            if (baseMatch && baseMatch[1]) {
                this.extractMethodAndPropertyVariables(baseMatch[1].trim(), vars);
            }
        }
        
        // Handle ternary operator
        if (expression.includes('?')) {
            const [condition, ...rest] = expression.split('?');
            this.extractComplexExpressionVariables(condition.trim(), vars);
            if (rest.length > 0) {
                const [truePart, falsePart] = rest.join('?').split(':');
                if (truePart) this.extractComplexExpressionVariables(truePart.trim(), vars);
                if (falsePart) this.extractComplexExpressionVariables(falsePart.trim(), vars);
            }
            return Array.from(vars).filter(v => !this.isLogicalOperator(v));
        }
        
        // Handle arithmetic operators
        if (cleanExpression.match(/[+\-*/%]/)) {
            const parts = cleanExpression.split(/[+\-*/%]/);
            for (const part of parts) {
                const trimmed = part.trim();
                if (this.isValidVariable(trimmed)) {
                    this.addVariableWithParts(trimmed, vars);
                }
            }
        }
        
        // Handle parentheses expressions
        const withoutParens = cleanExpression.replace(/\([^)]+\)/g, match => {
            this.extractComplexExpressionVariables(match.slice(1, -1), vars);
            return '';
        });
        
        // Handle logical operators
        const parts = withoutParens.split(/\s*(?:and|or)\s*/);
        for (const part of parts) {
            const cleanPart = part.trim();
            if (!cleanPart) continue;
            
            if (cleanPart.match(/[><=!]/)) {
                // Handle comparison operators
                const [left, right] = cleanPart.split(/[><=!]+/).map(p => p.trim());
                if (this.isValidVariable(left)) vars.add(left);
                if (this.isValidVariable(right)) vars.add(right);
            } else if (cleanPart.match(/[+\-*/%]/)) {
                // Handle arithmetic operators
                cleanPart.split(/[+\-*/%]/).map(p => p.trim())
                    .filter(p => this.isValidVariable(p))
                    .forEach(p => vars.add(p));
            } else if (cleanPart.includes('.')) {
                // Handle method calls and property access
                this.extractMethodAndPropertyVariables(cleanPart, vars);
            } else if (this.isValidVariable(cleanPart)) {
                // Handle simple variables
                vars.add(cleanPart);
            }
        }
        
        // Handle method calls and properties
        if (cleanExpression.includes('.')) {
            this.extractMethodAndPropertyVariables(cleanExpression, vars);
        }
        
        // Handle simple variables
        if (this.isValidVariable(cleanExpression)) {
            vars.add(cleanExpression);
        }
        
        return Array.from(vars).filter(v => !this.isLogicalOperator(v));
    }

    private cleanExpression(expression: string): string {
        return expression
            .replace(/['"][^'"]*['"]/, '')
            .replace(/\btrue\b|\bfalse\b/, '');
    }

    private extractUtilityVariables(expression: string, vars: Set<string>): void {
        // Handle #fields.hasErrors('user.email')
        const fieldsMatch = expression.match(this.EXPRESSION_PATTERNS.FIELDS);
        if (fieldsMatch && fieldsMatch[1]) {
            const variable = fieldsMatch[1].replace(/['"]/g, '');
            this.addVariableWithParts(variable, vars);
            return;
        }

        // Handle #authentication.principal.username
        const authMatch = expression.match(/#authentication\.(.*?)(?:\s|$|\))/);
        if (authMatch && authMatch[1]) {
            this.addVariableWithParts(authMatch[1], vars);
            return;
        }

        // Handle #lists.size(users.?[age > 18])
        const listMatch = expression.match(/#lists\.size\((.*?)\)/);
        if (listMatch && listMatch[1]) {
            const content = listMatch[1].trim();
            if (content.includes('?[')) {
                const baseMatch = content.match(/([^?]+)\?\[/);
                if (baseMatch && baseMatch[1]) {
                    this.extractMethodAndPropertyVariables(baseMatch[1].trim(), vars);
                }
                const filterMatch = content.match(/\?\[(.*?)\]/);
                if (filterMatch && filterMatch[1]) {
                    this.extractComplexExpressionVariables(filterMatch[1].trim(), vars);
                }
            } else {
                this.extractMethodAndPropertyVariables(content, vars);
            }
            return;
        }

        // Handle #dates.format(date) or #numbers.formatDecimal(number, ...)
        const utilityMatch = expression.match(/#(?:dates|numbers)\.\w+\((.*?)\)/);
        if (utilityMatch && utilityMatch[1]) {
            const params = utilityMatch[1].split(',')[0].trim();
            if (this.isValidVariable(params)) {
                this.addVariableWithParts(params, vars);
            }
            return;
        }

        // Handle #strings.method(variable) and nested utility calls
        const utilityMethodMatch = expression.match(this.EXPRESSION_PATTERNS.UTILITY);
        if (utilityMethodMatch && utilityMethodMatch[1]) {
            const params = utilityMethodMatch[1];
            
            // Handle nested utility functions
            if (params.includes('#')) {
                const nestedMatches = params.match(/#[a-zA-Z]+\.[a-zA-Z]+\([^)]+\)/g) || [];
                for (const nestedMatch of nestedMatches) {
                    this.extractUtilityVariables(nestedMatch, vars);
                }
                
                // Process remaining variables after removing nested functions
                const cleanParams = params.replace(/#[a-zA-Z]+\.[a-zA-Z]+\([^)]+\)/g, '');
                this.extractMethodParameters(cleanParams, vars);
            } else {
                this.extractMethodParameters(params, vars);
            }
        }
    }

    private processSpecialSyntax(param: string, vars: Set<string>): boolean {
        return this.processProjection(param, vars) ||
               this.processListFilter(param, vars);
    }

    private processProjection(expression: string, vars: Set<string>): boolean {
        const match = expression.match(this.EXPRESSION_PATTERNS.PROJECTION);
        if (!match) return false;
        
        const [, baseVar, projVar] = match;
        const cleanBaseVar = baseVar.trim();
        vars.add(cleanBaseVar);
        vars.add(`${cleanBaseVar}.${projVar.trim()}`);
        return true;
    }

    private processListFilter(expression: string, vars: Set<string>): boolean {
        const match = expression.match(this.EXPRESSION_PATTERNS.LIST_FILTER);
        if (!match) return false;
        
        const [, baseVar, condition] = match;
        this.handlePropertyChain(baseVar, vars);
        
        if (condition) {
            // Extract variables from filter condition
            const cleanCondition = condition.trim();
            if (cleanCondition.match(/[><=!+\-*/%]+/)) {
                this.handleOperatorSides(cleanCondition, /\s*[><=!+\-*/%]+\s*/, vars);
            } else if (this.isValidVariable(cleanCondition) && !this.isLogicalOperator(cleanCondition)) {
                vars.add(cleanCondition);
            }
        }
        return true;
    }

    private processAuthentication(expression: string, vars: Set<string>): void {
        const match = expression.match(this.EXPRESSION_PATTERNS.AUTH);
        if (match && match[1]) {
            this.addVariableWithParts(match[1], vars);
        }
    }

    private processFields(expression: string, vars: Set<string>): void {
        const match = expression.match(this.EXPRESSION_PATTERNS.FIELDS);
        if (match && match[1]) {
            this.addVariableWithParts(match[1], vars);
        }
    }

    private extractComplexExpressionVariables(expression: string, vars: Set<string>): void {
        // Handle parentheses expressions
        expression = expression.replace(/\([^)]+\)/g, match => {
            this.extractVariablesFromExpression(match.slice(1, -1)).forEach(v => vars.add(v));
            return '';
        });

        // Handle logical operators
        const parts = expression.split(/\s*(?:and|or)\s*/);
        for (const part of parts) {
            const cleanPart = part.trim();
            if (!cleanPart) continue;
            
            if (cleanPart.match(/[><=!]/)) {
                // Handle comparison operators
                this.handleOperatorSides(cleanPart, /[><=!]+/, vars);
            } else if (cleanPart.match(/[+\-*/%]/)) {
                // Handle arithmetic operators
                this.handleOperatorSides(cleanPart, /[+\-*/%]/, vars);
            } else if (cleanPart.includes('.')) {
                // Handle method calls and property access
                this.extractMethodAndPropertyVariables(cleanPart, vars);
            } else if (this.isValidVariable(cleanPart)) {
                // Handle simple variables
                vars.add(cleanPart);
            }
        }
    }

    private isLogicalOperator(str: string): boolean {
        return ['and', 'or', 'not'].includes(str.toLowerCase());
    }

    private extractMethodAndPropertyVariables(expression: string, vars: Set<string>): void {
        // Handle method calls
        const methodCallMatches = expression.matchAll(this.EXPRESSION_PATTERNS.METHOD_CALL);
        for (const [fullMatch, baseVar] of Array.from(methodCallMatches)) {
            this.handleMethodCall(fullMatch, baseVar, vars);
        }
        
        // Handle property chains
        if (!expression.includes('(')) {
            this.handlePropertyChain(expression, vars);
        }
    }

    private extractMethodParameters(params: string, vars: Set<string>): void {
        const paramList = params.split(',').map(p => p.trim());
        for (const param of paramList) {
            if (param.startsWith('\'') || param.startsWith('"')) continue;
            if (this.isValidVariable(param)) {
                this.addVariableWithParts(param, vars);
            }
        }
    }

    private extractComparisonVariables(expression: string, vars: Set<string>): void {
        const parts = expression.split(/\s*[><=!]+\s*/);
        for (const part of parts) {
            const cleanPart = this.cleanExpressionPart(part);
            if (this.isValidVariable(cleanPart) && !this.isLogicalOperator(cleanPart)) {
                vars.add(cleanPart);
            }
        }
    }

    private cleanExpressionPart(part: string): string {
        return part.trim().replace(/[()]/g, '');
    }

    private isValidVariable(variable: string): boolean {
        if (!variable) return false;
        variable = variable.trim();
        
        // Exclude logical operators, numbers, strings, boolean literals
        if (this.isLogicalOperator(variable) ||
            /^[0-9]+$/.test(variable) ||
            /^['"].*['"]$/.test(variable) ||
            /^(true|false)$/i.test(variable)) {
            return false;
        }
        
        // Check for valid variable/property chain
        return /^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(variable);
    }

    private addVariableWithParts(variable: string, vars: Set<string>): void {
        if (!variable || !this.isValidVariable(variable)) return;
        
        const parts = variable.split('.');
        if (parts.length === 1) {
            vars.add(variable);
            return;
        }
        
        let current = parts[0];
        if (this.isValidVariable(current)) {
            vars.add(current);
            for (let i = 1; i < parts.length; i++) {
                current += '.' + parts[i];
                if (this.isValidVariable(current)) {
                    vars.add(current);
                }
            }
        }
    }

    public findVariableReferences(line: string): Array<{variable: string, startIndex: number, isIteratorVar: boolean}> {
        const matches = [...line.matchAll(this.EXPRESSION_PATTERNS.VARIABLE)];
        const iteratorInfo = this.findIteratorVariables(line);
        
        return matches.map(match => {
            const variable = match[1].trim();
            const startIndex = line.indexOf(variable, line.indexOf(match[0]));
            const isIteratorVar = iteratorInfo.iteratorVars.has(variable.split('.')[0]);
            return { variable, startIndex, isIteratorVar };
        });
    }

    // Common helper methods
    private handlePropertyChain(baseVar: string, vars: Set<string>): void {
        const parts = baseVar.split('.');
        if (parts.length > 0 && this.isValidVariable(parts[0])) {
            let chain = parts[0];
            vars.add(chain);
            for (let i = 1; i < parts.length; i++) {
                chain += '.' + parts[i];
                if (this.isValidVariable(chain)) {
                    vars.add(chain);
                }
            }
        }
    }

    private handleOperatorSides(expression: string, operatorPattern: RegExp | string, vars: Set<string>): void {
        const sides = expression.split(operatorPattern).map(p => p.trim());
        for (const side of sides) {
            if (this.isValidVariable(side)) {
                vars.add(side);
            }
        }
    }

    private handleMethodCall(fullMatch: string, baseVar: string, vars: Set<string>): void {
        // Extract base variable and its chain
        this.handlePropertyChain(baseVar, vars);
        
        // Extract method chain
        const methodName = fullMatch.split('(')[0];
        if (methodName.includes('.')) {
            this.addVariableWithParts(methodName, vars);
        }
        
        // Extract parameters
        const paramsMatch = fullMatch.match(/\((.*)\)/);
        if (paramsMatch && paramsMatch[1]) {
            this.extractMethodParameters(paramsMatch[1], vars);
        }
    }
} 