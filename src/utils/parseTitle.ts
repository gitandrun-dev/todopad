import { Priority } from '../models/todoItem';

export function parseTitleWithPriority(input: string): { title: string; priority: Priority } {
    let priority: Priority = 'normal';
    let title = input.trim();

    const match = title.match(/!(h|n|l)(?:\s|$)/i);
    if (match) {
        const flag = match[1].toLowerCase();
        priority = flag === 'h' ? 'high' : flag === 'l' ? 'low' : 'normal';
        title = title.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
    }

    return { title, priority };
}
