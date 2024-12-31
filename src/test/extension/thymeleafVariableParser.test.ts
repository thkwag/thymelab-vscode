import { describe, test, expect } from '@jest/globals';
import { ThymeleafVariableParser } from '../../extension/thymeleafVariableParser';

describe('ThymeleafVariableParser - Variable Detection', () => {
    let parser: ThymeleafVariableParser;

    beforeEach(() => {
        parser = new ThymeleafVariableParser();
    });

    describe('Basic Text Expressions', () => {
        test('should detect standard ${...} expressions', () => {
            const line = '<p th:text="${message}">Default message</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${message}', 'message']);
        });

        test('should detect utext expressions', () => {
            const line = '<p th:utext="${htmlMessage}">HTML message</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${htmlMessage}', 'htmlMessage']);
        });
    });

    describe('URL Expressions', () => {
        test('should handle static URLs', () => {
            const line = '<a th:href="@{/home}">Go to Home</a>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toHaveLength(0);
        });

        test('should handle URL parameters', () => {
            const line = '<a th:href="@{/user/{id}(id=${userId})}">User Profile</a>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${userId}', 'userId']);
        });

        test('should handle multiple URL parameters', () => {
            const line = '<a th:href="@{/user/profile(id=${userId}, tab=\'info\')}">Profile</a>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${userId}', 'userId']);
        });
    });

    describe('Conditional Statements', () => {
        test('should handle th:if expressions', () => {
            const line = '<p th:if="${isAdmin}">You are an administrator</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${isAdmin}', 'isAdmin']);
        });

        test('should handle th:unless expressions', () => {
            const line = '<p th:unless="${isAdmin}">You are a regular user</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${isAdmin}', 'isAdmin']);
        });

        test('should handle th:switch expressions', () => {
            const line = '<div th:switch="${userRole}">';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${userRole}', 'userRole']);
        });
    });

    describe('Iteration', () => {
        test('should handle simple iteration', () => {
            const line = '<li th:each="item : ${items}" th:text="${item}"></li>';
            const iterInfo = parser.findIteratorVariables(line);
            expect(iterInfo.iteratorVars).toContain('item');
            expect(iterInfo.parentVars.get('item')).toBe('items');
        });

        test('should handle iteration with status variable', () => {
            const line = '<li th:each="user, stat : ${users}"><span th:text="${stat.index}"></span></li>';
            const iterInfo = parser.findIteratorVariables(line);
            expect(iterInfo.iteratorVars).toContain('user');
            expect(iterInfo.iteratorVars).toContain('stat');
            expect(iterInfo.parentVars.get('user')).toBe('users');
        });

        test('should handle nested properties in iteration', () => {
            const line = '<li th:each="user : ${users}" th:text="${user.name}"></li>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${user.name}', 'user.name']);
        });
    });

    describe('Object Properties', () => {
        test('should handle direct object properties', () => {
            const line = '<p th:text="${user.name}">User Name</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${user.name}', 'user.name']);
            expect(variables).toContainEqual(['${user.name}', 'user']);
        });

        test('should handle multiple object properties', () => {
            const line = '<p th:text="${user.address.street}">123 Main St</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${user.address.street}', 'user.address.street']);
            expect(variables).toContainEqual(['${user.address.street}', 'user.address']);
            expect(variables).toContainEqual(['${user.address.street}', 'user']);
        });
    });

    describe('Utility Objects', () => {
        test('should handle date formatting', () => {
            const line = '<p th:text="${#temporals.format(now, \'yyyy-MM-dd\')}">2024-03-31</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${#temporals.format(now, \'yyyy-MM-dd\')}', 'now']);
            expect(variables).not.toContainEqual(['${#temporals.format(now, \'yyyy-MM-dd\')}', '#temporals']);
        });

        test('should handle number formatting', () => {
            const line = '<p th:text="${#numbers.formatDecimal(price, 1, \'COMMA\', 2, \'POINT\')}">1,234.56</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${#numbers.formatDecimal(price, 1, \'COMMA\', 2, \'POINT\')}', 'price']);
            expect(variables).not.toContainEqual(['${#numbers.formatDecimal(price, 1, \'COMMA\', 2, \'POINT\')}', '#numbers']);
        });

        test('should handle string operations', () => {
            const line = '<p th:text="${#strings.toUpperCase(message)}">UPPERCASE</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${#strings.toUpperCase(message)}', 'message']);
            expect(variables).not.toContainEqual(['${#strings.toUpperCase(message)}', '#strings']);
        });
    });

    describe('Elvis Operator', () => {
        test('should handle Elvis operator expressions', () => {
            const line = '<p th:text="${user.name ?: \'Anonymous\'}">Name</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${user.name ?: \'Anonymous\'}', 'user.name']);
        });
    });

    describe('Complex Expressions', () => {
        test('should handle boolean expressions', () => {
            const line = '<p th:if="${isAdmin and hasPermission}">Admin with permission</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${isAdmin and hasPermission}', 'isAdmin']);
            expect(variables).toContainEqual(['${isAdmin and hasPermission}', 'hasPermission']);
            expect(variables).not.toContainEqual(['${isAdmin and hasPermission}', 'and']);
        });

        test('should handle complex boolean expressions', () => {
            const line = '<p th:if="${age >= 18 and (hasLicense or hasPermit)}">Can Drive</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${age >= 18 and (hasLicense or hasPermit)}', 'age']);
            expect(variables).toContainEqual(['${age >= 18 and (hasLicense or hasPermit)}', 'hasLicense']);
            expect(variables).toContainEqual(['${age >= 18 and (hasLicense or hasPermit)}', 'hasPermit']);
            expect(variables).not.toContainEqual(['${age >= 18 and (hasLicense or hasPermit)}', 'or']);
            expect(variables).not.toContainEqual(['${age >= 18 and (hasLicense or hasPermit)}', 'and']);
        });

        test('should handle ternary expressions', () => {
            const line = '<p th:text="${isAdmin ? \'Admin\' : \'User\'}">Role</p>';
            const variables = parser.findAllVariableMatches(line);
            expect(variables).toContainEqual(['${isAdmin ? \'Admin\' : \'User\'}', 'isAdmin']);
        });
    });

    describe('Selection Variable Expressions', () => {
        it('should handle array selection', () => {
            const line = '<div th:each="user : ${users.?[age > 18]}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${users.?[age > 18]}', 'users']);
            expect(matches).toContainEqual(['${users.?[age > 18]}', 'age']);
            expect(matches).not.toContainEqual(['${users.?[age > 18]}', 'users.age']);
        });

        it('should handle list filtering', () => {
            const line = '<div th:each="product : ${products.?[price < 100]}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${products.?[price < 100]}', 'products']);
            expect(matches).toContainEqual(['${products.?[price < 100]}', 'price']);
            expect(matches).not.toContainEqual(['${products.?[price < 100]}', 'products.price']);
        });

        it('should handle map selection', () => {
            const line = '<div th:text="${users.?[key.length > 5]}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${users.?[key.length > 5]}', 'users']);
            expect(matches).toContainEqual(['${users.?[key.length > 5]}', 'key.length']);
            expect(matches).toContainEqual(['${users.?[key.length > 5]}', 'key']);
        });
    });

    describe('Form Handling', () => {
        it('should handle form field binding', () => {
            const line = '<input type="text" th:field="*{user.name}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['*{user.name}', 'user.name']);
            expect(matches).toContainEqual(['*{user.name}', 'user']);
        });

        it('should handle error messages', () => {
            const line = '<div th:errors="*{user.email}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['*{user.email}', 'user.email']);
            expect(matches).toContainEqual(['*{user.email}', 'user']);
        });

        it('should handle form validation status', () => {
            const line = '<div th:class="${#fields.hasErrors(\'user.email\')}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${#fields.hasErrors(\'user.email\')}', 'user.email']);
            expect(matches).toContainEqual(['${#fields.hasErrors(\'user.email\')}', 'user']);
        });
    });

    describe('Security Expressions', () => {
        it('should handle authentication checks', () => {
            const line = '<div th:if="${#authentication.principal.username == \'admin\'}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${#authentication.principal.username == \'admin\'}', 'principal.username']);
            expect(matches).toContainEqual(['${#authentication.principal.username == \'admin\'}', 'principal']);
            expect(matches).not.toContainEqual(['${#authentication.principal.username == \'admin\'}', '#authentication']);
        });

        it('should handle authorization checks', () => {
            const line = '<div th:if="${hasRole(\'ROLE_ADMIN\') and user.isEnabled()}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${hasRole(\'ROLE_ADMIN\') and user.isEnabled()}', 'user']);
            expect(matches).toContainEqual(['${hasRole(\'ROLE_ADMIN\') and user.isEnabled()}', 'user.isEnabled']);
            expect(matches).not.toContainEqual(['${hasRole(\'ROLE_ADMIN\') and user.isEnabled()}', 'hasRole']);
        });
    });

    describe('Complex Nested Scenarios', () => {
        it('should handle deeply nested properties', () => {
            const line = '<div th:text="${user.address.city.name}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${user.address.city.name}', 'user.address.city.name']);
            expect(matches).toContainEqual(['${user.address.city.name}', 'user.address.city']);
            expect(matches).toContainEqual(['${user.address.city.name}', 'user.address']);
            expect(matches).toContainEqual(['${user.address.city.name}', 'user']);
        });

        it('should handle nested method calls with properties', () => {
            const line = '<div th:text="${order.getItems().?[price > 100].size()}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${order.getItems().?[price > 100].size()}', 'order']);
            expect(matches).toContainEqual(['${order.getItems().?[price > 100].size()}', 'order.getItems']);
            expect(matches).toContainEqual(['${order.getItems().?[price > 100].size()}', 'price']);
            expect(matches).not.toContainEqual(['${order.getItems().?[price > 100].size()}', 'size']);
        });

        it('should handle complex conditional expressions', () => {
            const line = '<div th:if="${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}', 'user']);
            expect(matches).toContainEqual(['${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}', 'user.age']);
            expect(matches).toContainEqual(['${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}', 'user.hasRole']);
            expect(matches).toContainEqual(['${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}', 'user.parent']);
            expect(matches).toContainEqual(['${user.age >= 18 and user.hasRole(\'ADULT\') or user.parent.hasApproved()}', 'user.parent.hasApproved']);
        });
    });

    describe('Edge Cases and Special Scenarios', () => {
        it('should handle escaped expressions', () => {
            const line = '<div th:text="\\${user.name}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toHaveLength(0);
        });

        it('should handle mixed quotes', () => {
            const line = '<div th:text=\'${user.getName("Smith")}\'>';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${user.getName("Smith")}', 'user']);
            expect(matches).toContainEqual(['${user.getName("Smith")}', 'user.getName']);
        });

        it('should handle line breaks in expressions', () => {
            const line = '<div th:text="${user.name\n + \' \' + \nuser.surname}">';
            const matches = parser.findAllVariableMatches(line);
            expect(matches).toContainEqual(['${user.name\n + \' \' + \nuser.surname}', 'user.name']);
            expect(matches).toContainEqual(['${user.name\n + \' \' + \nuser.surname}', 'user.surname']);
            expect(matches).toContainEqual(['${user.name\n + \' \' + \nuser.surname}', 'user']);
        });
    });

    describe('Expression Handling', () => {
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
                expected.forEach(exp => expect(variables).toContainEqual(exp));
            });
        });
    });
}); 