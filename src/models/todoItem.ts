export type Priority = 'high' | 'normal' | 'low';
export type Scope = 'global' | 'workspace';

export interface TodoItem {
    id: string;
    title: string;
    description: string;
    priority: Priority;
    reminderAt: string | null;
    done: boolean;
    createdAt: string;
    order: number;
}

export function createTodoItem(
    title: string,
    options?: Partial<Pick<TodoItem, 'description' | 'priority' | 'reminderAt'>>,
): TodoItem {
    return {
        id: generateId(),
        title,
        description: options?.description ?? '',
        priority: options?.priority ?? 'normal',
        reminderAt: options?.reminderAt ?? null,
        done: false,
        createdAt: new Date().toISOString(),
        order: 0,
    };
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
