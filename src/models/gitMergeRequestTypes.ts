export type GitPlatform = 'gitlab' | 'github';
export type MergeRequestState = 'open' | 'merged' | 'closed';

export interface MergeRequestApproval {
    required: number;
    given: number;
}

export interface MergeRequest {
    id: string;
    platform: GitPlatform;
    number: number;
    title: string;
    state: MergeRequestState;
    author: string;
    url: string;
    projectPath: string;
    sourceBranch: string;
    targetBranch: string;
    updatedAt: string;
    isDraft: boolean;
    approval: MergeRequestApproval | null;
    isAuthor: boolean;
}

export interface GitFilterConfig {
    showAssigned: boolean;
    showReviewRequested: boolean;
    showDrafts: boolean;
    projectPaths: string[];
    refreshInterval: number;
}

export interface GitScopeConfig {
    visible: boolean;
    filter: GitFilterConfig;
}

export type GitConnectionStatus = 'disconnected' | 'connected';

export interface GitPlatformState {
    connectionStatus: GitConnectionStatus;
    platform: GitPlatform;
    user: string | null;
    reviewRequested: MergeRequest[];
    assigned: MergeRequest[];
    workspaceReviewRequested: MergeRequest[];
    workspaceAssigned: MergeRequest[];
    globalConfig: GitScopeConfig;
    workspaceConfig: GitScopeConfig;
    reminders: Record<string, string>;
    needsAttention: boolean;
    loading: boolean;
    lastError: string | null;
}

export interface GitMergeRequestState {
    gitlab: GitPlatformState;
    github: GitPlatformState;
}

export const DEFAULT_GIT_FILTER: GitFilterConfig = {
    showAssigned: true,
    showReviewRequested: true,
    showDrafts: false,
    projectPaths: [],
    refreshInterval: 5,
};

export const DEFAULT_GIT_SCOPE_CONFIG: GitScopeConfig = {
    visible: true,
    filter: { ...DEFAULT_GIT_FILTER },
};

export interface GitProvider {
    platform: GitPlatform;
    validateConnection(url: string, token: string): Promise<{ user: string }>;
    fetchAssignedMergeRequests(
        url: string,
        token: string,
        user: string,
        config: GitFilterConfig,
    ): Promise<MergeRequest[]>;
    fetchReviewRequestedMergeRequests(
        url: string,
        token: string,
        user: string,
        config: GitFilterConfig,
    ): Promise<MergeRequest[]>;
}
