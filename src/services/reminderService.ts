import { TodoItem, Scope } from '../models/todoItem';
import { StorageService } from './storageService';

const CHECK_INTERVAL_MS = 10_000;

export interface ReminderNotifier {
    showReminder(title: string, id: string, actions: string[]): Promise<string | undefined>;
    getSnoozeDuration(): number;
}

export class ReminderService {
    private timer: ReturnType<typeof setInterval> | undefined;
    private snoozedUntil: Map<string, number> = new Map();
    private onReminderFiredCallback?: () => void;
    private onDidCheckCallback?: () => void;

    constructor(
        private storageService: StorageService,
        private notifier: ReminderNotifier,
    ) {}

    onReminderFired(callback: () => void): void {
        this.onReminderFiredCallback = callback;
    }

    onDidCheck(callback: () => void): void {
        this.onDidCheckCallback = callback;
    }

    start(): void {
        this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
        this.check();
    }

    triggerCheck(): void {
        this.check();
    }

    private check(): void {
        const now = Date.now();
        const scopes: Scope[] = ['global', 'workspace'];
        const activeIds = new Set<string>();

        for (const scope of scopes) {
            const items = this.storageService.getAll(scope);
            for (const item of items) {
                if (!item.done && item.reminderAt) {
                    activeIds.add(item.id);
                }
                if (this.shouldFire(item, now)) {
                    this.fire(item, scope);
                }
            }
        }

        for (const id of this.snoozedUntil.keys()) {
            if (!activeIds.has(id)) {
                this.snoozedUntil.delete(id);
            }
        }

        this.onDidCheckCallback?.();
    }

    private shouldFire(item: TodoItem, now: number): boolean {
        if (!item.reminderAt || item.done) {
            return false;
        }

        const reminderTime = new Date(item.reminderAt).getTime();
        if (reminderTime > now) {
            return false;
        }

        const snoozeEnd = this.snoozedUntil.get(item.id);
        if (snoozeEnd && now < snoozeEnd) {
            return false;
        }

        if (snoozeEnd && now >= snoozeEnd) {
            this.snoozedUntil.delete(item.id);
        }

        return true;
    }

    private fire(item: TodoItem, scope: Scope): void {
        const snoozeMins = this.notifier.getSnoozeDuration();

        this.snoozedUntil.set(item.id, Date.now() + snoozeMins * 60_000);

        const actions = ['Mark Done', `Snooze ${snoozeMins}m`];

        this.notifier.showReminder(item.title, item.id, actions).then((choice) => {
            if (choice === 'Mark Done') {
                this.storageService.update(scope, item.id, {
                    done: true,
                    reminderAt: null,
                });
                this.snoozedUntil.delete(item.id);
                this.onReminderFiredCallback?.();
            } else if (choice?.startsWith('Snooze')) {
                const newTime = new Date(Date.now() + snoozeMins * 60_000).toISOString();
                this.storageService.update(scope, item.id, { reminderAt: newTime });
                this.snoozedUntil.set(item.id, Date.now() + snoozeMins * 60_000);
                this.onReminderFiredCallback?.();
            }
        });
    }

    resetFired(id: string): void {
        this.snoozedUntil.delete(id);
    }

    dispose(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
}
