/* eslint-disable @typescript-eslint/no-explicit-any */
import { assert } from 'chai';
import * as sinon from 'sinon';
import { TestContext } from './testSetup';

export function assertMethodCalled(
    context: TestContext,
    object: any,
    methodName: string,
    expectedArgs?: any[]
) {
    const method = object[methodName] as sinon.SinonStub;
    assert.isTrue(method.called, `Expected ${methodName} to be called`);
    if (expectedArgs) {
        assert.isTrue(
            method.calledWith(...expectedArgs),
            `Expected ${methodName} to be called with ${JSON.stringify(expectedArgs)}`
        );
    }
}

export function assertEventEmitted(
    events: Array<{event: string, data?: any}>,
    expectedEvent: string,
    expectedData?: any
) {
    const event = events.find(e => e.event === expectedEvent);
    assert.exists(event, `Expected event ${expectedEvent} to be emitted`);
    if (expectedData) {
        assert.deepEqual(event?.data, expectedData);
    }
}

export function assertConfigurationUpdated(
    context: TestContext,
    section: string,
    key: string,
    value: any
) {
    const config = context.config;
    assert.isTrue(
        config.update.calledWith(key, value),
        `Expected configuration ${section}.${key} to be updated with ${value}`
    );
}

export function assertOutputContains(
    context: TestContext,
    expectedText: string
) {
    const appendLine = context.outputChannel.appendLine as sinon.SinonStub;
    assert.isTrue(
        appendLine.getCalls().some(call => call.args[0].includes(expectedText)),
        `Expected output to contain "${expectedText}"`
    );
}

export function assertStatusBarUpdated(
    context: TestContext,
    expectedText: string
) {
    const statusBarItem = context.statusBarItem;
    assert.equal(statusBarItem.text, expectedText);
} 