import * as assert from 'assert';
import { StorageService } from '../services/storageService';
import { createTodoItem, TodoItem } from '../models/todoItem';
import { ReminderService } from '../services/reminderService';

class FakeNotifier {
    fired: { title: string; id: string }[] = [];
    pendingChoice: ((choice: string | undefined) => void) | null = null;

    showReminder(
        title: string,
        id: string,
        actions: string[],
    ): Promise<string | undefined> {
        this.fired.push({ title, id });
        return new Promise((resolve) => {
            this.pendingChoice = resolve;
        });
    }

    clickAction(action: string | undefined): void {
        if (this.pendingChoice) {
            const resolve = this.pendingChoice;
            this.pendingChoice = null;
            resolve(action);
        }
    }
}

function createItemWithReminder(title: string, reminderAt: string): TodoItem {
    const item = createTodoItem(title);
    item.reminderAt = reminderAt;
    return item;
}

function pastTime(minutesAgo: number): string {
    return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function futureTime(minutesAhead: number): string {
    return new Date(Date.now() + minutesAhead * 60_000).toISOString();
}

suite('ReminderService', () => {
    let storage: StorageService;
    let service: ReminderService;
    let notifier: FakeNotifier;
    let firedCallback: number;

    setup(() => {
        storage = new StorageService();
        notifier = new FakeNotifier();
        service = new ReminderService(storage, {
            showReminder: (title, id, actions) =>
                notifier.showReminder(title, id, actions),
            getSnoozeDuration: () => 10,
        });
        firedCallback = 0;
        service.onReminderFired(() => { firedCallback++; });
    });

    test('fires when reminder time is in the past', () => {
        const item = createItemWithReminder('Past reminder', pastTime(5));
        storage.add('global', item);

        service.triggerCheck();

        assert.strictEqual(notifier.fired.length, 1);
        assert.strictEqual(notifier.fired[0].title, 'Past reminder');
    });

    test('does not fire when reminder time is in the future', () => {
        const item = createItemWithReminder('Future reminder', futureTime(5));
        storage.add('global', item);

        service.triggerCheck();

        assert.strictEqual(notifier.fired.length, 0);
    });

    test('does not fire for done items', () => {
        const item = createItemWithReminder('Done item', pastTime(5));
        item.done = true;
        storage.add('global', item);

        service.triggerCheck();

        assert.strictEqual(notifier.fired.length, 0);
    });

    test('does not fire for items without reminder', () => {
        const item = createTodoItem('No reminder');
        storage.add('global', item);

        service.triggerCheck();

        assert.strictEqual(notifier.fired.length, 0);
    });

    test('does not fire twice for the same item', () => {
        const item = createItemWithReminder('Once only', pastTime(5));
        storage.add('global', item);

        service.triggerCheck();
        service.triggerCheck();

        assert.strictEqual(notifier.fired.length, 1);
    });

    test('mark done clears reminder and marks item done', async () => {
        const item = createItemWithReminder('Mark me done', pastTime(5));
        storage.add('global', item);

        service.triggerCheck();
        notifier.clickAction('Mark Done');

        await tick();

        const updated = storage.getAll('global')[0];
        assert.strictEqual(updated.done, true);
        assert.strictEqual(updated.reminderAt, null);
        assert.strictEqual(firedCallback, 1);
    });

    test('snooze updates reminderAt to future time', async () => {
        const item = createItemWithReminder('Snooze me', pastTime(5));
        storage.add('global', item);

        service.triggerCheck();
        notifier.clickAction('Snooze 10m');

        await tick();

        const updated = storage.getAll('global')[0];
        assert.ok(updated.reminderAt !== null);
        const newTime = new Date(updated.reminderAt!).getTime();
        assert.ok(newTime > Date.now());
        assert.ok(newTime <= Date.now() + 11 * 60_000);
        assert.strictEqual(firedCallback, 1);
    });

    test('snooze prevents re-firing until snooze period expires', async () => {
        const item = createItemWithReminder('Snooze guard', pastTime(5));
        storage.add('global', item);

        service.triggerCheck();
        notifier.clickAction('Snooze 10m');

        await tick();

        service.triggerCheck();
        assert.strictEqual(notifier.fired.length, 1);
    });

    test('ignoring notification leaves item unchanged', async () => {
        const item = createItemWithReminder('Ignore me', pastTime(5));
        storage.add('global', item);

        service.triggerCheck();
        notifier.clickAction(undefined);

        await tick();

        const updated = storage.getAll('global')[0];
        assert.strictEqual(updated.done, false);
        assert.strictEqual(updated.reminderAt, item.reminderAt);
        assert.strictEqual(firedCallback, 0);
    });

    test('ignored notification does not re-fire during snooze window', async () => {
        const item = createItemWithReminder('Ignored', pastTime(5));
        storage.add('global', item);

        service.triggerCheck();
        notifier.clickAction(undefined);

        await tick();

        service.triggerCheck();
        assert.strictEqual(notifier.fired.length, 1);
    });

    test('ignored notification re-fires once the snooze window passes', async () => {
        const item = createItemWithReminder('Nag again', pastTime(5));
        storage.add('global', item);

        service.triggerCheck();
        notifier.clickAction(undefined);

        await tick();

        service.resetFired(item.id);
        service.triggerCheck();
        assert.strictEqual(notifier.fired.length, 2);
    });

    test('fires for both global and workspace scopes', () => {
        const globalItem = createItemWithReminder('Global', pastTime(1));
        const wsItem = createItemWithReminder('Workspace', pastTime(1));
        storage.add('global', globalItem);
        storage.add('workspace', wsItem);

        service.triggerCheck();

        assert.strictEqual(notifier.fired.length, 2);
    });
});

function tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
