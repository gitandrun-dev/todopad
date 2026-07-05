import * as assert from 'assert';
import { StorageService } from '../services/storageService';
import { createTodoItem, TodoItem } from '../models/todoItem';
import { countDueReminders } from '../utils/dueReminders';

function withReminder(title: string, reminderAt: string | null, done = false): TodoItem {
    const item = createTodoItem(title);
    item.reminderAt = reminderAt;
    item.done = done;
    return item;
}

function past(minutes: number): string {
    return new Date(Date.now() - minutes * 60_000).toISOString();
}

function future(minutes: number): string {
    return new Date(Date.now() + minutes * 60_000).toISOString();
}

suite('countDueReminders', () => {
    let storage: StorageService;
    const getItems = (scope: 'global' | 'workspace') => storage.getAll(scope);

    setup(() => {
        storage = new StorageService();
    });

    test('counts zero when there are no reminders', () => {
        storage.add('global', createTodoItem('No reminder'));
        assert.strictEqual(countDueReminders(getItems, Date.now()), 0);
    });

    test('counts a past-due reminder', () => {
        storage.add('global', withReminder('Due', past(5)));
        assert.strictEqual(countDueReminders(getItems, Date.now()), 1);
    });

    test('does not count future reminders', () => {
        storage.add('global', withReminder('Later', future(5)));
        assert.strictEqual(countDueReminders(getItems, Date.now()), 0);
    });

    test('does not count done reminders', () => {
        storage.add('global', withReminder('Done', past(5), true));
        assert.strictEqual(countDueReminders(getItems, Date.now()), 0);
    });

    test('counts across both scopes', () => {
        storage.add('global', withReminder('Global due', past(1)));
        storage.add('workspace', withReminder('Workspace due', past(1)));
        assert.strictEqual(countDueReminders(getItems, Date.now()), 2);
    });

    test('counts only the due ones in a mixed list', () => {
        storage.add('global', withReminder('Due 1', past(10)));
        storage.add('global', withReminder('Future', future(10)));
        storage.add('global', withReminder('Done', past(10), true));
        storage.add('global', createTodoItem('No reminder'));
        storage.add('workspace', withReminder('Due 2', past(1)));
        assert.strictEqual(countDueReminders(getItems, Date.now()), 2);
    });
});
