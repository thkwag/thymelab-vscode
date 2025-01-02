/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';

export function emitProcessEvents(process: ChildProcess, events: Array<{event: string, data?: any}>) {
    events.forEach(({event, data}) => {
        switch (event) {
            case 'stdout':
                if (process.stdout) {
                    process.stdout.emit('data', data);
                }
                break;
            case 'stderr':
                if (process.stderr) {
                    process.stderr.emit('data', data);
                }
                break;
            default:
                process.emit(event, data);
        }
    });
}

export function createEventEmitterWithData<T>() {
    const emitter = new EventEmitter();
    const events: T[] = [];

    emitter.on('data', (data: T) => {
        events.push(data);
    });

    return {
        emitter,
        events,
        emit: (data: T) => emitter.emit('data', data)
    };
}

export function waitForEvent(emitter: EventEmitter, event: string, timeout = 1000): Promise<any> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout);

        emitter.once(event, (...args) => {
            clearTimeout(timer);
            resolve(args.length > 1 ? args : args[0]);
        });
    });
} 