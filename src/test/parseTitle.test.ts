import * as assert from 'assert';
import { parseTitleWithPriority } from '../utils/parseTitle';

suite('parseTitleWithPriority', () => {
    test('no flag defaults to normal', () => {
        const result = parseTitleWithPriority('Fix the bug');
        assert.strictEqual(result.title, 'Fix the bug');
        assert.strictEqual(result.priority, 'normal');
    });

    test('!h sets high priority', () => {
        const result = parseTitleWithPriority('Fix the bug !h');
        assert.strictEqual(result.title, 'Fix the bug');
        assert.strictEqual(result.priority, 'high');
    });

    test('!l sets low priority', () => {
        const result = parseTitleWithPriority('Clean up code !l');
        assert.strictEqual(result.title, 'Clean up code');
        assert.strictEqual(result.priority, 'low');
    });

    test('!n sets normal priority explicitly', () => {
        const result = parseTitleWithPriority('Something !n');
        assert.strictEqual(result.title, 'Something');
        assert.strictEqual(result.priority, 'normal');
    });

    test('flag at start of title', () => {
        const result = parseTitleWithPriority('!h urgent fix');
        assert.strictEqual(result.title, 'urgent fix');
        assert.strictEqual(result.priority, 'high');
    });

    test('flag in middle of title', () => {
        const result = parseTitleWithPriority('fix !h the login');
        assert.strictEqual(result.title, 'fix the login');
        assert.strictEqual(result.priority, 'high');
    });

    test('case insensitive', () => {
        const result = parseTitleWithPriority('Something !H');
        assert.strictEqual(result.title, 'Something');
        assert.strictEqual(result.priority, 'high');
    });

    test('handles extra whitespace', () => {
        const result = parseTitleWithPriority('  Fix bug  !l  ');
        assert.strictEqual(result.title, 'Fix bug');
        assert.strictEqual(result.priority, 'low');
    });
});
