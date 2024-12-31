import { ThymeleafDefinitionParser } from '../../extension/thymeleafDefinitionParser';

describe('ThymeleafDefinitionParser', () => {
    let parser: ThymeleafDefinitionParser;

    beforeEach(() => {
        parser = new ThymeleafDefinitionParser();
    });

    describe('findTemplateReferences', () => {
        it('should find layout:decorate references', () => {
            const line = 'layout:decorate="~{layouts/default}"';
            const refs = parser.findTemplateReferences(line);
            expect(refs).toHaveLength(1);
            expect(refs[0]).toEqual({
                path: 'layouts/default',
                startIndex: line.indexOf('layouts/default')
            });
        });

        it('should find th:replace references', () => {
            const line = '<div th:replace="fragments/header :: header"></div>';
            const refs = parser.findTemplateReferences(line);
            expect(refs).toHaveLength(1);
            expect(refs[0]).toEqual({
                path: 'fragments/header',
                startIndex: line.indexOf('fragments/header')
            });
        });

        it('should find th:insert references', () => {
            const line = '<div th:insert="fragments/footer :: footer"></div>';
            const refs = parser.findTemplateReferences(line);
            expect(refs).toHaveLength(1);
            expect(refs[0]).toEqual({
                path: 'fragments/footer',
                startIndex: line.indexOf('fragments/footer')
            });
        });

        it('should find fragment references', () => {
            const line = '<div th:replace="~{fragments/common :: alert}"></div>';
            const refs = parser.findTemplateReferences(line);
            expect(refs).toHaveLength(1);
            expect(refs[0]).toEqual({
                path: 'fragments/common',
                startIndex: line.indexOf('fragments/common')
            });
        });

        it('should find static references', () => {
            const line = '<link rel="stylesheet" th:href="@{/css/main.css}">';
            const refs = parser.findTemplateReferences(line);
            expect(refs).toHaveLength(1);
            expect(refs[0]).toEqual({
                path: 'css/main.css',
                startIndex: refs[0].startIndex
            });
        });

        it('should find multiple references in one line', () => {
            const line = '<div th:replace="~{fragments/header :: header}" th:insert="fragments/nav :: nav"></div>';
            const refs = parser.findTemplateReferences(line);
            expect(refs).toHaveLength(2);
            expect(refs[0].path).toBe('fragments/header');
            expect(refs[1].path).toBe('fragments/nav');
        });
    });

    describe('isFragmentDefinition', () => {
        it('should identify fragment definitions', () => {
            expect(parser.isFragmentDefinition('th:fragment="header"')).toBe(true);
            expect(parser.isFragmentDefinition('th:fragment=\'footer\'')).toBe(true);
            expect(parser.isFragmentDefinition('class="header"')).toBe(false);
        });
    });

    describe('isDynamicLink', () => {
        it('should identify dynamic links', () => {
            expect(parser.isDynamicLink('@{${dynamicUrl}}')).toBe(true);
            expect(parser.isDynamicLink('@{/static/url}')).toBe(false);
        });
    });

    describe('findFragmentInText', () => {
        it('should find fragment position in text', () => {
            const text = `
                <div>Some content</div>
                <div th:fragment="header">Header content</div>
                <div>More content</div>
            `;
            const position = parser.findFragmentInText(text, 'header');
            expect(position).toBeDefined();
            expect(position?.line).toBe(2);
            expect(position?.character).toBeGreaterThan(0);
        });

        it('should return undefined for non-existent fragment', () => {
            const text = '<div>No fragment here</div>';
            const position = parser.findFragmentInText(text, 'nonexistent');
            expect(position).toBeUndefined();
        });
    });

    describe('parseFragmentReference', () => {
        it('should parse simple fragment reference', () => {
            const result = parser.parseFragmentReference('fragments/header');
            expect(result).toEqual({
                templateFile: 'fragments/header',
                fragmentId: null
            });
        });

        it('should parse fragment reference with ID', () => {
            const result = parser.parseFragmentReference('fragments/common :: alert');
            expect(result).toEqual({
                templateFile: 'fragments/common',
                fragmentId: 'alert'
            });
        });
    });

    describe('path normalization', () => {
        it('should normalize resource path', () => {
            expect(parser.normalizeResourcePath('/css/main.css')).toBe('css/main.css');
            expect(parser.normalizeResourcePath('css/main.css')).toBe('css/main.css');
        });

        it('should normalize path separators', () => {
            expect(parser.normalizePath('templates\\fragments\\header')).toBe('templates/fragments/header');
            expect(parser.normalizePath('templates/fragments/header')).toBe('templates/fragments/header');
        });

        it('should handle path prefix removal', () => {
            const path = 'src/templates/fragments/header';
            const prefix = 'src/templates/';
            expect(parser.getPathWithoutPrefix(path, prefix)).toBe('fragments/header');
        });
    });

    describe('getPossibleStaticPaths', () => {
        it('should generate all possible static resource paths', () => {
            const paths = parser.getPossibleStaticPaths('images/logo');
            expect(paths).toContain('images/logo.png');
            expect(paths).toContain('images/logo.jpg');
            expect(paths).toContain('images/logo.svg');
            expect(paths).toHaveLength(8); // Total number of supported extensions
        });
    });

    describe('ThymeleafDefinitionParser - Template References', () => {
        describe('Edge Cases and Special Scenarios', () => {
            test('should handle template references with query parameters', () => {
                const line = '<div th:replace="fragments/header :: header(title=\'Home\', showSearch=true)"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('fragments/header');
            });

            test('should handle template references with expressions', () => {
                const line = '<div th:replace="fragments/${user.theme}/header :: header"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('fragments/${user.theme}/header');
            });

            test('should handle template references with multiple colons', () => {
                const line = '<div th:replace="fragments/dialogs :: confirm::#popup"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('fragments/dialogs');
            });

            test('should handle template references with special characters', () => {
                const line = '<div th:replace="fragments/user-profile :: user_details"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('fragments/user-profile');
            });
        });

        describe('Multiple References in Complex Scenarios', () => {
            test('should handle nested template references', () => {
                const line = `
                    <div th:replace="fragments/header :: header">
                        <div th:insert="fragments/loading :: spinner"></div>
                    </div>
                `;
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(2);
                expect(references.map(r => r.path)).toContain('fragments/header');
                expect(references.map(r => r.path)).toContain('fragments/loading');
            });
        });

        describe('Error Cases', () => {
            test('should handle malformed template references', () => {
                const line = '<div th:replace="::"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(0);
            });

            test('should handle empty template references', () => {
                const line = '<div th:replace=""></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(0);
            });

            test('should handle template references with invalid characters', () => {
                const line = '<div th:replace="fragments/<invalid>/header :: header"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(0);
            });
        });

        describe('Alternative Template Reference Attributes', () => {
            test('should handle th:include attribute', () => {
                const line = '<div th:include="fragments/footer :: footer"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('fragments/footer');
            });

            test('should handle th:substituteby attribute (legacy)', () => {
                const line = '<div th:substituteby="fragments/menu :: menu"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('fragments/menu');
            });

            test('should handle th:insert with fragment expressions', () => {
                const line = '<div th:insert="~{fragments/common :: ${fragmentName}}"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('fragments/common');
            });
        });

        describe('Template Reference Patterns', () => {
            test('should handle references with file extensions', () => {
                const line = '<div th:replace="fragments/header.html :: header"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('fragments/header.html');
            });

            test('should handle references with multiple path segments', () => {
                const line = '<div th:replace="views/admin/dashboard/widgets :: statsWidget"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('views/admin/dashboard/widgets');
            });

            test('should handle references with relative paths', () => {
                const line = '<div th:replace="../common/fragments/header :: header"></div>';
                const references = parser.findTemplateReferences(line);
                expect(references).toHaveLength(1);
                expect(references[0].path).toBe('../common/fragments/header');
            });
        });
    });
}); 