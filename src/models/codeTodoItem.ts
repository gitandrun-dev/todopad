export type CodeTodoType = 'TODO' | 'FIXME' | 'HACK' | 'XXX';

export interface CodeTodoItem {
    type: CodeTodoType;
    text: string;
    file: string;
    uri: string;
    line: number;
}

export interface CodeTodoFileGroup {
    file: string;
    uri: string;
    items: CodeTodoItem[];
}
