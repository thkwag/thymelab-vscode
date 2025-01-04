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

    suite('Standard Expression Syntax', () => {
        suite('Variable Expressions ${...}', () => {
            test('should handle variable expressions in template references', () => {
                const line = '<div th:replace="fragments/${user.theme}/header :: header"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/${user.theme}/header');
            });

            test('should handle nested variable expressions', () => {
                const line = '<div th:replace="fragments/${user.${preference.theme}}/header :: header"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/${user.${preference.theme}}/header');
            });
        });

        suite('Selection Variable Expressions *{...}', () => {
            test('should handle selection expressions in template references', () => {
                const line = '<div th:replace="fragments/*{user.theme}/header :: header"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/*{user.theme}/header');
            });
        });

        suite('Message Expressions #{...}', () => {
            test('should handle message expressions in template references', () => {
                const line = '<div th:replace="fragments/#{template.path}/header :: header"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/#{template.path}/header');
            });
        });

        suite('Link URL Expressions @{...}', () => {
            test('should handle absolute URLs', () => {
                const line = '<a th:href="@{/static/images/logo.png}">Logo</a>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'static/images/logo.png');
            });

            test('should handle context-relative URLs', () => {
                const line = '<a th:href="@{~/static/images/logo.png}">Logo</a>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'static/images/logo.png');
            });

            test('should handle parameterized URLs', () => {
                const line = '<a th:href="@{/order/details(id=${order.id})}">View</a>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'order/details');
            });
        });

        suite('Fragment Expressions ~{...}', () => {
            test('should handle simple fragment expressions', () => {
                const line = '<div th:insert="~{commons :: header}"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'commons');
            });

            test('should handle fragment expressions with parameters', () => {
                const line = '<div th:insert="~{commons :: header(title=\'Main\')}"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'commons');
            });

            test('should handle fragment expressions with complex selectors', () => {
                const line = '<div th:insert="~{commons :: #main-header/div[1]}"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'commons');
            });
        });
    });

    suite('Attribute Precedence', () => {
        test('should handle layout:decorate with highest precedence', () => {
            const line = 'layout:decorate="~{layouts/default}" th:include="other/template"';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 2);
            assert.strictEqual(refs[0].path, 'layouts/default');
            assert.strictEqual(refs[1].path, 'other/template');
        });

        test('should handle multiple attributes in precedence order', () => {
            const line = '<div th:insert="content" th:replace="other" th:include="another"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 3);
            assert.deepStrictEqual(refs.map(r => r.path), ['content', 'other', 'another']);
        });
    });

    suite('Template Layout', () => {
        test('should handle layout:decorate with fragment definitions', () => {
            const line = 'layout:decorate="~{layouts/default}" th:fragment="content"';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'layouts/default');
            assert.strictEqual(parser.isFragmentDefinition('th:fragment="content"'), true);
        });

        test('should handle layout:fragment definitions', () => {
            assert.strictEqual(parser.isFragmentDefinition('layout:fragment="content"'), true);
        });
    });

    suite('Iteration', () => {
        test('should handle th:each with template references', () => {
            const line = '<div th:each="item : ${items}" th:replace="fragments/item :: itemTemplate"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'fragments/item');
        });
    });

    suite('Conditional Evaluation', () => {
        test('should handle th:if with template references', () => {
            const line = '<div th:if="${condition}" th:replace="fragments/conditional :: content"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'fragments/conditional');
        });

        test('should handle th:switch/th:case with template references', () => {
            const line = `
                <div th:switch="\${someValue}">
                    <div th:case="1" th:replace="fragments/case1 :: content"></div>
                    <div th:case="2" th:replace="fragments/case2 :: content"></div>
                </div>
            `;
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 2);
            assert.deepStrictEqual(refs.map(r => r.path), ['fragments/case1', 'fragments/case2']);
        });
    });

    suite('Local Variables', () => {
        test('should handle th:with with template references', () => {
            const line = '<div th:with="var=${value}" th:replace="fragments/template :: content"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'fragments/template');
        });
    });

    suite('Attribute Modification', () => {
        test('should handle th:attr with template references', () => {
            const line = '<div th:attr="data-template=@{/templates/fragment}" th:replace="fragments/template :: content"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 2);
            assert.ok(refs.map(r => r.path).includes('templates/fragment'));
            assert.ok(refs.map(r => r.path).includes('fragments/template'));
        });
    });

    suite('Template Modes', () => {
        test('should handle HTML template mode', () => {
            const line = '<div th:replace="fragments/html :: content"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'fragments/html');
        });

        test('should handle XML template mode', () => {
            const line = '<fragment th:replace="fragments/xml :: content"/>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'fragments/xml');
        });

        test('should handle TEXT template mode', () => {
            const line = '[# th:replace="fragments/text :: content"/]';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'fragments/text');
        });
    });

    suite('Template Resolvers', () => {
        test('should handle classpath template resolver paths', () => {
            const line = '<div th:replace="classpath:templates/fragment :: content"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'templates/fragment');
        });

        test('should handle file template resolver paths', () => {
            const line = '<div th:replace="file:/templates/fragment :: content"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'templates/fragment');
        });
    });

    suite('Expression Preprocessing', () => {
        test('should handle preprocessed expressions', () => {
            const line = '<div th:replace="__${templateName}__ :: content"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, '__${templateName}__');
        });
    });

    suite('Inlining', () => {
        test('should handle th:inline text', () => {
            const line = '<script th:inline="text" th:include="scripts/text :: content"></script>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'scripts/text');
        });

        test('should handle th:inline javascript', () => {
            const line = '<script th:inline="javascript" th:include="scripts/js :: content"></script>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'scripts/js');
        });
    });

    suite('Template Inheritance', () => {
        test('should handle multiple levels of template inheritance', () => {
            const lines = [
                'layout:decorate="~{layouts/base}"',
                '<div th:replace="fragments/header :: header"></div>',
                '<div th:replace="fragments/footer :: footer"></div>'
            ].join('\n');
            const refs = parser.findTemplateReferences(lines);
            assert.strictEqual(refs.length, 3);
            assert.deepStrictEqual(refs.map(r => r.path), [
                'layouts/base',
                'fragments/header',
                'fragments/footer'
            ]);
        });

        test('should handle nested fragment definitions', () => {
            const line = '<div th:fragment="content" th:replace="fragments/nested :: innerContent"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'fragments/nested');
            assert.strictEqual(parser.isFragmentDefinition('th:fragment="content"'), true);
        });
    });

    suite('Resource Handling', () => {
        test('should handle static resource references', () => {
            const lines = [
                '<link th:href="@{/css/main.css}">',
                '<script th:src="@{/js/app.js}">',
                '<img th:src="@{/images/logo.png}">'
            ].join('\n');
            const refs = parser.findTemplateReferences(lines);
            assert.strictEqual(refs.length, 3);
            assert.deepStrictEqual(refs.map(r => r.path), [
                'css/main.css',
                'js/app.js',
                'images/logo.png'
            ]);
        });

        test('should handle resource bundles', () => {
            const line = '<div th:replace="fragments/messages :: #{message.key}"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'fragments/messages');
        });
    });

    suite('Security', () => {
        test('should handle Spring Security integration', () => {
            const line = '<div sec:authorize="hasRole(\'ADMIN\')" th:replace="admin/dashboard :: content"></div>';
            const refs = parser.findTemplateReferences(line);
            assert.strictEqual(refs.length, 1);
            assert.strictEqual(refs[0].path, 'admin/dashboard');
        });
    });

    suite('Advanced Features', () => {
        suite('Fragment Expressions with Complex Selectors', () => {
            test('should handle DOM selector fragments', () => {
                const line = '<div th:replace="fragments/content :: .content-class"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/content');
            });

            test('should handle fragment with multiple selectors', () => {
                const line = '<div th:replace="fragments/content :: div.main > div.content"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/content');
            });
        });

        suite('Expression Utility Objects', () => {
            test('should handle dates utility object usage', () => {
                const line = '<div th:with="now=${#dates.format(#dates.createNow(),\'dd-MM-yyyy\')}" th:replace="fragments/date :: content"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/date');
            });

            test('should handle strings utility object usage', () => {
                const line = '<div th:with="upper=${#strings.toUpperCase(name)}" th:replace="fragments/text :: content"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/text');
            });
        });

        suite('Template Logic', () => {
            test('should handle complex conditional template selection', () => {
                const line = '<div th:replace="${user.isAdmin()} ? \'admin/dashboard :: content\' : \'user/dashboard :: content\'"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 2);
                assert.deepStrictEqual(refs.map(r => r.path), ['admin/dashboard', 'user/dashboard']);
            });

            test('should handle elvis operator in template selection', () => {
                const line = '<div th:replace="${layout} ?: \'default/layout :: content\'"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'default/layout');
            });
        });

        suite('No-Operation Tokens', () => {
            test('should handle underscore token in template references', () => {
                const line = '<div th:replace="${condition} ? \'fragments/special :: content\' : _"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/special');
            });
        });

        suite('Fragment Specification Variants', () => {
            test('should handle fragment without selector', () => {
                const line = '<div th:replace="~{fragments/simple}"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/simple');
            });

            test('should handle fragment with parameters and complex expressions', () => {
                const line = '<div th:replace="fragments/complex :: frag (${user.name != null ? user.name : \'Anonymous\'})"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/complex');
            });
        });

        suite('Literal Substitutions', () => {
            test('should handle literal substitutions in template references', () => {
                const line = '<div th:replace="|fragments/${folder}/content|"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, 'fragments/${folder}/content');
            });

            test('should handle multiple literal substitutions', () => {
                const line = '<div th:replace="|${prefix}/fragments/${name}/content|"></div>';
                const refs = parser.findTemplateReferences(line);
                assert.strictEqual(refs.length, 1);
                assert.strictEqual(refs[0].path, '${prefix}/fragments/${name}/content');
            });
        });
    });
}); 