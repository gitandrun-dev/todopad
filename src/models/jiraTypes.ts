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

export interface JiraScopeConfig {
    visible: boolean;
    filter: JiraFilterConfig;
}

export type JiraConnectionStatus = 'disconnected' | 'connected';

export interface JiraState {
    connectionStatus: JiraConnectionStatus;
    user: string | null;
    tickets: JiraTicket[];
    workspaceTickets: JiraTicket[];
    globalConfig: JiraScopeConfig;
    workspaceConfig: JiraScopeConfig;
    reminders: Record<string, string>;
    needsAttention: boolean;
    lastError: string | null;
}

const DEFAULT_FILTER: JiraFilterConfig = {
    statuses: [],
    projectKeys: [],
    customJql: null,
    refreshInterval: 5,
};

export const DEFAULT_SCOPE_CONFIG: JiraScopeConfig = {
    visible: true,
    filter: { ...DEFAULT_FILTER },
};
