import * as assert from 'assert';
import { ThymeleafVariableParser } from '../../../extension/parsers/thymeleafVariableParser';

suite('ThymeleafVariableParser - Variable Detection', () => {
    let parser: ThymeleafVariableParser;

    setup(() => {
        parser = new ThymeleafVariableParser();
    });

    suite('Basic Text Expressions', () => {
        test('should detect standard ${...} expressions', () => {
            const line = '<p th:text="${message}">Default message</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${message}' && v[1] === 'message'));
        });

        test('should detect utext expressions', () => {
            const line = '<p th:utext="${htmlMessage}">HTML message</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${htmlMessage}' && v[1] === 'htmlMessage'));
        });
    });

    suite('URL Expressions', () => {
        test('should handle static URLs', () => {
            const line = '<a th:href="@{/home}">Go to Home</a>';
            const variables = parser.findAllVariableMatches(line);
            assert.strictEqual(variables.length, 0);
        });

        test('should handle URL parameters', () => {
            const line = '<a th:href="@{/user/{id}(id=${userId})}">User Profile</a>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${userId}' && v[1] === 'userId'));
        });

        test('should handle multiple URL parameters', () => {
            const line = '<a th:href="@{/user/profile(id=${userId}, tab=\'info\')}">Profile</a>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${userId}' && v[1] === 'userId'));
        });
    });

    suite('Conditional Statements', () => {
        test('should handle th:if expressions', () => {
            const line = '<p th:if="${isAdmin}">You are an administrator</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${isAdmin}' && v[1] === 'isAdmin'));
        });

        test('should handle th:unless expressions', () => {
            const line = '<p th:unless="${isAdmin}">You are a regular user</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${isAdmin}' && v[1] === 'isAdmin'));
        });

        test('should handle th:switch expressions', () => {
            const line = '<div th:switch="${userRole}">';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${userRole}' && v[1] === 'userRole'));
        });
    });

    suite('Iteration', () => {
        test('should handle simple iteration', () => {
            const line = '<li th:each="item : ${items}" th:text="${item}"></li>';
            const iterInfo = parser.findIteratorVariables(line);
            assert.ok(Array.from(iterInfo.iteratorVars).includes('item'));
            assert.strictEqual(iterInfo.parentVars.get('item'), 'items');
        });

        test('should handle iteration with status variable', () => {
            const line = '<li th:each="user, stat : ${users}"><span th:text="${stat.index}"></span></li>';
            const iterInfo = parser.findIteratorVariables(line);
            assert.ok(Array.from(iterInfo.iteratorVars).includes('user'));
            assert.ok(Array.from(iterInfo.iteratorVars).includes('stat'));
            assert.strictEqual(iterInfo.parentVars.get('user'), 'users');
        });

        test('should handle nested properties in iteration', () => {
            const line = '<li th:each="user : ${users}" th:text="${user.name}"></li>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
        });
    });

    suite('Object Properties', () => {
        test('should handle direct object properties', () => {
            const line = '<p th:text="${user.name}">User Name</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(variables.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle multiple object properties', () => {
            const line = '<p th:text="${user.address.street}">123 Main St</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${user.address.street}' && v[1] === 'user.address.street'));
            assert.ok(variables.some(v => v[0] === '${user.address.street}' && v[1] === 'user.address'));
            assert.ok(variables.some(v => v[0] === '${user.address.street}' && v[1] === 'user'));
        });
    });

    suite('Utility Objects', () => {
        test('should handle date formatting', () => {
            const line = '<p th:text="${#temporals.format(now, \'yyyy-MM-dd\')}">2024-03-31</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${#temporals.format(now, \'yyyy-MM-dd\')}' && v[1] === 'now'));
            assert.ok(!variables.some(v => v[0] === '${#temporals.format(now, \'yyyy-MM-dd\')}' && v[1] === '#temporals'));
        });

        test('should handle number formatting', () => {
            const line = '<p th:text="${#numbers.formatDecimal(price, 1, \'COMMA\', 2, \'POINT\')}">1,234.56</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${#numbers.formatDecimal(price, 1, \'COMMA\', 2, \'POINT\')}' && v[1] === 'price'));
            assert.ok(!variables.some(v => v[0] === '${#numbers.formatDecimal(price, 1, \'COMMA\', 2, \'POINT\')}' && v[1] === '#numbers'));
        });

        test('should handle string operations', () => {
            const line = '<p th:text="${#strings.toUpperCase(message)}">UPPERCASE</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${#strings.toUpperCase(message)}' && v[1] === 'message'));
            assert.ok(!variables.some(v => v[0] === '${#strings.toUpperCase(message)}' && v[1] === '#strings'));
        });
    });

    suite('Elvis Operator', () => {
        test('should handle Elvis operator expressions', () => {
            const line = '<p th:text="${user.name ?: \'Anonymous\'}">Name</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${user.name ?: \'Anonymous\'}' && v[1] === 'user.name'));
        });
    });

    suite('Complex Expressions', () => {
        test('should handle boolean expressions', () => {
            const line = '<p th:if="${isAdmin and hasPermission}">Admin with permission</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${isAdmin and hasPermission}' && v[1] === 'isAdmin'));
            assert.ok(variables.some(v => v[0] === '${isAdmin and hasPermission}' && v[1] === 'hasPermission'));
            assert.ok(!variables.some(v => v[0] === '${isAdmin and hasPermission}' && v[1] === 'and'));
        });

        test('should handle complex boolean expressions', () => {
            const line = '<p th:if="${age >= 18 and (hasLicense or hasPermit)}">Can Drive</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${age >= 18 and (hasLicense or hasPermit)}' && v[1] === 'age'));
            assert.ok(variables.some(v => v[0] === '${age >= 18 and (hasLicense or hasPermit)}' && v[1] === 'hasLicense'));
            assert.ok(variables.some(v => v[0] === '${age >= 18 and (hasLicense or hasPermit)}' && v[1] === 'hasPermit'));
            assert.ok(!variables.some(v => v[0] === '${age >= 18 and (hasLicense or hasPermit)}' && v[1] === 'or'));
            assert.ok(!variables.some(v => v[0] === '${age >= 18 and (hasLicense or hasPermit)}' && v[1] === 'and'));
        });

        test('should handle ternary expressions', () => {
            const line = '<p th:text="${isAdmin ? \'Admin\' : \'User\'}">Role</p>';
            const variables = parser.findAllVariableMatches(line);
            assert.ok(variables.some(v => v[0] === '${isAdmin ? \'Admin\' : \'User\'}' && v[1] === 'isAdmin'));
        });
    });

    suite('Selection Variable Expressions', () => {
        test('should handle array selection', () => {
            const line = '<div th:each="user : ${users.?[age > 18]}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${users.?[age > 18]}' && v[1] === 'users'));
            assert.ok(matches.some(v => v[0] === '${users.?[age > 18]}' && v[1] === 'age'));
            assert.ok(!matches.some(v => v[0] === '${users.?[age > 18]}' && v[1] === 'users.age'));
        });

        test('should handle list filtering', () => {
            const line = '<div th:each="product : ${products.?[price < 100]}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${products.?[price < 100]}' && v[1] === 'products'));
            assert.ok(matches.some(v => v[0] === '${products.?[price < 100]}' && v[1] === 'price'));
            assert.ok(!matches.some(v => v[0] === '${products.?[price < 100]}' && v[1] === 'products.price'));
        });

        test('should handle map selection', () => {
            const line = '<div th:text="${users.?[key.length > 5]}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${users.?[key.length > 5]}' && v[1] === 'users'));
            assert.ok(matches.some(v => v[0] === '${users.?[key.length > 5]}' && v[1] === 'key.length'));
            assert.ok(matches.some(v => v[0] === '${users.?[key.length > 5]}' && v[1] === 'key'));
        });
    });

    suite('Form Handling', () => {
        test('should handle form field binding', () => {
            const line = '<input type="text" th:field="*{user.name}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '*{user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '*{user.name}' && v[1] === 'user'));
        });

        test('should handle error messages', () => {
            const line = '<div th:errors="*{user.email}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '*{user.email}' && v[1] === 'user.email'));
            assert.ok(matches.some(v => v[0] === '*{user.email}' && v[1] === 'user'));
        });

        test('should handle form validation status', () => {
            const line = '<div th:class="${#fields.hasErrors(\'user.email\')}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#fields.hasErrors(\'user.email\')}' && v[1] === 'user.email'));
            assert.ok(matches.some(v => v[0] === '${#fields.hasErrors(\'user.email\')}' && v[1] === 'user'));
        });
    });

    suite('Security Expressions', () => {
        test('should handle authentication checks', () => {
            const line = '<div th:if="${#authentication.principal.username == \'admin\'}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#authentication.principal.username == \'admin\'}' && v[1] === 'principal.username'));
            assert.ok(matches.some(v => v[0] === '${#authentication.principal.username == \'admin\'}' && v[1] === 'principal'));
            assert.ok(!matches.some(v => v[0] === '${#authentication.principal.username == \'admin\'}' && v[1] === '#authentication'));
        });

        test('should handle authorization checks', () => {
            const line = '<div th:if="${hasRole(\'ROLE_ADMIN\') and user.isEnabled()}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${hasRole(\'ROLE_ADMIN\') and user.isEnabled()}' && v[1] === 'user'));
            assert.ok(matches.some(v => v[0] === '${hasRole(\'ROLE_ADMIN\') and user.isEnabled()}' && v[1] === 'user.isEnabled'));
            assert.ok(!matches.some(v => v[0] === '${hasRole(\'ROLE_ADMIN\') and user.isEnabled()}' && v[1] === 'hasRole'));
        });
    });

    suite('Complex Nested Scenarios', () => {
        test('should handle deeply nested properties', () => {
            const line = '<div th:text="${user.address.city.name}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.address.city.name}' && v[1] === 'user.address.city.name'));
            assert.ok(matches.some(v => v[0] === '${user.address.city.name}' && v[1] === 'user.address.city'));
            assert.ok(matches.some(v => v[0] === '${user.address.city.name}' && v[1] === 'user.address'));
            assert.ok(matches.some(v => v[0] === '${user.address.city.name}' && v[1] === 'user'));
        });

        test('should handle nested method calls with properties', () => {
            const line = '<div th:text="${order.getItems().?[price > 100].size()}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${order.getItems().?[price > 100].size()}' && v[1] === 'order'));
            assert.ok(matches.some(v => v[0] === '${order.getItems().?[price > 100].size()}' && v[1] === 'order.getItems'));
            assert.ok(matches.some(v => v[0] === '${order.getItems().?[price > 100].size()}' && v[1] === 'price'));
            assert.ok(!matches.some(v => v[0] === '${order.getItems().?[price > 100].size()}' && v[1] === 'size'));
        });

        test('should handle complex conditional expressions', () => {
            const line = '<div th:if="${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}' && v[1] === 'user'));
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}' && v[1] === 'user.age'));
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}' && v[1] === 'user.hasRole'));
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}' && v[1] === 'user.parent'));
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}' && v[1] === 'user.parent.hasApproved'));
        });
    });

    suite('Edge Cases and Special Scenarios', () => {
        test('should handle escaped expressions', () => {
            const line = '<div th:text="\\${user.name}">';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle mixed quotes', () => {
            const line = '<div th:text=\'${user.getName("Smith")}\'>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.getName("Smith")}' && v[1] === 'user'));
            assert.ok(matches.some(v => v[0] === '${user.getName("Smith")}' && v[1] === 'user.getName'));
        });

        test('should handle line breaks in expressions', () => {
            const line = '<div th:text="${user.name\n + \' \' + \nuser.surname}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name\n + \' \' + \nuser.surname}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name\n + \' \' + \nuser.surname}' && v[1] === 'user.surname'));
            assert.ok(matches.some(v => v[0] === '${user.name\n + \' \' + \nuser.surname}' && v[1] === 'user'));
        });
    });

    suite('Expression Handling', () => {
        const testCases = [
            {
                description: 'nested method calls',
                input: '<p th:text="${#strings.toLowerCase(user.name)}">Name</p>',
                expected: [
                    ['${#strings.toLowerCase(user.name)}', 'user'],
                    ['${#strings.toLowerCase(user.name)}', 'user.name']
                ]
            },
            {
                description: 'multiple nested method calls',
                input: '<p th:text="${#strings.replace(#strings.toLowerCase(user.name), \' \', \'-\')}">Name</p>',
                expected: [
                    ['${#strings.replace(#strings.toLowerCase(user.name), \' \', \'-\')}', 'user'],
                    ['${#strings.replace(#strings.toLowerCase(user.name), \' \', \'-\')}', 'user.name']
                ]
            },
            {
                description: 'nested object properties',
                input: '<p th:text="${user.address.street.name}">Street</p>',
                expected: [
                    ['${user.address.street.name}', 'user'],
                    ['${user.address.street.name}', 'user.address'],
                    ['${user.address.street.name}', 'user.address.street'],
                    ['${user.address.street.name}', 'user.address.street.name']
                ]
            },
            {
                description: 'mixed variable and message',
                input: '<p th:text="${user.name} + \' - \' + #{welcome.message}">Mixed</p>',
                expected: [['${user.name}', 'user.name']]
            },
            {
                description: 'mixed variable and link',
                input: '<a th:href="@{/user/${userId}/profile}">Profile</a>',
                expected: [['${userId}', 'userId']]
            },
            {
                description: 'list filtering',
                input: '<p th:text="${#lists.size(users.?[age > 18])}">Users</p>',
                expected: [
                    ['${#lists.size(users.?[age > 18])}', 'users'],
                    ['${#lists.size(users.?[age > 18])}', 'age']
                ]
            },
            {
                description: 'th:with expressions',
                input: '<div th:with="total=${price + tax}">Total: ${total}</div>',
                expected: [
                    ['${price + tax}', 'price'],
                    ['${price + tax}', 'tax']
                ]
            },
            {
                description: 'th:attr expressions',
                input: '<img th:attr="src=${imageUrl},alt=${imageDesc}">',
                expected: [
                    ['${imageUrl}', 'imageUrl'],
                    ['${imageDesc}', 'imageDesc']
                ]
            },
            {
                description: 'th:attrappend expressions',
                input: '<div th:attrappend="class=${extraClass}">Content</div>',
                expected: [['${extraClass}', 'extraClass']]
            }
        ];

        testCases.forEach(({ description, input, expected }) => {
            test(`should handle ${description}`, () => {
                const variables = parser.findAllVariableMatches(input);
                expected.forEach(exp => {
                    assert.ok(variables.some(v => v[0] === exp[0] && v[1] === exp[1]));
                });
            });
        });
    });

    suite('Fragment Parameters', () => {
        test('should handle fragment parameters', () => {
            const line = '<div th:replace="~{::frag (onevar=${value1},twovar=${value2})}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${value1}' && v[1] === 'value1'));
            assert.ok(matches.some(v => v[0] === '${value2}' && v[1] === 'value2'));
        });

        test('should handle fragment parameters with different order', () => {
            const line = '<div th:replace="~{::frag (twovar=${value2},onevar=${value1})}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${value1}' && v[1] === 'value1'));
            assert.ok(matches.some(v => v[0] === '${value2}' && v[1] === 'value2'));
        });

        test('should handle fragment local variables without arguments', () => {
            const line = '<div th:replace="~{::frag}" th:with="onevar=${value1},twovar=${value2}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${value1}' && v[1] === 'value1'));
            assert.ok(matches.some(v => v[0] === '${value2}' && v[1] === 'value2'));
        });

        test('should handle fragment assertions', () => {
            const line = '<div th:assert="${onevar},(${twovar} != 43)">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${onevar}' && v[1] === 'onevar'));
            assert.ok(matches.some(v => v[0] === '${twovar} != 43' && v[1] === 'twovar'));
        });

        test('should handle fragment assertions with string validation', () => {
            const line = '<header th:fragment="contentheader(title)" th:assert="${!#strings.isEmpty(title)}">...</header>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${!#strings.isEmpty(title)}' && v[1] === 'title'));
        });
    });

    suite('Template Removal', () => {
        test('should handle th:remove attribute', () => {
            const line = '<tr th:remove="all-but-first" th:each="prod : ${prods}">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${prods}' && v[1] === 'prods'));
        });

        test('should handle th:remove with complex expressions', () => {
            const line = '<tr th:remove="${condition} ? \'all\' : \'none\'">';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${condition}' && v[1] === 'condition'));
        });
    });

    suite('Markup Selector Syntax', () => {
        test('should handle direct children selector', () => {
            const line = '<div th:replace="~{mytemplate :: /div[@class=\'content\']}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle children at any depth selector', () => {
            const line = '<div th:replace="~{mytemplate :: //div[@class=\'content\']}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle multiple attribute selectors', () => {
            const line = '<div th:replace="~{mytemplate :: div[@z1=\'v1\' and @z2=\'v2\']}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle position selector', () => {
            const line = '<div th:replace="~{mytemplate :: div[2]}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle attribute comparison operators', () => {
            const line = '<div th:replace="~{mytemplate :: div[@class^=\'section\']}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle jQuery-like selectors', () => {
            const line = '<div th:replace="~{mytemplate :: div.content#main}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle reference selectors', () => {
            const line = '<div th:replace="~{mytemplate :: div%oneref}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });
    });

    suite('Comments and Blocks', () => {
        test('should handle standard HTML comments', () => {
            const line = '<!-- User info follows --><div th:text="${user.name}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle Thymeleaf parser-level comment blocks', () => {
            const line = '<!--/* This code will be removed at Thymeleaf parsing time! */--><div th:text="${user.name}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle Thymeleaf prototype-only comment blocks', () => {
            const line = '<!--/*--> <div th:text="${user.name}">...</div> <!--*/-->';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });
    });

    suite('Attribute Precedence', () => {
        test('should handle multiple attributes with precedence', () => {
            const line = '<div th:object="${user}" th:with="name=${user.name}" th:text="${name}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user}' && v[1] === 'user'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${name}' && v[1] === 'name'));
        });

        test('should handle fragment inclusion with precedence', () => {
            const line = '<div th:insert="~{common :: header}" th:with="title=${page.title}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${page.title}' && v[1] === 'page.title'));
        });

        test('should handle fragment iteration with precedence', () => {
            const line = '<div th:each="item : ${items}" th:text="${item.name}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${items}' && v[1] === 'items'));
            assert.ok(matches.some(v => v[0] === '${item.name}' && v[1] === 'item.name'));
        });
    });

    suite('Inlining', () => {
        test('should handle text inlining', () => {
            const line = '<script th:inline="text">A dynamic value: [[${user.name}]]</script>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle javascript inlining', () => {
            const line = '<script th:inline="javascript">var user = [[${user.name}]];</script>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle css inlining', () => {
            const line = '<style th:inline="css">.main { background: url([[${backgroundImage}]]); }</style>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${backgroundImage}' && v[1] === 'backgroundImage'));
        });

        test('should handle javascript natural templating', () => {
            const line = '<script th:inline="javascript">var user = /*[[${user.name}]]*/ "John Doe";</script>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });
    });

    suite('Text Templates', () => {
        test('should handle text template mode', () => {
            const line = '[# th:text="${user.name}"]';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle text template with inlining', () => {
            const line = '[# th:inline="text"]Welcome [[${user.name}]]![/]';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle text template with iteration', () => {
            const line = '[# th:each="item : ${items}"]- [[${item.name}]][/]';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${items}' && v[1] === 'items'));
            assert.ok(matches.some(v => v[0] === '${item.name}' && v[1] === 'item.name'));
        });
    });

    suite('Decoupled Template Logic', () => {
        test('should handle decoupled logic expressions', () => {
            const line = '<!-- /*/th:text="${user.name}"/*/-->';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle decoupled logic with iteration', () => {
            const line = '<!-- /*/th:each="item : ${items}"/*/-->';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${items}' && v[1] === 'items'));
        });

        test('should handle decoupled logic with complex expressions', () => {
            const line = '<!-- /*/th:if="${user.age >= 18 and user.hasRole(\'ADULT\')}"/*/-->';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 and user.hasRole(\'ADULT\')}' && v[1] === 'user.age'));
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 and user.hasRole(\'ADULT\')}' && v[1] === 'user'));
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 and user.hasRole(\'ADULT\')}' && v[1] === 'user.hasRole'));
        });
    });

    suite('Expression Basic Objects', () => {
        test('should handle #ctx object', () => {
            const line = '<div th:text="${#ctx.locale.country}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#ctx.locale.country}' && v[1] === 'locale.country'));
        });

        test('should handle #vars object', () => {
            const line = '<div th:text="${#vars.user.name}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#vars.user.name}' && v[1] === 'user.name'));
        });

        test('should handle #locale object', () => {
            const line = '<div th:text="${#locale}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#locale}' && v[1] === 'locale'));
        });

        test('should handle #request object', () => {
            const line = '<div th:text="${#request.contextPath}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#request.contextPath}' && v[1] === 'contextPath'));
        });
    });

    suite('Expression Utility Objects', () => {
        test('should handle #messages utility', () => {
            const line = '<div th:text="${#messages.msg(\'welcome\')}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#messages.msg(\'welcome\')}' && v[1] === 'welcome'));
        });

        test('should handle #uris utility', () => {
            const line = '<div th:text="${#uris.escapeQueryParam(param)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#uris.escapeQueryParam(param)}' && v[1] === 'param'));
        });

        test('should handle #conversions utility', () => {
            const line = '<div th:text="${#conversions.convert(value, \'String\')}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#conversions.convert(value, \'String\')}' && v[1] === 'value'));
        });

        test('should handle #dates utility', () => {
            const line = '<div th:text="${#dates.format(date, \'dd-MM-yyyy\')}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#dates.format(date, \'dd-MM-yyyy\')}' && v[1] === 'date'));
        });

        test('should handle #calendars utility', () => {
            const line = '<div th:text="${#calendars.format(cal)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#calendars.format(cal)}' && v[1] === 'cal'));
        });

        test('should handle #numbers utility', () => {
            const line = '<div th:text="${#numbers.formatDecimal(num, 1, 2)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#numbers.formatDecimal(num, 1, 2)}' && v[1] === 'num'));
        });

        test('should handle #strings utility', () => {
            const line = '<div th:text="${#strings.toUpperCase(str)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#strings.toUpperCase(str)}' && v[1] === 'str'));
        });

        test('should handle #objects utility', () => {
            const line = '<div th:text="${#objects.nullSafe(obj, \'default\')}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#objects.nullSafe(obj, \'default\')}' && v[1] === 'obj'));
        });

        test('should handle #bools utility', () => {
            const line = '<div th:text="${#bools.isTrue(flag)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#bools.isTrue(flag)}' && v[1] === 'flag'));
        });

        test('should handle #arrays utility', () => {
            const line = '<div th:text="${#arrays.length(arr)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#arrays.length(arr)}' && v[1] === 'arr'));
        });

        test('should handle #lists utility', () => {
            const line = '<div th:text="${#lists.size(list)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#lists.size(list)}' && v[1] === 'list'));
        });

        test('should handle #sets utility', () => {
            const line = '<div th:text="${#sets.size(set)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#sets.size(set)}' && v[1] === 'set'));
        });

        test('should handle #maps utility', () => {
            const line = '<div th:text="${#maps.size(map)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#maps.size(map)}' && v[1] === 'map'));
        });

        test('should handle #aggregates utility', () => {
            const line = '<div th:text="${#aggregates.sum(numbers)}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${#aggregates.sum(numbers)}' && v[1] === 'numbers'));
        });
    });

    suite('Expression Selection Variables', () => {
        test('should handle selection variables in text', () => {
            const line = '<div th:object="${user}" th:text="*{name}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user}' && v[1] === 'user'));
            assert.ok(matches.some(v => v[0] === '*{name}' && v[1] === 'name'));
        });

        test('should handle selection variables in attributes', () => {
            const line = '<div th:object="${user}" th:value="*{age}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user}' && v[1] === 'user'));
            assert.ok(matches.some(v => v[0] === '*{age}' && v[1] === 'age'));
        });

        test('should handle nested selection variables', () => {
            const line = '<div th:object="${user}" th:text="*{address.street}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user}' && v[1] === 'user'));
            assert.ok(matches.some(v => v[0] === '*{address.street}' && v[1] === 'address.street'));
            assert.ok(matches.some(v => v[0] === '*{address.street}' && v[1] === 'address'));
        });
    });

    suite('Message Expressions', () => {
        test('should handle simple message expressions', () => {
            const line = '<div th:text="#{welcome.message}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '#{welcome.message}' && v[1] === 'welcome.message'));
        });

        test('should handle message expressions with parameters', () => {
            const line = '<div th:text="#{welcome(${user.name})}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '#{welcome(${user.name})}' && v[1] === 'welcome'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name}' && v[1] === 'user'));
        });

        test('should handle message expressions with multiple parameters', () => {
            const line = '<div th:text="#{message(${param1},${param2})}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '#{message(${param1},${param2})}' && v[1] === 'message'));
            assert.ok(matches.some(v => v[0] === '${param1}' && v[1] === 'param1'));
            assert.ok(matches.some(v => v[0] === '${param2}' && v[1] === 'param2'));
        });
    });

    suite('Link URL Expressions', () => {
        test('should handle simple URL expressions', () => {
            const line = '<a th:href="@{/order/list}">...</a>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle URL expressions with path variables', () => {
            const line = '<a th:href="@{/order/{id}(id=${order.id})}">...</a>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${order.id}' && v[1] === 'order.id'));
            assert.ok(matches.some(v => v[0] === '${order.id}' && v[1] === 'order'));
        });

        test('should handle URL expressions with query parameters', () => {
            const line = '<a th:href="@{/order(id=${order.id},action=\'view\')}">...</a>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${order.id}' && v[1] === 'order.id'));
            assert.ok(matches.some(v => v[0] === '${order.id}' && v[1] === 'order'));
        });

        test('should handle URL expressions with multiple parameters', () => {
            const line = '<a th:href="@{/order/{id}/details(id=${order.id},type=${type})}">...</a>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${order.id}' && v[1] === 'order.id'));
            assert.ok(matches.some(v => v[0] === '${order.id}' && v[1] === 'order'));
            assert.ok(matches.some(v => v[0] === '${type}' && v[1] === 'type'));
        });
    });

    suite('Fragment Expressions', () => {
        test('should handle simple fragment expressions', () => {
            const line = '<div th:insert="~{commons :: header}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.strictEqual(matches.length, 0);
        });

        test('should handle fragment expressions with parameters', () => {
            const line = '<div th:insert="~{commons :: header(title=${title})}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${title}' && v[1] === 'title'));
        });

        test('should handle fragment expressions with multiple parameters', () => {
            const line = '<div th:insert="~{commons :: header(title=${title},subtitle=${subtitle})}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${title}' && v[1] === 'title'));
            assert.ok(matches.some(v => v[0] === '${subtitle}' && v[1] === 'subtitle'));
        });

        test('should handle fragment expressions with complex parameters', () => {
            const line = '<div th:insert="~{commons :: header(title=${user.name + \' - \' + page.title})}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name + \' - \' + page.title}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name + \' - \' + page.title}' && v[1] === 'page.title'));
        });
    });

    suite('Literals and Operations', () => {
        test('should handle string literals', () => {
            const line = '<div th:text="${\'Hello \' + user.name}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${\'Hello \' + user.name}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${\'Hello \' + user.name}' && v[1] === 'user'));
        });

        test('should handle numeric literals', () => {
            const line = '<div th:if="${user.age > 18}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.age > 18}' && v[1] === 'user.age'));
            assert.ok(matches.some(v => v[0] === '${user.age > 18}' && v[1] === 'user'));
        });

        test('should handle boolean literals', () => {
            const line = '<div th:if="${true and user.active}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${true and user.active}' && v[1] === 'user.active'));
            assert.ok(matches.some(v => v[0] === '${true and user.active}' && v[1] === 'user'));
        });

        test('should handle null literal', () => {
            const line = '<div th:if="${user.name != null}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name != null}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name != null}' && v[1] === 'user'));
        });

        test('should handle token literals', () => {
            const line = '<div th:text="${user.gender.name()}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.gender.name()}' && v[1] === 'user.gender.name'));
            assert.ok(matches.some(v => v[0] === '${user.gender.name()}' && v[1] === 'user.gender'));
            assert.ok(matches.some(v => v[0] === '${user.gender.name()}' && v[1] === 'user'));
        });
    });

    suite('Conditional Expressions', () => {
        test('should handle if-then expressions', () => {
            const line = '<div th:text="${user.gender == \'M\' ? \'Male\' : \'Female\'}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.gender == \'M\' ? \'Male\' : \'Female\'}' && v[1] === 'user.gender'));
            assert.ok(matches.some(v => v[0] === '${user.gender == \'M\' ? \'Male\' : \'Female\'}' && v[1] === 'user'));
        });

        test('should handle elvis operator', () => {
            const line = '<div th:text="${user.name ?: \'Anonymous\'}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.name ?: \'Anonymous\'}' && v[1] === 'user.name'));
            assert.ok(matches.some(v => v[0] === '${user.name ?: \'Anonymous\'}' && v[1] === 'user'));
        });

        test('should handle if-then with multiple conditions', () => {
            const line = '<div th:text="${user.age >= 18 ? (user.gender == \'M\' ? \'Mr.\' : \'Ms.\') : \'Young\'}">...</div>';
            const matches = parser.findAllVariableMatches(line);
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 ? (user.gender == \'M\' ? \'Mr.\' : \'Ms.\') : \'Young\'}' && v[1] === 'user.age'));
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 ? (user.gender == \'M\' ? \'Mr.\' : \'Ms.\') : \'Young\'}' && v[1] === 'user.gender'));
            assert.ok(matches.some(v => v[0] === '${user.age >= 18 ? (user.gender == \'M\' ? \'Mr.\' : \'Ms.\') : \'Young\'}' && v[1] === 'user'));
        });
    });
}); 