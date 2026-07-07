import * as vscode from 'vscode';
import * as https from 'https';
import {
    JiraTicket,
    JiraFilterConfig,
    JiraConnectionStatus,
    JiraState,
    JiraScopeConfig,
    DEFAULT_SCOPE_CONFIG,
} from '../models/jiraTypes';

const JIRA_URL_KEY = 'todopad.jira.url';
const JIRA_EMAIL_KEY = 'todopad.jira.email';
const JIRA_GLOBAL_CONFIG_KEY = 'todopad.jira.globalConfig';
const JIRA_WORKSPACE_CONFIG_KEY = 'todopad.jira.workspaceConfig';
const JIRA_TOKEN_SECRET = 'todopad.jira.token';
const JIRA_REMINDERS_KEY = 'todopad.jira.reminders';

export class JiraService implements vscode.Disposable {
    private connectionStatus: JiraConnectionStatus = 'disconnected';
    private user: string | null = null;
    private tickets: JiraTicket[] = [];
    private globalConfig: JiraScopeConfig = { ...DEFAULT_SCOPE_CONFIG };
    private workspaceConfig: JiraScopeConfig = { ...DEFAULT_SCOPE_CONFIG };
    private reminders: Record<string, string> = {};
    private needsAttention = false;
    private lastError: string | null = null;
    private refreshTimer: ReturnType<typeof setInterval> | undefined;
    private reminderTimer: ReturnType<typeof setInterval> | undefined;
    private snoozedUntil: Map<string, number> = new Map();
    private onReminderFiredCallback?: (ticketKey: string, summary: string, url: string) => void;

    constructor(private readonly context: vscode.ExtensionContext) {}

    async initialize(): Promise<void> {
        const url = this.getStoredUrl();
        const token = await this.context.secrets.get(JIRA_TOKEN_SECRET);
        const reminders = this.context.globalState.get<Record<string, string>>(JIRA_REMINDERS_KEY);

        this.loadGlobalConfig();
        this.loadWorkspaceConfig();

        if (reminders) {
            this.reminders = reminders;
        }

        if (url && token) {
            const email = this.context.globalState.get<string>(JIRA_EMAIL_KEY, '');
            if (email) {
                this.connectionStatus = 'connected';
                this.user = email;
                await this.fetchTicketsSilent();
                this.startRefreshTimer();
                this.startReminderTimer();
            }
        }
    }

    private loadGlobalConfig(): void {
        const stored = this.context.globalState.get<JiraScopeConfig>(JIRA_GLOBAL_CONFIG_KEY);
        if (stored) {
            this.globalConfig = {
                visible: stored.visible !== false,
                filter: {
                    statuses: stored.filter?.statuses || [],
                    projectKeys: stored.filter?.projectKeys || [],
                    customJql: stored.filter?.customJql || null,
                    refreshInterval: stored.filter?.refreshInterval || 5,
                },
            };
        } else {
            const legacy = this.context.globalState.get<any>('todopad.jira.filter');
            if (legacy) {
                this.globalConfig = {
                    visible: true,
                    filter: {
                        statuses: legacy.statuses || [],
                        projectKeys: legacy.projectKeys || [],
                        customJql: legacy.customJql || null,
                        refreshInterval: legacy.refreshInterval || 5,
                    },
                };
                this.context.globalState.update('todopad.jira.filter', undefined);
                this.context.globalState.update(JIRA_GLOBAL_CONFIG_KEY, this.globalConfig);
            }
        }
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
                },
            };
        }
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

            await this.context.globalState.update(JIRA_URL_KEY, sanitizedUrl);
            await this.context.globalState.update(JIRA_EMAIL_KEY, email);
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
        await this.context.globalState.update(JIRA_URL_KEY, undefined);
        await this.context.globalState.update(JIRA_EMAIL_KEY, undefined);
        await this.context.globalState.update(JIRA_GLOBAL_CONFIG_KEY, undefined);
        await this.context.globalState.update(JIRA_REMINDERS_KEY, undefined);
        await this.context.workspaceState.update(JIRA_WORKSPACE_CONFIG_KEY, undefined);

        this.connectionStatus = 'disconnected';
        this.user = null;
        this.tickets = [];
        this.reminders = {};
        this.snoozedUntil.clear();
        this.globalConfig = { ...DEFAULT_SCOPE_CONFIG };
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
        await this.context.globalState.update(JIRA_GLOBAL_CONFIG_KEY, globalConfig);
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
            tickets: this.filterTickets(this.globalConfig.filter),
            workspaceTickets: this.filterTickets(this.workspaceConfig.filter),
            globalConfig: this.globalConfig,
            workspaceConfig: this.workspaceConfig,
            reminders: this.reminders,
            needsAttention: this.needsAttention,
            lastError: this.lastError,
        };
    }

    private filterTickets(filter: JiraFilterConfig): JiraTicket[] {
        let filtered = this.tickets;

        if (filter.customJql) {
            return filtered;
        }

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

        const url = this.getStoredUrl();
        const token = await this.context.secrets.get(JIRA_TOKEN_SECRET);
        if (!url || !token) {
            return;
        }

        const jql = this.buildJql();
        const encodedJql = encodeURIComponent(jql);
        const fields = 'summary,status,project';
        const path = `/rest/api/2/search/jql?jql=${encodedJql}&fields=${fields}&maxResults=50`;

        try {
            const response = await this.apiGet(url, token, path);
            const data = JSON.parse(response);
            this.tickets = (data.issues || []).map((issue: any) => this.mapIssue(issue, url));
            this.lastError = null;
            await this.pruneReminders();
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Fetch failed';
            this.handleFetchError(error);
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

    private buildJql(): string {
        return 'assignee = currentUser() AND statusCategory != "Done" ORDER BY updated DESC';
    }

    private mapIssue(issue: any, baseUrl: string): JiraTicket {
        const statusCategory = issue.fields?.status?.statusCategory?.name || 'To Do';
        return {
            key: issue.key,
            summary: issue.fields?.summary || '',
            status: issue.fields?.status?.name || '',
            statusCategory: statusCategory as JiraTicket['statusCategory'],
            projectKey: issue.fields?.project?.key || '',
            url: `${baseUrl}/browse/${issue.key}`,
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

    private getStoredUrl(): string {
        return this.context.globalState.get<string>(JIRA_URL_KEY, '');
    }

    private apiGet(baseUrl: string, token: string, path: string): Promise<string> {
        const email = this.context.globalState.get<string>(JIRA_EMAIL_KEY, '');
        const auth = Buffer.from(`${email}:${token}`).toString('base64');
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

    async setReminder(ticketKey: string, reminderAt: string): Promise<void> {
        this.reminders[ticketKey] = reminderAt;
        this.snoozedUntil.delete(ticketKey);
        await this.context.globalState.update(JIRA_REMINDERS_KEY, this.reminders);
    }

    async clearReminder(ticketKey: string): Promise<void> {
        delete this.reminders[ticketKey];
        this.snoozedUntil.delete(ticketKey);
        await this.context.globalState.update(JIRA_REMINDERS_KEY, this.reminders);
    }

    private async pruneReminders(): Promise<void> {
        const visibleKeys = new Set(this.tickets.map((t) => t.key));
        let changed = false;
        for (const key of Object.keys(this.reminders)) {
            if (!visibleKeys.has(key)) {
                delete this.reminders[key];
                this.snoozedUntil.delete(key);
                changed = true;
            }
        }
        if (changed) {
            await this.context.globalState.update(JIRA_REMINDERS_KEY, this.reminders);
        }
    }

    private checkReminders(): void {
        const now = Date.now();
        for (const [ticketKey, reminderAt] of Object.entries(this.reminders)) {
            const reminderTime = new Date(reminderAt).getTime();
            if (isNaN(reminderTime) || reminderTime > now) {
                continue;
            }

            const snoozeEnd = this.snoozedUntil.get(ticketKey);
            if (snoozeEnd && now < snoozeEnd) {
                continue;
            }

            const ticket = this.tickets.find((t) => t.key === ticketKey);
            if (!ticket) {
                continue;
            }

            this.snoozedUntil.set(ticketKey, now + 30_000);
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
    }
}
