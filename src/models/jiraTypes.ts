export interface JiraTicket {
    key: string;
    summary: string;
    status: string;
    statusCategory: 'To Do' | 'In Progress' | 'Done';
    projectKey: string;
    url: string;
}

export interface JiraFilterConfig {
    statuses: string[];
    projectKeys: string[];
    customJql: string | null;
    refreshInterval: number;
}

export type JiraConnectionStatus = 'disconnected' | 'connected';

export interface JiraState {
    connectionStatus: JiraConnectionStatus;
    user: string | null;
    tickets: JiraTicket[];
    filter: JiraFilterConfig;
    reminders: Record<string, string>;
    needsAttention: boolean;
    lastError: string | null;
}

export const DEFAULT_FILTER: JiraFilterConfig = {
    statuses: [],
    projectKeys: [],
    customJql: null,
    refreshInterval: 5,
};
