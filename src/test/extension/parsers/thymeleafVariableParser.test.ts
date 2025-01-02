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
}); 