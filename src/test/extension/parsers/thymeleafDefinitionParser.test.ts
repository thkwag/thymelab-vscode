import * as assert from 'assert';
import { ThymeleafDefinitionParser } from '../../../extension/parsers/thymeleafDefinitionParser';

suite('ThymeleafDefinitionParser', () => {
    let parser: ThymeleafDefinitionParser;

    setup(() => {
        parser = new ThymeleafDefinitionParser();
    });

    suite('findTemplateReferences', () => {
        test('should find layout:decorate references', () => {
            const line = 'layout:decorate="~{layouts/default}"';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.deepStrictEqual(refs[0], {
                path: 'layouts/default',
                startIndex: line.indexOf('layouts/default')
            });
        });

        test('should find th:replace references', () => {
            const line = '<div th:replace="fragments/header :: header"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.deepStrictEqual(refs[0], {
                path: 'fragments/header',
                startIndex: line.indexOf('fragments/header')
            });
        });

        test('should find th:insert references', () => {
            const line = '<div th:insert="fragments/footer :: footer"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.deepStrictEqual(refs[0], {
                path: 'fragments/footer',
                startIndex: line.indexOf('fragments/footer')
            });
        });

        test('should find fragment references', () => {
            const line = '<div th:replace="~{fragments/common :: alert}"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.deepStrictEqual(refs[0], {
                path: 'fragments/common',
                startIndex: line.indexOf('fragments/common')
            });
        });

        test('should find static references', () => {
            const line = '<link rel="stylesheet" th:href="@{/css/main.css}">';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.deepStrictEqual(refs[0], {
                path: 'css/main.css',
                startIndex: refs[0].startIndex
            });
        });

        test('should find multiple references in one line', () => {
            const line = '<div th:replace="~{fragments/header :: header}" th:insert="fragments/nav :: nav"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 2);
            assert.strictEqual(refs[0].path, 'fragments/header');
            assert.strictEqual(refs[1].path, 'fragments/nav');
        });

        suite('Edge Cases and Special Scenarios', () => {
            test('should handle template references with query parameters', () => {
                const line = '<div th:replace="fragments/header :: header(title=\'Home\', showSearch=true)"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'fragments/header');
            });

            test('should handle template references with expressions', () => {
                const line = '<div th:replace="fragments/${user.theme}/header :: header"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'fragments/${user.theme}/header');
            });

            test('should handle template references with multiple colons', () => {
                const line = '<div th:replace="fragments/dialogs :: confirm::#popup"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'fragments/dialogs');
            });

            test('should handle template references with special characters', () => {
                const line = '<div th:replace="fragments/user-profile :: user_details"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'fragments/user-profile');
            });
        });

        suite('Multiple References in Complex Scenarios', () => {
            test('should handle nested template references', () => {
                const line = `
                    <div th:replace="fragments/header :: header">
                        <div th:insert="fragments/loading :: spinner"></div>
                    </div>
                `;
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 2);
                assert.ok(references.map(r => r.path).includes('fragments/header'));
                assert.ok(references.map(r => r.path).includes('fragments/loading'));
            });
        });

        suite('Error Cases', () => {
            test('should handle malformed template references', () => {
                const line = '<div th:replace="::"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 0);
            });

            test('should handle empty template references', () => {
                const line = '<div th:replace=""></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 0);
            });

            test('should handle template references with invalid characters', () => {
                const line = '<div th:replace="fragments/<invalid>/header :: header"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 0);
            });
        });

        suite('Alternative Template Reference Attributes', () => {
            test('should handle th:include attribute', () => {
                const line = '<div th:include="fragments/footer :: footer"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'fragments/footer');
            });

            test('should handle th:substituteby attribute (legacy)', () => {
                const line = '<div th:substituteby="fragments/menu :: menu"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'fragments/menu');
            });

            test('should handle th:insert with fragment expressions', () => {
                const line = '<div th:insert="~{fragments/common :: ${fragmentName}}"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'fragments/common');
            });
        });

        suite('Template Reference Patterns', () => {
            test('should handle references with file extensions', () => {
                const line = '<div th:replace="fragments/header.html :: header"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'fragments/header.html');
            });

            test('should handle references with multiple path segments', () => {
                const line = '<div th:replace="views/admin/dashboard/widgets :: statsWidget"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, 'views/admin/dashboard/widgets');
            });

            test('should handle references with relative paths', () => {
                const line = '<div th:replace="../common/fragments/header :: header"></div>';
                const references = parser.findTemplateReferences(line);
                assert.strictEqual(references.length, 1);
                assert.strictEqual(references[0].path, '../common/fragments/header');
            });
        });
    });

    suite('isFragmentDefinition', () => {
        test('should identify fragment definitions', () => {
            assert.strictEqual(parser.isFragmentDefinition('th:fragment="header"'), true);
            assert.strictEqual(parser.isFragmentDefinition('th:fragment=\'footer\''), true);
            assert.strictEqual(parser.isFragmentDefinition('class="header"'), false);
        });
    });

    suite('isDynamicLink', () => {
        test('should identify dynamic links', () => {
            assert.strictEqual(parser.isDynamicLink('@{${dynamicUrl}}'), true);
            assert.strictEqual(parser.isDynamicLink('@{/static/url}'), false);
        });
    });

    suite('findFragmentInText', () => {
        test('should find fragment position in text', () => {
            const text = `
                <div>Some content</div>
                <div th:fragment="header">Header content</div>
                <div>More content</div>
            `;
            const position = parser.findFragmentInText(text, 'header');
            assert.ok(position);
            assert.strictEqual(position?.line, 2);
            assert.ok(position?.character > 0);
        });

        test('should return undefined for non-existent fragment', () => {
            const text = '<div>No fragment here</div>';
            const position = parser.findFragmentInText(text, 'nonexistent');
            assert.strictEqual(position, undefined);
        });
    });

    suite('parseFragmentReference', () => {
        test('should parse simple fragment reference', () => {
            const result = parser.parseFragmentReference('fragments/header');
            assert.deepStrictEqual(result, {
                templateFile: 'fragments/header',
                fragmentId: null
            });
        });

        test('should parse fragment reference with ID', () => {
            const result = parser.parseFragmentReference('fragments/common :: alert');
            assert.deepStrictEqual(result, {
                templateFile: 'fragments/common',
                fragmentId: 'alert'
            });
        });
    });

    suite('path normalization', () => {
        test('should normalize resource path', () => {
            assert.strictEqual(parser.normalizeResourcePath('/css/main.css'), 'css/main.css');
            assert.strictEqual(parser.normalizeResourcePath('css/main.css'), 'css/main.css');
        });

        test('should normalize path separators', () => {
            assert.strictEqual(parser.normalizePath('templates\\fragments\\header'), 'templates/fragments/header');
            assert.strictEqual(parser.normalizePath('templates/fragments/header'), 'templates/fragments/header');
        });

        test('should handle path prefix removal', () => {
            const path = 'src/templates/fragments/header';
            const prefix = 'src/templates/';
            assert.strictEqual(parser.getPathWithoutPrefix(path, prefix), 'fragments/header');
        });
    });

    suite('getPossibleStaticPaths', () => {
        test('should generate all possible static resource paths', () => {
            const paths = parser.getPossibleStaticPaths('images/logo');
            assert.ok(paths.includes('images/logo.png'));
            assert.ok(paths.includes('images/logo.jpg'));
            assert.ok(paths.includes('images/logo.svg'));
            assert.strictEqual(paths.length, 8); // Total number of supported extensions
        });
    });
}); 