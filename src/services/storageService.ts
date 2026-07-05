import { TodoItem, Scope } from '../models/todoItem';

export class StorageService {
    private todos: Map<Scope, TodoItem[]> = new Map([
        ['global', []],
        ['workspace', []],
    ]);

    getAll(scope: Scope): TodoItem[] {
        return [...(this.todos.get(scope) ?? [])].sort((a, b) => a.order - b.order);
    }

    add(scope: Scope, item: TodoItem): void {
        const items = this.todos.get(scope) ?? [];
        item.order = items.length;
        items.push(item);
        this.todos.set(scope, items);
    }

    update(scope: Scope, id: string, changes: Partial<TodoItem>): TodoItem | undefined {
        const items = this.todos.get(scope) ?? [];
        const index = items.findIndex((t) => t.id === id);
        if (index === -1) {
            return undefined;
        }
        items[index] = { ...items[index], ...changes, id };
        this.todos.set(scope, items);
        return items[index];
    }

    delete(scope: Scope, id: string): boolean {
        const items = this.todos.get(scope) ?? [];
        const index = items.findIndex((t) => t.id === id);
        if (index === -1) {
            return false;
        }
        items.splice(index, 1);
        items.forEach((item, i) => {
            item.order = i;
        });
        this.todos.set(scope, items);
        return true;
    }

    reorder(scope: Scope, id: string, targetId: string): boolean {
        const items = this.todos.get(scope) ?? [];
        const fromIndex = items.findIndex((t) => t.id === id);
        const toIndex = items.findIndex((t) => t.id === targetId);
        if (fromIndex === -1 || toIndex === -1) {
            return false;
        }

        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        items.forEach((item, i) => {
            item.order = i;
        });
        this.todos.set(scope, items);
        return true;
    }

    moveToScope(fromScope: Scope, toScope: Scope, id: string): boolean {
        const fromItems = this.todos.get(fromScope) ?? [];
        const index = fromItems.findIndex((t) => t.id === id);
        if (index === -1) {
            return false;
        }

        const [item] = fromItems.splice(index, 1);
        fromItems.forEach((t, i) => {
            t.order = i;
        });
        this.todos.set(fromScope, fromItems);

        this.add(toScope, item);
        return true;
    }

    clearCompleted(scope: Scope): number {
        const items = this.todos.get(scope) ?? [];
        const before = items.length;
        const remaining = items.filter((t) => !t.done);
        remaining.forEach((item, i) => {
            item.order = i;
        });
        this.todos.set(scope, remaining);
        return before - remaining.length;
    }

    getCount(scope: Scope): { total: number; done: number } {
        const items = this.todos.get(scope) ?? [];
        return {
            total: items.length,
            done: items.filter((t) => t.done).length,
        };
    }

    loadAll(scope: Scope, items: TodoItem[]): void {
        this.todos.set(scope, items);
    }

    exportAll(scope: Scope): TodoItem[] {
        return [...(this.todos.get(scope) ?? [])];
    }
}
