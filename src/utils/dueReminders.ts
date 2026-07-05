import { Scope, TodoItem } from '../models/todoItem';

export function countDueReminders(
    getItems: (scope: Scope) => TodoItem[],
    now: number,
): number {
    const scopes: Scope[] = ['global', 'workspace'];
    let count = 0;
    for (const scope of scopes) {
        for (const item of getItems(scope)) {
            if (item.reminderAt && !item.done && new Date(item.reminderAt).getTime() <= now) {
                count++;
            }
        }
    }
    return count;
}
