import * as vscode from 'vscode';
import * as https from 'https';
import {
    JiraTicket,
    JiraFilterConfig,
    JiraGroupBy,
    JiraConnectionStatus,
    JiraState,
    JiraScopeConfig,
    DEFAULT_SCOPE_CONFIG,
} from '../models/jiraTypes';

const JIRA_WORKSPACE_CONFIG_KEY = 'todopad.jira.workspaceConfig';
const JIRA_WORKSPACE_COLLAPSED_KEY = 'todopad.jira.workspaceCollapsedGroups';
const JIRA_TOKEN_SECRET = 'todopad.jira.token';
const JIRA_GLOBAL_FILE = 'jiraGlobalConfig.json';

const LEGACY_JIRA_URL_KEY = 'todopad.jira.url';
const LEGACY_JIRA_EMAIL_KEY = 'todopad.jira.email';
const LEGACY_JIRA_GLOBAL_CONFIG_KEY = 'todopad.jira.globalConfig';
const LEGACY_JIRA_REMINDERS_KEY = 'todopad.jira.reminders';
const LEGACY_JIRA_FILTER_KEY = 'todopad.jira.filter';

interface JiraGlobalFileData {
    url: string;
    email: string;
    globalConfig: JiraScopeConfig;
    reminders: Record<string, string>;
    globalCollapsedGroups?: Record<string, string[]>;
}

export class JiraService implements vscode.Disposable {
    private connectionStatus: JiraConnectionStatus = 'disconnected';
    private user: string | null = null;
    private tickets: JiraTicket[] = [];
    private globalTickets: JiraTicket[] | null = null;
    private workspaceTicketsRaw: JiraTicket[] | null = null;
    private globalConfig: JiraScopeConfig = { ...DEFAULT_SCOPE_CONFIG };
    private workspaceConfig: JiraScopeConfig = { ...DEFAULT_SCOPE_CONFIG };
    private reminders: Record<string, string> = {};
    private globalCollapsedGroups: Record<string, string[]> = {};
    private workspaceCollapsedGroups: Record<string, string[]> = {};
    private storedUrl = '';
    private storedEmail = '';
    private needsAttention = false;
    private loading = false;
    private lastError: string | null = null;
    private refreshTimer: ReturnType<typeof setInterval> | undefined;
    private reminderTimer: ReturnType<typeof setInterval> | undefined;
    private snoozedUntil: Map<string, number> = new Map();
    private onReminderFiredCallback?: (ticketKey: string, summary: string, url: string) => void;
    private onExternalChangeCallback?: () => void;
    private globalFileUri: vscode.Uri;
    private watcher?: vscode.FileSystemWatcher;
    private suppressNextWatch = false;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.globalFileUri = vscode.Uri.joinPath(context.globalStorageUri, JIRA_GLOBAL_FILE);
    }

    async initialize(): Promise<void> {
        await this.loadGlobalFileData();
        this.loadWorkspaceConfig();

        const token = await this.context.secrets.get(JIRA_TOKEN_SECRET);

        if (this.storedUrl && token && this.storedEmail) {
            this.connectionStatus = 'connected';
            this.user = this.storedEmail;
            this.loading = true;
            await this.fetchTicketsSilent();
            this.startRefreshTimer();
            this.startReminderTimer();
        }
    }

    private async loadGlobalFileData(): Promise<void> {
        try {
            const content = await vscode.workspace.fs.readFile(this.globalFileUri);
            const json = Buffer.from(content).toString('utf8');
            const data = JSON.parse(json) as JiraGlobalFileData;
            this.storedUrl = data.url || '';
            this.storedEmail = data.email || '';
            this.reminders = data.reminders || {};
            this.globalCollapsedGroups = data.globalCollapsedGroups || {};
            if (data.globalConfig) {
                this.globalConfig = {
                    visible: data.globalConfig.visible !== false,
                    filter: {
                        statuses: data.globalConfig.filter?.statuses || [],
                        projectKeys: data.globalConfig.filter?.projectKeys || [],
                        customJql: data.globalConfig.filter?.customJql || null,
                        refreshInterval: data.globalConfig.filter?.refreshInterval || 5,
                        groupBy: data.globalConfig.filter?.groupBy || 'none',
                    },
                };
            }
        } catch {
            await this.migrateFromGlobalState();
        }
    }

    private async migrateFromGlobalState(): Promise<void> {
        const url = this.context.globalState.get<string>(LEGACY_JIRA_URL_KEY, '');
        const email = this.context.globalState.get<string>(LEGACY_JIRA_EMAIL_KEY, '');
        const reminders =
            this.context.globalState.get<Record<string, string>>(LEGACY_JIRA_REMINDERS_KEY) || {};

        let globalConfig: JiraScopeConfig = { ...DEFAULT_SCOPE_CONFIG };
        const stored = this.context.globalState.get<JiraScopeConfig>(LEGACY_JIRA_GLOBAL_CONFIG_KEY);
        if (stored) {
            globalConfig = {
                visible: stored.visible !== false,
                filter: {
                    statuses: stored.filter?.statuses || [],
                    projectKeys: stored.filter?.projectKeys || [],
                    customJql: stored.filter?.customJql || null,
                    refreshInterval: stored.filter?.refreshInterval || 5,
                    groupBy: 'none',
                },
            };
        } else {
            const legacy = this.context.globalState.get<any>(LEGACY_JIRA_FILTER_KEY);
            if (legacy) {
                globalConfig = {
                    visible: true,
                    filter: {
                        statuses: legacy.statuses || [],
                        projectKeys: legacy.projectKeys || [],
                        customJql: legacy.customJql || null,
                        refreshInterval: legacy.refreshInterval || 5,
                        groupBy: 'none',
                    },
                };
            }
        }

        this.storedUrl = url;
        this.storedEmail = email;
        this.reminders = reminders;
        this.globalConfig = globalConfig;

        const hasLegacyData =
            url ||
            email ||
            Object.keys(reminders).length > 0 ||
            stored ||
            this.context.globalState.get<any>(LEGACY_JIRA_FILTER_KEY);

        if (hasLegacyData) {
            await this.saveGlobalFileData();
            await this.context.globalState.update(LEGACY_JIRA_URL_KEY, undefined);
            await this.context.globalState.update(LEGACY_JIRA_EMAIL_KEY, undefined);
            await this.context.globalState.update(LEGACY_JIRA_GLOBAL_CONFIG_KEY, undefined);
            await this.context.globalState.update(LEGACY_JIRA_REMINDERS_KEY, undefined);
            await this.context.globalState.update(LEGACY_JIRA_FILTER_KEY, undefined);
        }
    }

    private async saveGlobalFileData(): Promise<void> {
        this.suppressNextWatch = true;
        const data: JiraGlobalFileData = {
            url: this.storedUrl,
            email: this.storedEmail,
            globalConfig: this.globalConfig,
            reminders: this.reminders,
            globalCollapsedGroups: this.globalCollapsedGroups,
        };
        const json = JSON.stringify(data, null, 2);
        const content = Buffer.from(json, 'utf8');
        await vscode.workspace.fs.writeFile(this.globalFileUri, content);
    }

    private loadWorkspaceConfig(): void {
        const stored = this.context.workspaceState.get<JiraScopeConfig>(JIRA_WORKSPACE_CONFIG_KEY);
        if (stored) {
            this.workspaceConfig = {
                visible: stored.visible !== false,
                filter: {
                    statuses: stored.filter?.statuses || [],
                    projectKeys: stored.filter?.projectKeys || [],
                    customJql: stored.filter?.customJql || null,
                    refreshInterval: stored.filter?.refreshInterval || 5,
                    groupBy: stored.filter?.groupBy || 'none',
                },
            };
        }
        this.workspaceCollapsedGroups =
            this.context.workspaceState.get<Record<string, string[]>>(
                JIRA_WORKSPACE_COLLAPSED_KEY,
            ) || {};
    }

    async connect(
        url: string,
        email: string,
        token: string,
    ): Promise<{ success: boolean; error?: string }> {
        const sanitizedUrl = this.sanitizeUrl(url);

        if (!sanitizedUrl.startsWith('https://')) {
            return { success: false, error: 'URL must use HTTPS' };
        }

        if (!email) {
            return { success: false, error: 'Email is required' };
        }

        try {
            const auth = Buffer.from(`${email}:${token}`).toString('base64');
            const response = await this.apiGetWithAuth(sanitizedUrl, auth, '/rest/api/2/myself');
            const data = JSON.parse(response);
            const displayName = data.displayName || email;

            this.storedUrl = sanitizedUrl;
            this.storedEmail = email;
            await this.saveGlobalFileData();
            await this.context.secrets.store(JIRA_TOKEN_SECRET, token);

            this.connectionStatus = 'connected';
            this.user = displayName;
            this.needsAttention = false;

            await this.fetchTicketsSilent();
            this.startRefreshTimer();
            this.startReminderTimer();

            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Connection failed';
            if (message.includes('401') || message.includes('403')) {
                return { success: false, error: 'Invalid credentials' };
            }
            return { success: false, error: message };
        }
    }

    async disconnect(): Promise<void> {
        await this.context.secrets.delete(JIRA_TOKEN_SECRET);

        this.storedUrl = '';
        this.storedEmail = '';
        this.reminders = {};
        this.globalCollapsedGroups = {};
        this.workspaceCollapsedGroups = {};
        this.globalConfig = { ...DEFAULT_SCOPE_CONFIG };
        await this.saveGlobalFileData();
        await this.context.workspaceState.update(JIRA_WORKSPACE_CONFIG_KEY, undefined);
        await this.context.workspaceState.update(JIRA_WORKSPACE_COLLAPSED_KEY, undefined);

        this.connectionStatus = 'disconnected';
        this.user = null;
        this.tickets = [];
        this.globalTickets = null;
        this.workspaceTicketsRaw = null;
        this.snoozedUntil.clear();
        this.workspaceConfig = { ...DEFAULT_SCOPE_CONFIG };
        this.needsAttention = false;
        this.stopRefreshTimer();
        this.stopReminderTimer();
    }

    async saveSettings(
        globalConfig: JiraScopeConfig,
        workspaceConfig: JiraScopeConfig,
    ): Promise<void> {
        this.globalConfig = globalConfig;
        this.workspaceConfig = workspaceConfig;
        await this.saveGlobalFileData();
        await this.context.workspaceState.update(JIRA_WORKSPACE_CONFIG_KEY, workspaceConfig);
        await this.fetchTicketsSilent();
        if (this.connectionStatus === 'connected') {
            this.startRefreshTimer();
        }
    }

    async refreshTickets(): Promise<void> {
        await this.fetchTicketsSilent();
    }

    getState(): JiraState {
        return {
            connectionStatus: this.connectionStatus,
            user: this.user,
            tickets: this.getGlobalTickets(),
            workspaceTickets: this.getWorkspaceTickets(),
            globalConfig: this.globalConfig,
            workspaceConfig: this.workspaceConfig,
            reminders: this.reminders,
            collapsedGroups: {
                global: this.globalCollapsedGroups,
                workspace: this.workspaceCollapsedGroups,
            },
            needsAttention: this.needsAttention,
            loading: this.loading,
            lastError: this.lastError,
        };
    }

    private getGlobalTickets(): JiraTicket[] {
        if (this.globalConfig.filter.customJql) {
            return this.globalTickets ?? this.tickets;
        }
        return this.filterTickets(this.tickets, this.globalConfig.filter);
    }

    private getWorkspaceTickets(): JiraTicket[] {
        if (this.workspaceConfig.filter.customJql) {
            return this.workspaceTicketsRaw ?? this.tickets;
        }
        return this.filterTickets(this.tickets, this.workspaceConfig.filter);
    }

    private filterTickets(source: JiraTicket[], filter: JiraFilterConfig): JiraTicket[] {
        let filtered = source;

        if (filter.statuses.length > 0) {
            const statuses = filter.statuses.map((s) => s.toLowerCase());
            filtered = filtered.filter((t) => statuses.includes(t.status.toLowerCase()));
        }

        if (filter.projectKeys.length > 0) {
            const keys = filter.projectKeys.map((k) => k.toUpperCase());
            filtered = filtered.filter((t) => keys.includes(t.projectKey));
        }

        return filtered;
    }

    private async fetchTicketsSilent(): Promise<void> {
        if (this.connectionStatus !== 'connected') {
            return;
        }

        const token = await this.context.secrets.get(JIRA_TOKEN_SECRET);
        if (!this.storedUrl || !token) {
            return;
        }

        this.loading = true;

        try {
            const defaultJql =
                'assignee = currentUser() AND statusCategory != "Done" ORDER BY updated DESC';

            const globalJql = this.globalConfig.filter.customJql;
            const workspaceJql = this.workspaceConfig.filter.customJql;

            if (!globalJql && !workspaceJql) {
                const tickets = await this.fetchJql(token, defaultJql);
                this.tickets = tickets;
                this.globalTickets = null;
                this.workspaceTicketsRaw = null;
            } else {
                if (globalJql) {
                    this.globalTickets = await this.fetchJql(token, globalJql);
                } else {
                    this.globalTickets = null;
                }

                if (workspaceJql) {
                    this.workspaceTicketsRaw = await this.fetchJql(token, workspaceJql);
                } else {
                    this.workspaceTicketsRaw = null;
                }

                if (!globalJql || !workspaceJql) {
                    this.tickets = await this.fetchJql(token, defaultJql);
                } else {
                    this.tickets = [];
                }
            }

            this.lastError = null;
            await this.pruneReminders();
            await this.pruneCollapsedGroups();
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Fetch failed';
            this.handleFetchError(error);
        } finally {
            this.loading = false;
        }
    }

    private async fetchJql(token: string, jql: string): Promise<JiraTicket[]> {
        const normalized = this.normalizeJql(jql);
        const encodedJql = encodeURIComponent(normalized);
        const fields = 'summary,status,project,issuetype,priority,labels,parent';
        const path = `/rest/api/2/search/jql?jql=${encodedJql}&fields=${fields}&maxResults=50`;
        const response = await this.apiGet(this.storedUrl, token, path);
        const data = JSON.parse(response);
        return (data.issues || []).map((issue: any) => this.mapIssue(issue, this.storedUrl));
    }

    private normalizeJql(jql: string): string {
        try {
            return decodeURIComponent(jql);
        } catch {
            return jql;
        }
    }

    private handleFetchError(error: unknown): void {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('401') || message.includes('403')) {
            this.connectionStatus = 'disconnected';
            this.user = null;
            this.tickets = [];
            this.needsAttention = true;
            this.context.secrets.delete(JIRA_TOKEN_SECRET);
        }
    }

    private mapIssue(issue: any, baseUrl: string): JiraTicket {
        const statusCategory = issue.fields?.status?.statusCategory?.name || 'To Do';
        const parent = issue.fields?.parent;
        return {
            key: issue.key,
            summary: issue.fields?.summary || '',
            status: issue.fields?.status?.name || '',
            statusCategory: statusCategory as JiraTicket['statusCategory'],
            projectKey: issue.fields?.project?.key || '',
            url: `${baseUrl}/browse/${issue.key}`,
            issueType: issue.fields?.issuetype?.name || '',
            priority: issue.fields?.priority?.name || '',
            parentKey: parent?.key || null,
            parentSummary: parent?.fields?.summary || null,
            parentType: parent?.fields?.issuetype?.name || null,
            labels: issue.fields?.labels || [],
        };
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

    private apiGet(baseUrl: string, token: string, path: string): Promise<string> {
        const auth = Buffer.from(`${this.storedEmail}:${token}`).toString('base64');
        return this.apiGetWithAuth(baseUrl, auth, path);
    }

    private apiGetWithAuth(baseUrl: string, auth: string, path: string): Promise<string> {
        const url = new URL(path, baseUrl);

        return new Promise((resolve, reject) => {
            const request = https.get(
                url.toString(),
                {
                    headers: {
                        Authorization: `Basic ${auth}`,
                        Accept: 'application/json',
                    },
                },
                (response) => {
                    const statusCode = response.statusCode || 0;
                    if (statusCode === 401 || statusCode === 403) {
                        reject(new Error(`${statusCode} Unauthorized`));
                        response.resume();
                        return;
                    }
                    if (statusCode < 200 || statusCode >= 300) {
                        reject(new Error(`HTTP ${statusCode}`));
                        response.resume();
                        return;
                    }

                    let body = '';
                    response.setEncoding('utf-8');
                    response.on('data', (chunk) => {
                        body += chunk;
                    });
                    response.on('end', () => resolve(body));
                    response.on('error', reject);
                },
            );
            request.on('error', reject);
            request.setTimeout(15000, () => {
                request.destroy();
                reject(new Error('Request timed out'));
            });
        });
    }

    private startRefreshTimer(): void {
        this.stopRefreshTimer();
        const intervalMs =
            Math.min(
                this.globalConfig.filter.refreshInterval,
                this.workspaceConfig.filter.refreshInterval,
            ) *
            60 *
            1000;
        this.refreshTimer = setInterval(() => this.fetchTicketsSilent(), intervalMs);
    }

    private stopRefreshTimer(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    onReminderFired(callback: (ticketKey: string, summary: string, url: string) => void): void {
        this.onReminderFiredCallback = callback;
    }

    onExternalChange(callback: () => void): void {
        this.onExternalChangeCallback = callback;
    }

    startWatching(): void {
        const pattern = new vscode.RelativePattern(this.context.globalStorageUri, JIRA_GLOBAL_FILE);
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.watcher.onDidChange(() => this.handleExternalChange());
        this.watcher.onDidCreate(() => this.handleExternalChange());
    }

    private async handleExternalChange(): Promise<void> {
        if (this.suppressNextWatch) {
            this.suppressNextWatch = false;
            return;
        }
        await this.loadGlobalFileData();
        this.onExternalChangeCallback?.();
    }

    async setReminder(ticketKey: string, reminderAt: string): Promise<void> {
        this.reminders[ticketKey] = reminderAt;
        this.snoozedUntil.delete(ticketKey);
        await this.saveGlobalFileData();
    }

    async clearReminder(ticketKey: string): Promise<void> {
        delete this.reminders[ticketKey];
        this.snoozedUntil.delete(ticketKey);
        await this.saveGlobalFileData();
    }

    async setGroupCollapsed(
        scope: 'global' | 'workspace',
        groupBy: JiraGroupBy,
        groupName: string,
        collapsed: boolean,
    ): Promise<void> {
        const store =
            scope === 'workspace' ? this.workspaceCollapsedGroups : this.globalCollapsedGroups;

        if (!store[groupBy]) {
            store[groupBy] = [];
        }

        const index = store[groupBy].indexOf(groupName);
        if (collapsed && index === -1) {
            store[groupBy].push(groupName);
        } else if (!collapsed && index !== -1) {
            store[groupBy].splice(index, 1);
        }

        if (scope === 'workspace') {
            await this.context.workspaceState.update(
                JIRA_WORKSPACE_COLLAPSED_KEY,
                this.workspaceCollapsedGroups,
            );
        } else {
            await this.saveGlobalFileData();
        }
    }

    private async pruneReminders(): Promise<void> {
        const allTickets = [
            ...this.tickets,
            ...(this.globalTickets || []),
            ...(this.workspaceTicketsRaw || []),
        ];
        const visibleKeys = new Set(allTickets.map((t) => t.key));
        let changed = false;
        for (const key of Object.keys(this.reminders)) {
            if (!visibleKeys.has(key)) {
                delete this.reminders[key];
                this.snoozedUntil.delete(key);
                changed = true;
            }
        }

        for (const key of this.snoozedUntil.keys()) {
            if (!visibleKeys.has(key)) {
                this.snoozedUntil.delete(key);
            }
        }

        if (changed) {
            await this.saveGlobalFileData();
        }
    }

    private async pruneCollapsedGroups(): Promise<void> {
        const allTickets = [
            ...this.tickets,
            ...(this.globalTickets || []),
            ...(this.workspaceTicketsRaw || []),
        ];

        const validGroups: Record<string, Set<string>> = {
            issueType: new Set(allTickets.map((t) => t.issueType || 'Unknown')),
            project: new Set(allTickets.map((t) => t.projectKey || 'Unknown')),
            priority: new Set(allTickets.map((t) => t.priority || 'None')),
            parent: new Set(allTickets.map((t) => t.parentKey || '__ungrouped__')),
            label: new Set(
                allTickets.flatMap((t) =>
                    t.labels && t.labels.length > 0 ? t.labels : ['__unlabeled__'],
                ),
            ),
        };

        let globalChanged = false;
        for (const [groupBy, names] of Object.entries(this.globalCollapsedGroups)) {
            const valid = validGroups[groupBy];
            if (!valid) {
                delete this.globalCollapsedGroups[groupBy];
                globalChanged = true;
                continue;
            }
            const filtered = names.filter((n) => valid.has(n));
            if (filtered.length !== names.length) {
                this.globalCollapsedGroups[groupBy] = filtered;
                globalChanged = true;
            }
        }

        let workspaceChanged = false;
        for (const [groupBy, names] of Object.entries(this.workspaceCollapsedGroups)) {
            const valid = validGroups[groupBy];
            if (!valid) {
                delete this.workspaceCollapsedGroups[groupBy];
                workspaceChanged = true;
                continue;
            }
            const filtered = names.filter((n) => valid.has(n));
            if (filtered.length !== names.length) {
                this.workspaceCollapsedGroups[groupBy] = filtered;
                workspaceChanged = true;
            }
        }

        if (globalChanged) {
            await this.saveGlobalFileData();
        }
        if (workspaceChanged) {
            await this.context.workspaceState.update(
                JIRA_WORKSPACE_COLLAPSED_KEY,
                this.workspaceCollapsedGroups,
            );
        }
    }

    private checkReminders(): void {
        const now = Date.now();
        const allTickets = [
            ...this.tickets,
            ...(this.globalTickets || []),
            ...(this.workspaceTicketsRaw || []),
        ];
        for (const [ticketKey, reminderAt] of Object.entries(this.reminders)) {
            const reminderTime = new Date(reminderAt).getTime();
            if (isNaN(reminderTime) || reminderTime > now) {
                continue;
            }

            const snoozeEnd = this.snoozedUntil.get(ticketKey);
            if (snoozeEnd && now < snoozeEnd) {
                continue;
            }

            const ticket = allTickets.find((t) => t.key === ticketKey);
            if (!ticket) {
                continue;
            }

            this.snoozedUntil.set(ticketKey, now + 60_000);
            this.onReminderFiredCallback?.(ticketKey, ticket.summary, ticket.url);
        }
    }

    private startReminderTimer(): void {
        this.stopReminderTimer();
        this.reminderTimer = setInterval(() => this.checkReminders(), 10_000);
        this.checkReminders();
    }

    private stopReminderTimer(): void {
        if (this.reminderTimer) {
            clearInterval(this.reminderTimer);
            this.reminderTimer = undefined;
        }
    }

    dispose(): void {
        this.stopRefreshTimer();
        this.stopReminderTimer();
        this.watcher?.dispose();
    }
}
