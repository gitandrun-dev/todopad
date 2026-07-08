import * as assert from 'assert';
import { JiraService } from '../services/jiraService';
import { JiraScopeConfig, JiraTicket } from '../models/jiraTypes';
import { Uri, resetFileStore, getFileStore } from 'vscode';

interface FakeState {
    data: Record<string, any>;
    get<T>(key: string, defaultValue?: T): T | undefined;
    update(key: string, value: any): Promise<void>;
}

function createFakeState(): FakeState {
    const data: Record<string, any> = {};
    return {
        data,
        get<T>(key: string, defaultValue?: T): T | undefined {
            return key in data ? data[key] : defaultValue;
        },
        async update(key: string, value: any): Promise<void> {
            if (value === undefined) {
                delete data[key];
            } else {
                data[key] = value;
            }
        },
    };
}

interface FakeSecrets {
    data: Record<string, string>;
    get(key: string): Promise<string | undefined>;
    store(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

function createFakeSecrets(): FakeSecrets {
    const data: Record<string, string> = {};
    return {
        data,
        async get(key: string): Promise<string | undefined> {
            return data[key];
        },
        async store(key: string, value: string): Promise<void> {
            data[key] = value;
        },
        async delete(key: string): Promise<void> {
            delete data[key];
        },
    };
}

function createFakeContext() {
    return {
        globalState: createFakeState(),
        workspaceState: createFakeState(),
        secrets: createFakeSecrets(),
        globalStorageUri: Uri.parse('file:///fake/globalStorage'),
    };
}

function createService(context: ReturnType<typeof createFakeContext>): JiraService {
    return new JiraService(context as any);
}

function injectTickets(service: JiraService, tickets: JiraTicket[]): void {
    (service as any).tickets = tickets;
    (service as any).connectionStatus = 'connected';
    (service as any).user = 'test@example.com';
}

function getGlobalFileData(): any {
    const store = getFileStore();
    const key = 'file:///fake/globalStorage/jiraGlobalConfig.json';
    if (key in store) {
        const json = Buffer.from(store[key]).toString('utf8');
        return JSON.parse(json);
    }
    return null;
}

function setGlobalFileData(data: any): void {
    const store = getFileStore();
    const key = 'file:///fake/globalStorage/jiraGlobalConfig.json';
    store[key] = Buffer.from(JSON.stringify(data), 'utf8');
}

function sampleTickets(): JiraTicket[] {
    return [
        {
            key: 'WEB-1',
            summary: 'Fix login',
            status: 'In Progress',
            statusCategory: 'In Progress',
            projectKey: 'WEB',
            url: 'https://test.atlassian.net/browse/WEB-1',
        },
        {
            key: 'WEB-2',
            summary: 'Add dashboard',
            status: 'Open',
            statusCategory: 'To Do',
            projectKey: 'WEB',
            url: 'https://test.atlassian.net/browse/WEB-2',
        },
        {
            key: 'API-1',
            summary: 'Refactor auth',
            status: 'In Progress',
            statusCategory: 'In Progress',
            projectKey: 'API',
            url: 'https://test.atlassian.net/browse/API-1',
        },
        {
            key: 'API-2',
            summary: 'Add rate limiting',
            status: 'Review',
            statusCategory: 'In Progress',
            projectKey: 'API',
            url: 'https://test.atlassian.net/browse/API-2',
        },
        {
            key: 'MOBILE-1',
            summary: 'Push notifications',
            status: 'Open',
            statusCategory: 'To Do',
            projectKey: 'MOBILE',
            url: 'https://test.atlassian.net/browse/MOBILE-1',
        },
    ];
}

function pastTime(minutesAgo: number): string {
    return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function futureTime(minutesAhead: number): string {
    return new Date(Date.now() + minutesAhead * 60_000).toISOString();
}

suite('JiraService', () => {
    let context: ReturnType<typeof createFakeContext>;
    let service: JiraService;

    setup(() => {
        resetFileStore();
        context = createFakeContext();
        service = createService(context);
    });

    teardown(() => {
        service.dispose();
    });

    suite('initial state', () => {
        test('starts disconnected with empty data', () => {
            const state = service.getState();
            assert.strictEqual(state.connectionStatus, 'disconnected');
            assert.strictEqual(state.user, null);
            assert.deepStrictEqual(state.tickets, []);
            assert.deepStrictEqual(state.workspaceTickets, []);
            assert.deepStrictEqual(state.reminders, {});
            assert.strictEqual(state.needsAttention, false);
            assert.strictEqual(state.lastError, null);
        });

        test('default configs have visible true and empty filters', () => {
            const state = service.getState();
            assert.strictEqual(state.globalConfig.visible, true);
            assert.strictEqual(state.workspaceConfig.visible, true);
            assert.deepStrictEqual(state.globalConfig.filter.statuses, []);
            assert.deepStrictEqual(state.globalConfig.filter.projectKeys, []);
            assert.strictEqual(state.globalConfig.filter.customJql, null);
            assert.strictEqual(state.globalConfig.filter.refreshInterval, 5);
        });
    });

    suite('initialize', () => {
        test('loads global config from file', async () => {
            setGlobalFileData({
                url: '',
                email: '',
                globalConfig: {
                    visible: false,
                    filter: {
                        statuses: ['In Progress'],
                        projectKeys: ['WEB'],
                        customJql: null,
                        refreshInterval: 10,
                    },
                },
                reminders: {},
            });

            await service.initialize();

            const state = service.getState();
            assert.strictEqual(state.globalConfig.visible, false);
            assert.deepStrictEqual(state.globalConfig.filter.statuses, ['In Progress']);
            assert.deepStrictEqual(state.globalConfig.filter.projectKeys, ['WEB']);
            assert.strictEqual(state.globalConfig.filter.refreshInterval, 10);
        });

        test('loads workspace config from workspace state', async () => {
            const config: JiraScopeConfig = {
                visible: true,
                filter: {
                    statuses: ['Review'],
                    projectKeys: ['API'],
                    customJql: null,
                    refreshInterval: 3,
                },
            };
            await context.workspaceState.update('todopad.jira.workspaceConfig', config);

            await service.initialize();

            const state = service.getState();
            assert.deepStrictEqual(state.workspaceConfig.filter.statuses, ['Review']);
            assert.deepStrictEqual(state.workspaceConfig.filter.projectKeys, ['API']);
        });

        test('loads reminders from file', async () => {
            const reminders = { 'WEB-1': pastTime(5), 'API-1': futureTime(10) };
            setGlobalFileData({
                url: '',
                email: '',
                globalConfig: {
                    visible: true,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
                reminders,
            });

            await service.initialize();

            const state = service.getState();
            assert.strictEqual(state.reminders['WEB-1'], reminders['WEB-1']);
            assert.strictEqual(state.reminders['API-1'], reminders['API-1']);
        });

        test('migrates legacy globalState to file', async () => {
            const config: JiraScopeConfig = {
                visible: true,
                filter: {
                    statuses: ['Open'],
                    projectKeys: ['LEGACY'],
                    customJql: null,
                    refreshInterval: 7,
                },
            };
            await context.globalState.update('todopad.jira.globalConfig', config);
            await context.globalState.update('todopad.jira.url', 'https://legacy.atlassian.net');
            await context.globalState.update('todopad.jira.email', 'legacy@test.com');

            await service.initialize();

            const state = service.getState();
            assert.deepStrictEqual(state.globalConfig.filter.statuses, ['Open']);
            assert.deepStrictEqual(state.globalConfig.filter.projectKeys, ['LEGACY']);
            assert.strictEqual(context.globalState.data['todopad.jira.globalConfig'], undefined);
            assert.strictEqual(context.globalState.data['todopad.jira.url'], undefined);
            assert.strictEqual(context.globalState.data['todopad.jira.email'], undefined);

            const fileData = getGlobalFileData();
            assert.ok(fileData);
            assert.strictEqual(fileData.url, 'https://legacy.atlassian.net');
            assert.strictEqual(fileData.email, 'legacy@test.com');
        });

        test('migrates legacy filter to global config', async () => {
            const legacyFilter = {
                statuses: ['Open'],
                projectKeys: ['LEGACY'],
                customJql: null,
                refreshInterval: 7,
            };
            await context.globalState.update('todopad.jira.filter', legacyFilter);

            await service.initialize();

            const state = service.getState();
            assert.deepStrictEqual(state.globalConfig.filter.statuses, ['Open']);
            assert.deepStrictEqual(state.globalConfig.filter.projectKeys, ['LEGACY']);
            assert.strictEqual(state.globalConfig.filter.refreshInterval, 7);
            assert.strictEqual(context.globalState.data['todopad.jira.filter'], undefined);
        });

        test('does not connect without stored credentials', async () => {
            await service.initialize();

            const state = service.getState();
            assert.strictEqual(state.connectionStatus, 'disconnected');
        });
    });

    suite('connect', () => {
        test('upgrades HTTP to HTTPS before connecting', async () => {
            const result = await service.connect('http://jira.example.com', 'a@b.com', 'token');
            assert.strictEqual(result.success, false);
            assert.notStrictEqual(result.error, 'URL must use HTTPS');
        });

        test('rejects empty email', async () => {
            const result = await service.connect('https://jira.example.com', '', 'token');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Email is required');
        });

        test('sanitizes URL by adding https and removing trailing slashes', async () => {
            const result = await service.connect('jira.example.com///', 'a@b.com', 'token');
            assert.strictEqual(result.success, false);
            assert.notStrictEqual(result.error, 'URL must use HTTPS');
        });
    });

    suite('disconnect', () => {
        test('clears all state and stored data', async () => {
            injectTickets(service, sampleTickets());
            await service.setReminder('WEB-1', futureTime(10));

            await service.disconnect();

            const state = service.getState();
            assert.strictEqual(state.connectionStatus, 'disconnected');
            assert.strictEqual(state.user, null);
            assert.deepStrictEqual(state.tickets, []);
            assert.deepStrictEqual(state.workspaceTickets, []);
            assert.deepStrictEqual(state.reminders, {});
            assert.strictEqual(state.needsAttention, false);
        });

        test('clears global file data', async () => {
            injectTickets(service, sampleTickets());
            await service.setReminder('WEB-1', futureTime(10));

            await service.disconnect();

            const fileData = getGlobalFileData();
            assert.ok(fileData);
            assert.strictEqual(fileData.url, '');
            assert.strictEqual(fileData.email, '');
            assert.deepStrictEqual(fileData.reminders, {});
        });

        test('clears workspace state config', async () => {
            await context.workspaceState.update('todopad.jira.workspaceConfig', { visible: true });

            await service.disconnect();

            assert.strictEqual(
                context.workspaceState.data['todopad.jira.workspaceConfig'],
                undefined,
            );
        });

        test('clears secret token', async () => {
            await context.secrets.store('todopad.jira.token', 'secret123');

            await service.disconnect();

            const token = await context.secrets.get('todopad.jira.token');
            assert.strictEqual(token, undefined);
        });
    });

    suite('saveSettings', () => {
        test('persists global config to file', async () => {
            const globalConfig: JiraScopeConfig = {
                visible: true,
                filter: {
                    statuses: ['In Progress'],
                    projectKeys: ['WEB'],
                    customJql: null,
                    refreshInterval: 10,
                },
            };
            const workspaceConfig: JiraScopeConfig = {
                visible: false,
                filter: {
                    statuses: [],
                    projectKeys: ['API'],
                    customJql: null,
                    refreshInterval: 10,
                },
            };

            await service.saveSettings(globalConfig, workspaceConfig);

            const fileData = getGlobalFileData();
            assert.deepStrictEqual(fileData.globalConfig.filter.statuses, ['In Progress']);
            assert.deepStrictEqual(fileData.globalConfig.filter.projectKeys, ['WEB']);
        });

        test('persists workspace config to workspace state', async () => {
            const globalConfig: JiraScopeConfig = {
                visible: true,
                filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
            };
            const workspaceConfig: JiraScopeConfig = {
                visible: true,
                filter: {
                    statuses: ['Review'],
                    projectKeys: ['MOBILE'],
                    customJql: null,
                    refreshInterval: 5,
                },
            };

            await service.saveSettings(globalConfig, workspaceConfig);

            const stored = context.workspaceState.data['todopad.jira.workspaceConfig'];
            assert.deepStrictEqual(stored.filter.statuses, ['Review']);
            assert.deepStrictEqual(stored.filter.projectKeys, ['MOBILE']);
        });

        test('updates getState to reflect new configs', async () => {
            const globalConfig: JiraScopeConfig = {
                visible: false,
                filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 3 },
            };
            const workspaceConfig: JiraScopeConfig = {
                visible: true,
                filter: {
                    statuses: ['Open'],
                    projectKeys: [],
                    customJql: null,
                    refreshInterval: 3,
                },
            };

            await service.saveSettings(globalConfig, workspaceConfig);

            const state = service.getState();
            assert.strictEqual(state.globalConfig.visible, false);
            assert.deepStrictEqual(state.workspaceConfig.filter.statuses, ['Open']);
        });
    });

    suite('filterTickets', () => {
        setup(() => {
            injectTickets(service, sampleTickets());
        });

        test('no filters returns all tickets', () => {
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 5);
            assert.strictEqual(state.workspaceTickets.length, 5);
        });

        test('filters by status for global scope', async () => {
            await service.saveSettings(
                {
                    visible: true,
                    filter: {
                        statuses: ['In Progress'],
                        projectKeys: [],
                        customJql: null,
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
            );
            injectTickets(service, sampleTickets());
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 2);
            assert.ok(state.tickets.every((t) => t.status === 'In Progress'));
            assert.strictEqual(state.workspaceTickets.length, 5);
        });

        test('filters by project keys for workspace scope', async () => {
            await service.saveSettings(
                {
                    visible: true,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
                {
                    visible: true,
                    filter: {
                        statuses: [],
                        projectKeys: ['API'],
                        customJql: null,
                        refreshInterval: 5,
                    },
                },
            );
            injectTickets(service, sampleTickets());
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 5);
            assert.strictEqual(state.workspaceTickets.length, 2);
            assert.ok(state.workspaceTickets.every((t) => t.projectKey === 'API'));
        });

        test('filters by both status and project', async () => {
            await service.saveSettings(
                {
                    visible: true,
                    filter: {
                        statuses: ['In Progress'],
                        projectKeys: ['API'],
                        customJql: null,
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
            );
            injectTickets(service, sampleTickets());
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 1);
            assert.strictEqual(state.tickets[0].key, 'API-1');
        });

        test('status filtering is case insensitive', async () => {
            await service.saveSettings(
                {
                    visible: true,
                    filter: {
                        statuses: ['in progress'],
                        projectKeys: [],
                        customJql: null,
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
            );
            injectTickets(service, sampleTickets());
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 2);
        });

        test('project key filtering is case insensitive', async () => {
            await service.saveSettings(
                {
                    visible: true,
                    filter: {
                        statuses: [],
                        projectKeys: ['web'],
                        customJql: null,
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
            );
            injectTickets(service, sampleTickets());
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 2);
            assert.ok(state.tickets.every((t) => t.projectKey === 'WEB'));
        });

        test('custom JQL disables client-side filtering', async () => {
            await service.saveSettings(
                {
                    visible: true,
                    filter: {
                        statuses: ['In Progress'],
                        projectKeys: ['WEB'],
                        customJql: 'assignee = currentUser()',
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
            );
            injectTickets(service, sampleTickets());
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 5);
        });

        test('scopes filter independently', async () => {
            await service.saveSettings(
                {
                    visible: true,
                    filter: {
                        statuses: [],
                        projectKeys: ['WEB'],
                        customJql: null,
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: {
                        statuses: [],
                        projectKeys: ['API'],
                        customJql: null,
                        refreshInterval: 5,
                    },
                },
            );
            injectTickets(service, sampleTickets());
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 2);
            assert.ok(state.tickets.every((t) => t.projectKey === 'WEB'));
            assert.strictEqual(state.workspaceTickets.length, 2);
            assert.ok(state.workspaceTickets.every((t) => t.projectKey === 'API'));
        });

        test('empty filter with no tickets returns empty array', () => {
            injectTickets(service, []);
            const state = service.getState();
            assert.deepStrictEqual(state.tickets, []);
            assert.deepStrictEqual(state.workspaceTickets, []);
        });
    });

    suite('visibility config', () => {
        test('visibility is passed through in state', async () => {
            await service.saveSettings(
                {
                    visible: false,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
                {
                    visible: true,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
            );
            const state = service.getState();
            assert.strictEqual(state.globalConfig.visible, false);
            assert.strictEqual(state.workspaceConfig.visible, true);
        });

        test('visibility does not affect ticket filtering', async () => {
            await service.saveSettings(
                {
                    visible: false,
                    filter: {
                        statuses: [],
                        projectKeys: ['WEB'],
                        customJql: null,
                        refreshInterval: 5,
                    },
                },
                {
                    visible: false,
                    filter: { statuses: [], projectKeys: [], customJql: null, refreshInterval: 5 },
                },
            );
            injectTickets(service, sampleTickets());
            const state = service.getState();
            assert.strictEqual(state.tickets.length, 2);
            assert.strictEqual(state.workspaceTickets.length, 5);
        });
    });

    suite('reminders', () => {
        setup(() => {
            injectTickets(service, sampleTickets());
        });

        test('setReminder stores reminder in state', async () => {
            const time = futureTime(30);
            await service.setReminder('WEB-1', time);
            const state = service.getState();
            assert.strictEqual(state.reminders['WEB-1'], time);
        });

        test('setReminder persists to file', async () => {
            const time = futureTime(30);
            await service.setReminder('WEB-1', time);
            const fileData = getGlobalFileData();
            assert.strictEqual(fileData.reminders['WEB-1'], time);
        });

        test('clearReminder removes the reminder', async () => {
            await service.setReminder('WEB-1', futureTime(30));
            await service.clearReminder('WEB-1');
            const state = service.getState();
            assert.strictEqual(state.reminders['WEB-1'], undefined);
        });

        test('clearReminder persists removal', async () => {
            await service.setReminder('WEB-1', futureTime(30));
            await service.clearReminder('WEB-1');
            const fileData = getGlobalFileData();
            assert.strictEqual(fileData.reminders['WEB-1'], undefined);
        });

        test('multiple reminders can coexist', async () => {
            await service.setReminder('WEB-1', futureTime(10));
            await service.setReminder('API-1', futureTime(20));
            const state = service.getState();
            assert.ok(state.reminders['WEB-1']);
            assert.ok(state.reminders['API-1']);
        });

        test('setting reminder on same ticket overwrites previous', async () => {
            const firstTime = futureTime(10);
            const secondTime = futureTime(60);
            await service.setReminder('WEB-1', firstTime);
            await service.setReminder('WEB-1', secondTime);
            const state = service.getState();
            assert.strictEqual(state.reminders['WEB-1'], secondTime);
        });
    });

    suite('reminder firing', () => {
        let firedReminders: { ticketKey: string; summary: string; url: string }[];

        setup(() => {
            firedReminders = [];
            injectTickets(service, sampleTickets());
            service.onReminderFired((ticketKey, summary, url) => {
                firedReminders.push({ ticketKey, summary, url });
            });
        });

        test('fires callback for past-due reminder', async () => {
            await service.setReminder('WEB-1', pastTime(5));
            (service as any).checkReminders();
            assert.strictEqual(firedReminders.length, 1);
            assert.strictEqual(firedReminders[0].ticketKey, 'WEB-1');
            assert.strictEqual(firedReminders[0].summary, 'Fix login');
            assert.strictEqual(firedReminders[0].url, 'https://test.atlassian.net/browse/WEB-1');
        });

        test('does not fire for future reminder', async () => {
            await service.setReminder('WEB-1', futureTime(30));
            (service as any).checkReminders();
            assert.strictEqual(firedReminders.length, 0);
        });

        test('does not fire if ticket not in list', async () => {
            await service.setReminder('GONE-99', pastTime(5));
            (service as any).checkReminders();
            assert.strictEqual(firedReminders.length, 0);
        });

        test('does not re-fire during snooze window', async () => {
            await service.setReminder('WEB-1', pastTime(5));
            (service as any).checkReminders();
            (service as any).checkReminders();
            assert.strictEqual(firedReminders.length, 1);
        });

        test('fires for multiple due reminders', async () => {
            await service.setReminder('WEB-1', pastTime(5));
            await service.setReminder('API-1', pastTime(3));
            (service as any).checkReminders();
            assert.strictEqual(firedReminders.length, 2);
        });

        test('does not fire for invalid date string', async () => {
            await service.setReminder('WEB-1', 'not-a-date');
            (service as any).checkReminders();
            assert.strictEqual(firedReminders.length, 0);
        });
    });

    suite('dispose', () => {
        test('stops refresh timer', () => {
            injectTickets(service, sampleTickets());
            (service as any).startRefreshTimer();
            assert.ok((service as any).refreshTimer);
            service.dispose();
            assert.strictEqual((service as any).refreshTimer, undefined);
        });

        test('stops reminder timer', () => {
            injectTickets(service, sampleTickets());
            (service as any).startReminderTimer();
            assert.ok((service as any).reminderTimer);
            service.dispose();
            assert.strictEqual((service as any).reminderTimer, undefined);
        });
    });
});
