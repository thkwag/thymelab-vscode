export function createMockAxios() {
    return {
        get: () => Promise.resolve({ data: [] }), // Mock empty releases response
        default: {
            get: () => Promise.resolve({ data: [] }) // Mock empty releases response
        }
    };
} 