export function createMockFileSystem() {
    return {
        existsSync: () => true,
        readFileSync: () => Buffer.from('mock jar content'),
        writeFileSync: () => {},
        mkdirSync: () => {}
    };
} 