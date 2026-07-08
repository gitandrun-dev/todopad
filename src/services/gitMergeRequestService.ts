import * as vscode from 'vscode';
import {
    GitPlatform,
    GitPlatformState,
    GitMergeRequestState,
    GitScopeConfig,
    GitFilterConfig,
    GitConnectionStatus,
    MergeRequest,
    GitProvider,
    DEFAULT_GIT_SCOPE_CONFIG,
} from '../models/gitMergeRequestTypes';
import { GitlabProvider } from './providers/gitlabProvider';
import { GithubProvider } from './providers/githubProvider';

const GITLAB_TOKEN_SECRET = 'todopad.git.gitlab.token';
const GITHUB_TOKEN_SECRET = 'todopad.git.github.token';
const GIT_GLOBAL_FILE = 'gitMergeRequestConfig.json';
const GIT_WORKSPACE_CONFIG_KEY = 'todopad.git.workspaceConfig';

interface PlatformGlobalData {
    url: string;
    user: string;
    globalConfig: GitScopeConfig;
    reminders: Record<string, string>;
}

interface GitGlobalFileData {
    gitlab: PlatformGlobalData;
    github: PlatformGlobalData;
}

interface PlatformRuntime {
    provider: GitProvider;
    connectionStatus: GitConnectionStatus;
    user: string | null;
    assigned: MergeRequest[];
    reviewRequested: MergeRequest[];
    needsAttention: boolean;
    loading: boolean;
    lastError: string | null;
    refreshTimer: ReturnType<typeof setInterval> | undefined;
    reminderTimer: ReturnType<typeof setInterval> | undefined;
    url: string;
    globalConfig: GitScopeConfig;
    workspaceConfig: GitScopeConfig;
    reminders: Record<string, string>;
    snoozedUntil: Map<string, number>;
}

export class GitMergeRequestService implements vscode.Disposable {
    private platforms: Record<GitPlatform, PlatformRuntime>;
    private globalFileUri: vscode.Uri;
    private onReminderFiredCallback?: (
        platform: GitPlatform,
        mergeRequestId: string,
        title: string,
        url: string,
    ) => void;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.globalFileUri = vscode.Uri.joinPath(context.globalStorageUri, GIT_GLOBAL_FILE);
        this.platforms = {
            gitlab: this.createRuntime(new GitlabProvider()),
            github: this.createRuntime(new GithubProvider()),
        };
    }

    private createRuntime(provider: GitProvider): PlatformRuntime {
        return {
            provider,
            connectionStatus: 'disconnected',
            user: null,
            assigned: [],
            reviewRequested: [],
            needsAttention: false,
            loading: false,
            lastError: null,
            refreshTimer: undefined,
            reminderTimer: undefined,
            url: '',
            globalConfig: { ...DEFAULT_GIT_SCOPE_CONFIG },
            workspaceConfig: { ...DEFAULT_GIT_SCOPE_CONFIG },
            reminders: {},
            snoozedUntil: new Map(),
        };
    }

    async initialize(): Promise<void> {
        await this.loadGlobalFileData();
        this.loadWorkspaceConfig();
        await this.autoDetectWorkspaceRemote();

        for (const platform of ['gitlab', 'github'] as GitPlatform[]) {
            const runtime = this.platforms[platform];
            const token = await this.context.secrets.get(this.getTokenKey(platform));

            if (runtime.url && token) {
                runtime.connectionStatus = 'connected';
                runtime.loading = true;
                await this.fetchMergeRequestsSilent(platform);
                this.startRefreshTimer(platform);
                this.startReminderTimer(platform);
            }
        }
    }

    onReminderFired(
        callback: (
            platform: GitPlatform,
            mergeRequestId: string,
            title: string,
            url: string,
        ) => void,
    ): void {
        this.onReminderFiredCallback = callback;
    }

    async connect(
        platform: GitPlatform,
        url: string,
        token: string,
    ): Promise<{ success: boolean; error?: string }> {
        if (platform !== 'gitlab' && platform !== 'github') {
            return { success: false, error: 'Invalid platform' };
        }
        const runtime = this.platforms[platform];
        const sanitizedUrl = this.sanitizeUrl(url);

        if (!sanitizedUrl.startsWith('https://')) {
            return { success: false, error: 'URL must use HTTPS' };
        }

        try {
            const result = await runtime.provider.validateConnection(sanitizedUrl, token);
            runtime.url = sanitizedUrl;
            runtime.user = result.user;
            runtime.connectionStatus = 'connected';
            runtime.needsAttention = false;

            await this.context.secrets.store(this.getTokenKey(platform), token);
            await this.saveGlobalFileData();

            runtime.loading = true;
            await this.fetchMergeRequestsSilent(platform);
            this.startRefreshTimer(platform);
            this.startReminderTimer(platform);

            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Connection failed';
            if (message.includes('401') || message.includes('403')) {
                return { success: false, error: 'Invalid credentials' };
            }
            return { success: false, error: message };
        }
    }

    async disconnect(platform: GitPlatform): Promise<void> {
        const runtime = this.platforms[platform];
        await this.context.secrets.delete(this.getTokenKey(platform));

        runtime.url = '';
        runtime.connectionStatus = 'disconnected';
        runtime.user = null;
        runtime.assigned = [];
        runtime.reviewRequested = [];
        runtime.reminders = {};
        runtime.globalConfig = { ...DEFAULT_GIT_SCOPE_CONFIG };
        runtime.workspaceConfig = { ...DEFAULT_GIT_SCOPE_CONFIG };
        runtime.needsAttention = false;
        runtime.snoozedUntil.clear();
        this.stopRefreshTimer(platform);
        this.stopReminderTimer(platform);

        await this.saveGlobalFileData();
        await this.context.workspaceState.update(GIT_WORKSPACE_CONFIG_KEY, undefined);
    }

    async saveSettings(
        platform: GitPlatform,
        globalConfig: GitScopeConfig,
        workspaceConfig: GitScopeConfig,
    ): Promise<void> {
        const runtime = this.platforms[platform];
        runtime.globalConfig = globalConfig;
        runtime.workspaceConfig = workspaceConfig;

        await this.saveGlobalFileData();
        await this.saveWorkspaceConfig();
        await this.fetchMergeRequestsSilent(platform);

        if (runtime.connectionStatus === 'connected') {
            this.startRefreshTimer(platform);
        }
    }

    async refreshMergeRequests(platform?: GitPlatform): Promise<void> {
        if (platform) {
            await this.fetchMergeRequestsSilent(platform);
        } else {
            for (const p of ['gitlab', 'github'] as GitPlatform[]) {
                if (this.platforms[p].connectionStatus === 'connected') {
                    await this.fetchMergeRequestsSilent(p);
                }
            }
        }
    }

    async setReminder(mergeRequestId: string, reminderAt: string): Promise<void> {
        const platform = this.getPlatformFromId(mergeRequestId);
        if (platform) {
            this.platforms[platform].reminders[mergeRequestId] = reminderAt;
            this.platforms[platform].snoozedUntil.delete(mergeRequestId);
            await this.saveGlobalFileData();
        }
    }

    async clearReminder(mergeRequestId: string): Promise<void> {
        const platform = this.getPlatformFromId(mergeRequestId);
        if (platform) {
            delete this.platforms[platform].reminders[mergeRequestId];
            this.platforms[platform].snoozedUntil.delete(mergeRequestId);
            await this.saveGlobalFileData();
        }
    }

    snoozeReminder(mergeRequestId: string, until: number): void {
        const platform = this.getPlatformFromId(mergeRequestId);
        if (platform) {
            this.platforms[platform].snoozedUntil.set(mergeRequestId, until);
        }
    }

    getState(): GitMergeRequestState {
        return {
            gitlab: this.getPlatformState('gitlab'),
            github: this.getPlatformState('github'),
        };
    }

    private getPlatformState(platform: GitPlatform): GitPlatformState {
        const runtime = this.platforms[platform];
        return {
            connectionStatus: runtime.connectionStatus,
            platform,
            user: runtime.user,
            reviewRequested: this.filterByScope(runtime.reviewRequested, runtime.globalConfig),
            assigned: this.filterByScope(runtime.assigned, runtime.globalConfig),
            workspaceReviewRequested: this.filterByScope(
                runtime.reviewRequested,
                runtime.workspaceConfig,
            ),
            workspaceAssigned: this.filterByScope(runtime.assigned, runtime.workspaceConfig),
            globalConfig: runtime.globalConfig,
            workspaceConfig: runtime.workspaceConfig,
            reminders: runtime.reminders,
            needsAttention: runtime.needsAttention,
            loading: runtime.loading,
            lastError: runtime.lastError,
        };
    }

    private filterByScope(
        mergeRequests: MergeRequest[],
        scopeConfig: GitScopeConfig,
    ): MergeRequest[] {
        if (!scopeConfig.visible) {
            return [];
        }

        const filter = scopeConfig.filter;
        let filtered = mergeRequests;

        if (filter.projectPaths.length > 0) {
            const paths = filter.projectPaths.map((p) => p.toLowerCase());
            filtered = filtered.filter((mr) => paths.includes(mr.projectPath.toLowerCase()));
        }

        if (!filter.showDrafts) {
            filtered = filtered.filter((mr) => !mr.isDraft);
        }

        return filtered;
    }

    private async fetchMergeRequestsSilent(platform: GitPlatform): Promise<void> {
        const runtime = this.platforms[platform];

        if (runtime.connectionStatus !== 'connected') {
            return;
        }

        const token = await this.context.secrets.get(this.getTokenKey(platform));
        if (!runtime.url || !token || !runtime.user) {
            return;
        }

        runtime.loading = true;

        try {
            const filter = runtime.globalConfig.filter;
            const promises: Promise<void>[] = [];

            if (filter.showAssigned) {
                promises.push(
                    runtime.provider
                        .fetchAssignedMergeRequests(runtime.url, token, runtime.user, filter)
                        .then((results) => {
                            runtime.assigned = results;
                        }),
                );
            } else {
                runtime.assigned = [];
            }

            if (filter.showReviewRequested) {
                promises.push(
                    runtime.provider
                        .fetchReviewRequestedMergeRequests(runtime.url, token, runtime.user, filter)
                        .then((results) => {
                            runtime.reviewRequested = results;
                        }),
                );
            } else {
                runtime.reviewRequested = [];
            }

            await Promise.all(promises);
            runtime.lastError = null;
            this.pruneReminders(platform);
        } catch (error) {
            runtime.lastError = error instanceof Error ? error.message : 'Fetch failed';
            this.handleFetchError(platform, error);
        } finally {
            runtime.loading = false;
        }
    }

    private handleFetchError(platform: GitPlatform, error: unknown): void {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('401') || message.includes('403')) {
            const runtime = this.platforms[platform];
            runtime.connectionStatus = 'disconnected';
            runtime.user = null;
            runtime.assigned = [];
            runtime.reviewRequested = [];
            runtime.needsAttention = true;
            this.context.secrets.delete(this.getTokenKey(platform));
        }
    }

    private pruneReminders(platform: GitPlatform): void {
        const runtime = this.platforms[platform];
        const allIds = new Set([
            ...runtime.assigned.map((mr) => mr.id),
            ...runtime.reviewRequested.map((mr) => mr.id),
        ]);

        for (const id of Object.keys(runtime.reminders)) {
            if (!allIds.has(id)) {
                delete runtime.reminders[id];
            }
        }
    }

    private startRefreshTimer(platform: GitPlatform): void {
        this.stopRefreshTimer(platform);
        const runtime = this.platforms[platform];
        const interval = (runtime.globalConfig.filter.refreshInterval || 5) * 60_000;
        runtime.refreshTimer = setInterval(() => {
            this.fetchMergeRequestsSilent(platform);
        }, interval);
    }

    private stopRefreshTimer(platform: GitPlatform): void {
        const runtime = this.platforms[platform];
        if (runtime.refreshTimer) {
            clearInterval(runtime.refreshTimer);
            runtime.refreshTimer = undefined;
        }
    }

    private startReminderTimer(platform: GitPlatform): void {
        this.stopReminderTimer(platform);
        const runtime = this.platforms[platform];
        runtime.reminderTimer = setInterval(() => {
            this.checkReminders(platform);
        }, 30_000);
    }

    private stopReminderTimer(platform: GitPlatform): void {
        const runtime = this.platforms[platform];
        if (runtime.reminderTimer) {
            clearInterval(runtime.reminderTimer);
            runtime.reminderTimer = undefined;
        }
    }

    private checkReminders(platform: GitPlatform): void {
        const runtime = this.platforms[platform];
        const now = Date.now();

        for (const [id, reminderAt] of Object.entries(runtime.reminders)) {
            const reminderTime = new Date(reminderAt).getTime();
            if (isNaN(reminderTime) || reminderTime > now) {
                continue;
            }

            const snoozedUntil = runtime.snoozedUntil.get(id);
            if (snoozedUntil && snoozedUntil > now) {
                continue;
            }

            const mergeRequest = runtime.reviewRequested.find((mr) => mr.id === id);
            if (mergeRequest && this.onReminderFiredCallback) {
                this.onReminderFiredCallback(
                    platform,
                    id,
                    `${mergeRequest.platform === 'gitlab' ? '!' : '#'}${mergeRequest.number} ${mergeRequest.title}`,
                    mergeRequest.url,
                );
                runtime.snoozedUntil.set(id, now + 5 * 60_000);
            }
        }
    }

    private async autoDetectWorkspaceRemote(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) {
                return;
            }

            const git = gitExtension.isActive
                ? gitExtension.exports.getAPI(1)
                : (await gitExtension.activate()).getAPI(1);

            if (!git || git.repositories.length === 0) {
                return;
            }

            const repo = git.repositories[0];
            const remotes = repo.state?.remotes;
            if (!remotes || remotes.length === 0) {
                return;
            }

            const origin = remotes.find((r: any) => r.name === 'origin') || remotes[0];
            const remoteUrl = origin.fetchUrl || origin.pushUrl || '';
            const detected = this.parseRemoteUrl(remoteUrl);

            if (detected) {
                const runtime = this.platforms[detected.platform];
                if (
                    runtime.workspaceConfig.filter.projectPaths.length === 0 &&
                    runtime.connectionStatus === 'connected'
                ) {
                    runtime.workspaceConfig = {
                        ...runtime.workspaceConfig,
                        filter: {
                            ...runtime.workspaceConfig.filter,
                            projectPaths: [detected.projectPath],
                        },
                    };
                    await this.saveWorkspaceConfig();
                }
            }
        } catch {
            // Git extension not available or no remotes
        }
    }

    private parseRemoteUrl(
        remoteUrl: string,
    ): { platform: GitPlatform; projectPath: string } | null {
        if (!remoteUrl) {
            return null;
        }

        const sshMatch = remoteUrl.match(/@([^:]+):(.+?)(?:\.git)?$/);
        const httpsMatch = remoteUrl.match(/https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
        const match = sshMatch || httpsMatch;

        if (!match) {
            return null;
        }

        const host = match[1].toLowerCase();
        const projectPath = match[2];

        if (host.includes('github')) {
            return { platform: 'github', projectPath };
        }

        if (host.includes('gitlab')) {
            return { platform: 'gitlab', projectPath };
        }

        const gitlabRuntime = this.platforms.gitlab;
        if (gitlabRuntime.url && new URL(gitlabRuntime.url).hostname === host) {
            return { platform: 'gitlab', projectPath };
        }

        const githubRuntime = this.platforms.github;
        if (githubRuntime.url && new URL(githubRuntime.url).hostname === host) {
            return { platform: 'github', projectPath };
        }

        return null;
    }

    private async loadGlobalFileData(): Promise<void> {
        try {
            const content = await vscode.workspace.fs.readFile(this.globalFileUri);
            const json = Buffer.from(content).toString('utf8');
            const data = JSON.parse(json) as GitGlobalFileData;

            for (const platform of ['gitlab', 'github'] as GitPlatform[]) {
                const platformData = data[platform];
                if (platformData) {
                    const runtime = this.platforms[platform];
                    runtime.url = platformData.url || '';
                    runtime.user = platformData.user || null;
                    runtime.reminders = platformData.reminders || {};
                    if (platformData.globalConfig) {
                        runtime.globalConfig = this.parseScopeConfig(platformData.globalConfig);
                    }
                }
            }
        } catch {
            // File doesn't exist yet
        }
    }

    private parseScopeConfig(stored: GitScopeConfig): GitScopeConfig {
        return {
            visible: stored.visible !== false,
            filter: {
                showAssigned: stored.filter?.showAssigned !== false,
                showReviewRequested: stored.filter?.showReviewRequested !== false,
                showDrafts: stored.filter?.showDrafts === true,
                projectPaths: stored.filter?.projectPaths || [],
                refreshInterval: stored.filter?.refreshInterval || 5,
            },
        };
    }

    private async saveGlobalFileData(): Promise<void> {
        const data: GitGlobalFileData = {
            gitlab: {
                url: this.platforms.gitlab.url,
                user: this.platforms.gitlab.user || '',
                globalConfig: this.platforms.gitlab.globalConfig,
                reminders: this.platforms.gitlab.reminders,
            },
            github: {
                url: this.platforms.github.url,
                user: this.platforms.github.user || '',
                globalConfig: this.platforms.github.globalConfig,
                reminders: this.platforms.github.reminders,
            },
        };

        const json = JSON.stringify(data, null, 2);
        const content = Buffer.from(json, 'utf8');
        await vscode.workspace.fs.writeFile(this.globalFileUri, content);
    }

    private loadWorkspaceConfig(): void {
        const stored =
            this.context.workspaceState.get<Record<GitPlatform, GitScopeConfig>>(
                GIT_WORKSPACE_CONFIG_KEY,
            );
        if (stored) {
            for (const platform of ['gitlab', 'github'] as GitPlatform[]) {
                if (stored[platform]) {
                    this.platforms[platform].workspaceConfig = this.parseScopeConfig(
                        stored[platform],
                    );
                }
            }
        }
    }

    private async saveWorkspaceConfig(): Promise<void> {
        const config: Record<GitPlatform, GitScopeConfig> = {
            gitlab: this.platforms.gitlab.workspaceConfig,
            github: this.platforms.github.workspaceConfig,
        };
        await this.context.workspaceState.update(GIT_WORKSPACE_CONFIG_KEY, config);
    }

    private getPlatformFromId(mergeRequestId: string): GitPlatform | null {
        if (mergeRequestId.startsWith('gitlab-')) {
            return 'gitlab';
        }
        if (mergeRequestId.startsWith('github-')) {
            return 'github';
        }
        return null;
    }

    private getTokenKey(platform: GitPlatform): string {
        return platform === 'gitlab' ? GITLAB_TOKEN_SECRET : GITHUB_TOKEN_SECRET;
    }

    private sanitizeUrl(url: string): string {
        let sanitized = url.trim();
        if (sanitized.startsWith('http://')) {
            sanitized = sanitized.replace('http://', 'https://');
        }
        if (!sanitized.startsWith('https://')) {
            sanitized = 'https://' + sanitized;
        }
        return sanitized.replace(/\/+$/, '');
    }

    dispose(): void {
        for (const platform of ['gitlab', 'github'] as GitPlatform[]) {
            this.stopRefreshTimer(platform);
            this.stopReminderTimer(platform);
        }
    }
}
