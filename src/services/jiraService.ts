import * as vscode from 'vscode';
import * as https from 'https';
import {
    JiraTicket,
    JiraFilterConfig,
    JiraConnectionStatus,
    JiraState,
    DEFAULT_FILTER,
} from '../models/jiraTypes';

const JIRA_URL_KEY = 'todopad.jira.url';
const JIRA_EMAIL_KEY = 'todopad.jira.email';
const JIRA_FILTER_KEY = 'todopad.jira.filter';
const JIRA_TOKEN_SECRET = 'todopad.jira.token';

export class JiraService implements vscode.Disposable {
    private connectionStatus: JiraConnectionStatus = 'disconnected';
    private user: string | null = null;
    private tickets: JiraTicket[] = [];
    private filter: JiraFilterConfig = { ...DEFAULT_FILTER };
    private needsAttention = false;
    private lastError: string | null = null;
    private refreshTimer: ReturnType<typeof setInterval> | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {}

    async initialize(): Promise<void> {
        const url = this.getStoredUrl();
        const token = await this.context.secrets.get(JIRA_TOKEN_SECRET);
        const filter = this.context.globalState.get<JiraFilterConfig>(JIRA_FILTER_KEY);

        if (filter) {
            this.filter = {
                statuses: filter.statuses || [],
                projectKeys: filter.projectKeys || [],
                customJql: filter.customJql || null,
            };
        }

        if (url && token) {
            const email = this.context.globalState.get<string>(JIRA_EMAIL_KEY, '');
            if (email) {
                this.connectionStatus = 'connected';
                this.user = email;
                await this.fetchTicketsSilent();
                this.startRefreshTimer();
            }
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
        await this.context.globalState.update(JIRA_FILTER_KEY, undefined);

        this.connectionStatus = 'disconnected';
        this.user = null;
        this.tickets = [];
        this.filter = { ...DEFAULT_FILTER };
        this.needsAttention = false;
        this.stopRefreshTimer();
    }

    async saveFilter(config: JiraFilterConfig): Promise<void> {
        this.filter = config;
        await this.context.globalState.update(JIRA_FILTER_KEY, config);
        await this.fetchTicketsSilent();
    }

    async refreshTickets(): Promise<void> {
        await this.fetchTicketsSilent();
    }

    getState(): JiraState {
        return {
            connectionStatus: this.connectionStatus,
            user: this.user,
            tickets: this.tickets,
            filter: this.filter,
            needsAttention: this.needsAttention,
            lastError: this.lastError,
        };
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
        if (this.filter.customJql) {
            return this.filter.customJql;
        }

        let jql = 'assignee = currentUser()';

        if (this.filter.statuses.length > 0) {
            const statuses = this.filter.statuses
                .map((s) => `"${s.replace(/"/g, '\\"')}"`)
                .join(', ');
            jql += ` AND status in (${statuses})`;
        } else {
            jql += ' AND statusCategory != "Done"';
        }

        if (this.filter.projectKeys.length > 0) {
            const projects = this.filter.projectKeys
                .map((p) => `"${p.replace(/"/g, '\\"')}"`)
                .join(', ');
            jql += ` AND project in (${projects})`;
        }

        jql += ' ORDER BY updated DESC';

        return jql;
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
        const intervalMinutes = vscode.workspace
            .getConfiguration('todopad')
            .get<number>('jira.refreshInterval', 5);
        const intervalMs = intervalMinutes * 60 * 1000;
        this.refreshTimer = setInterval(() => this.fetchTicketsSilent(), intervalMs);
    }

    private stopRefreshTimer(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    dispose(): void {
        this.stopRefreshTimer();
    }
}
