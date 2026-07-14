export type JiraGroupBy = 'none' | 'issueType' | 'project' | 'priority' | 'parent' | 'label';

export interface JiraTicket {
    key: string;
    summary: string;
    status: string;
    statusCategory: 'To Do' | 'In Progress' | 'Done';
    projectKey: string;
    url: string;
    issueType: string;
    priority: string;
    parentKey: string | null;
    parentSummary: string | null;
    parentType: string | null;
    labels: string[];
}

export interface JiraFilterConfig {
    statuses: string[];
    projectKeys: string[];
    customJql: string | null;
    refreshInterval: number;
    groupBy: JiraGroupBy;
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
    collapsedGroups: {
        global: Record<string, string[]>;
        workspace: Record<string, string[]>;
    };
    needsAttention: boolean;
    loading: boolean;
    lastError: string | null;
}

const DEFAULT_FILTER: JiraFilterConfig = {
    statuses: [],
    projectKeys: [],
    customJql: null,
    refreshInterval: 5,
    groupBy: 'none',
};

export const DEFAULT_SCOPE_CONFIG: JiraScopeConfig = {
    visible: true,
    filter: { ...DEFAULT_FILTER },
};
