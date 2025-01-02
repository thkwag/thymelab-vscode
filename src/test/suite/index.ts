import * as path from 'path';
import Mocha from 'mocha';
import glob from 'glob';

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000
    });

    const testsRoot = path.resolve(__dirname, '../extension');

    return new Promise((resolve, reject) => {
        const testFiles = glob.sync('**/*.test.js', { cwd: testsRoot });
        console.log('Found test files:', testFiles);
        
        testFiles.forEach(f => {
            const fullPath = path.resolve(testsRoot, f);
            console.log('Adding test file:', fullPath);
            mocha.addFile(fullPath);
        });

        try {
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error('Error running tests:', err);
            reject(err);
        }
    });
} 