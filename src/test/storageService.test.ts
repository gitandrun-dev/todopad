import * as assert from 'assert';
import { StorageService } from '../services/storageService';
import { createTodoItem } from '../models/todoItem';

suite('StorageService', () => {
    let service: StorageService;

    setup(() => {
        service = new StorageService();
    });

    test('add and getAll', () => {
        const item = createTodoItem('Test task');
        service.add('global', item);
        const all = service.getAll('global');
        assert.strictEqual(all.length, 1);
        assert.strictEqual(all[0].title, 'Test task');
        assert.strictEqual(all[0].order, 0);
    });

    test('add multiple items preserves order', () => {
        service.add('global', createTodoItem('First'));
        service.add('global', createTodoItem('Second'));
        service.add('global', createTodoItem('Third'));
        const all = service.getAll('global');
        assert.strictEqual(all.length, 3);
        assert.strictEqual(all[0].title, 'First');
        assert.strictEqual(all[1].title, 'Second');
        assert.strictEqual(all[2].title, 'Third');
    });

    test('update modifies fields', () => {
        const item = createTodoItem('Original');
        service.add('workspace', item);
        const updated = service.update('workspace', item.id, {
            title: 'Modified',
            priority: 'high',
        });
        assert.strictEqual(updated?.title, 'Modified');
        assert.strictEqual(updated?.priority, 'high');
        assert.strictEqual(updated?.id, item.id);
    });

    test('delete removes item and reindexes', () => {
        const a = createTodoItem('A');
        const b = createTodoItem('B');
        const c = createTodoItem('C');
        service.add('global', a);
        service.add('global', b);
        service.add('global', c);

        const deleted = service.delete('global', b.id);
        assert.strictEqual(deleted, true);
        const all = service.getAll('global');
        assert.strictEqual(all.length, 2);
        assert.strictEqual(all[0].title, 'A');
        assert.strictEqual(all[0].order, 0);
        assert.strictEqual(all[1].title, 'C');
        assert.strictEqual(all[1].order, 1);
    });

    test('reorder moves item to target position', () => {
        const a = createTodoItem('A');
        const b = createTodoItem('B');
        const c = createTodoItem('C');
        service.add('global', a);
        service.add('global', b);
        service.add('global', c);

        service.reorder('global', c.id, a.id);
        const all = service.getAll('global');
        assert.strictEqual(all[0].title, 'C');
        assert.strictEqual(all[1].title, 'A');
        assert.strictEqual(all[2].title, 'B');
    });

    test('moveToScope transfers item between scopes', () => {
        const item = createTodoItem('Transfer me');
        service.add('global', item);

        const moved = service.moveToScope('global', 'workspace', item.id);
        assert.strictEqual(moved, true);
        assert.strictEqual(service.getAll('global').length, 0);
        assert.strictEqual(service.getAll('workspace').length, 1);
        assert.strictEqual(service.getAll('workspace')[0].title, 'Transfer me');
    });

    test('clearCompleted removes only done items', () => {
        const a = createTodoItem('A');
        const b = createTodoItem('B');
        const c = createTodoItem('C');
        service.add('global', a);
        service.add('global', b);
        service.add('global', c);
        service.update('global', a.id, { done: true });
        service.update('global', c.id, { done: true });

        const cleared = service.clearCompleted('global');
        assert.strictEqual(cleared, 2);
        const all = service.getAll('global');
        assert.strictEqual(all.length, 1);
        assert.strictEqual(all[0].title, 'B');
        assert.strictEqual(all[0].order, 0);
    });

    test('getCount returns correct totals', () => {
        service.add('global', createTodoItem('A'));
        service.add('global', createTodoItem('B'));
        const items = service.getAll('global');
        service.update('global', items[0].id, { done: true });

        const count = service.getCount('global');
        assert.strictEqual(count.total, 2);
        assert.strictEqual(count.done, 1);
    });

    test('scopes are isolated', () => {
        service.add('global', createTodoItem('Global item'));
        service.add('workspace', createTodoItem('Workspace item'));
        assert.strictEqual(service.getAll('global').length, 1);
        assert.strictEqual(service.getAll('workspace').length, 1);
    });

    test('createTodoItem has correct defaults', () => {
        const item = createTodoItem('Test');
        assert.strictEqual(item.title, 'Test');
        assert.strictEqual(item.description, '');
        assert.strictEqual(item.priority, 'normal');
        assert.strictEqual(item.reminderAt, null);
        assert.strictEqual(item.done, false);
        assert.ok(item.id.length > 0);
        assert.ok(item.createdAt.length > 0);
    });
});
