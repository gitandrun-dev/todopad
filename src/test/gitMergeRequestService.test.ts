import * as assert from 'assert';
import { GitMergeRequestService } from '../services/gitMergeRequestService';
import { GitScopeConfig, MergeRequest } from '../models/gitMergeRequestTypes';
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

function createService(
    context: ReturnType<typeof createFakeContext>,
): GitMergeRequestService {
    return new GitMergeRequestService(context as any);
}

function injectMergeRequests(
    service: GitMergeRequestService,
    platform: 'gitlab' | 'github',
    assigned: MergeRequest[],
    reviewRequested: MergeRequest[],
): void {
    const runtime = (service as any).platforms[platform];
    runtime.assigned = assigned;
    runtime.reviewRequested = reviewRequested;
    runtime.connectionStatus = 'connected';
    runtime.user = 'testuser';
}

function getGlobalFileData(): any {
    const store = getFileStore();
    const key = 'file:///fake/globalStorage/gitMergeRequestConfig.json';
    if (key in store) {
        const json = Buffer.from(store[key]).toString('utf8');
        return JSON.parse(json);
    }
    return null;
}

function setGlobalFileData(data: any): void {
    const store = getFileStore();
    const key = 'file:///fake/globalStorage/gitMergeRequestConfig.json';
    store[key] = Buffer.from(JSON.stringify(data), 'utf8');
}

function pastTime(minutesAgo: number): string {
    return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function futureTime(minutesAhead: number): string {
    return new Date(Date.now() + minutesAhead * 60_000).toISOString();
}

function sampleGitlabMergeRequests(): MergeRequest[] {
    return [
        {
            id: 'gitlab-101-1',
            platform: 'gitlab',
            number: 101,
            title: 'Fix auth token refresh',
            state: 'open',
            author: 'alice',
            url: 'https://gitlab.com/team/frontend/-/merge_requests/101',
            projectPath: 'team/frontend',
            sourceBranch: 'fix/auth-refresh',
            targetBranch: 'main',
            updatedAt: '2025-01-15T10:00:00Z',
            isDraft: false,
            approval: { required: 2, given: 1 },
            isAuthor: true,
        },
        {
            id: 'gitlab-102-1',
            platform: 'gitlab',
            number: 102,
            title: 'Add user preferences page',
            state: 'open',
            author: 'bob',
            url: 'https://gitlab.com/team/frontend/-/merge_requests/102',
            projectPath: 'team/frontend',
            sourceBranch: 'feat/user-prefs',
            targetBranch: 'main',
            updatedAt: '2025-01-14T08:00:00Z',
            isDraft: false,
            approval: null,
            isAuthor: false,
        },
    ];
}

function sampleGithubMergeRequests(): MergeRequest[] {
    return [
        {
            id: 'github-201-myorg/api',
            platform: 'github',
            number: 201,
            title: 'Update CI pipeline for Node 20',
            state: 'open',
            author: 'testuser',
            url: 'https://github.com/myorg/api/pull/201',
            projectPath: 'myorg/api',
            sourceBranch: 'chore/node-20',
            targetBranch: 'main',
            updatedAt: '2025-01-13T12:00:00Z',
            isDraft: true,
            approval: { required: 1, given: 0 },
            isAuthor: true,
        },
        {
            id: 'github-202-myorg/api',
            platform: 'github',
            number: 202,
            title: 'Add rate limiting middleware',
            state: 'open',
            author: 'carol',
            url: 'https://github.com/myorg/api/pull/202',
            projectPath: 'myorg/api',
            sourceBranch: 'feat/rate-limit',
            targetBranch: 'main',
            updatedAt: '2025-01-12T09:00:00Z',
            isDraft: false,
            approval: null,
            isAuthor: false,
        },
    ];
}

suite('GitMergeRequestService', () => {
    let context: ReturnType<typeof createFakeContext>;
    let service: GitMergeRequestService;

    setup(() => {
        resetFileStore();
        context = createFakeContext();
        service = createService(context);
    });

    teardown(() => {
        service.dispose();
    });

    suite('initial state', () => {
        test('starts disconnected with empty data for both platforms', () => {
            const state = service.getState();
            assert.strictEqual(state.gitlab.connectionStatus, 'disconnected');
            assert.strictEqual(state.github.connectionStatus, 'disconnected');
            assert.strictEqual(state.gitlab.user, null);
            assert.strictEqual(state.github.user, null);
            assert.deepStrictEqual(state.gitlab.assigned, []);
            assert.deepStrictEqual(state.gitlab.reviewRequested, []);
            assert.deepStrictEqual(state.github.assigned, []);
            assert.deepStrictEqual(state.github.reviewRequested, []);
        });

        test('default configs have correct filter defaults', () => {
            const state = service.getState();
            assert.strictEqual(state.gitlab.globalConfig.visible, true);
            assert.strictEqual(state.gitlab.globalConfig.filter.showAssigned, true);
            assert.strictEqual(state.gitlab.globalConfig.filter.showReviewRequested, true);
            assert.strictEqual(state.gitlab.globalConfig.filter.showDrafts, false);
            assert.deepStrictEqual(state.gitlab.globalConfig.filter.projectPaths, []);
            assert.strictEqual(state.gitlab.globalConfig.filter.refreshInterval, 5);
        });
    });

    suite('initialize', () => {
        test('loads global config from file', async () => {
            setGlobalFileData({
                gitlab: {
                    url: 'https://gitlab.com',
                    user: 'testuser',
                    globalConfig: {
                        visible: false,
                        filter: {
                            showAssigned: true,
                            showReviewRequested: false,
                            showDrafts: true,
                            projectPaths: ['team/frontend'],
                            refreshInterval: 10,
                        },
                    },
                    reminders: {},
                },
                github: {
                    url: '',
                    user: '',
                    globalConfig: {
                        visible: true,
                        filter: {
                            showAssigned: true,
                            showReviewRequested: true,
                            showDrafts: false,
                            projectPaths: [],
                            refreshInterval: 5,
                        },
                    },
                    reminders: {},
                },
            });

            await service.initialize();

            const state = service.getState();
            assert.strictEqual(state.gitlab.globalConfig.visible, false);
            assert.strictEqual(state.gitlab.globalConfig.filter.showReviewRequested, false);
            assert.strictEqual(state.gitlab.globalConfig.filter.showDrafts, true);
            assert.deepStrictEqual(state.gitlab.globalConfig.filter.projectPaths, ['team/frontend']);
            assert.strictEqual(state.gitlab.globalConfig.filter.refreshInterval, 10);
        });

        test('loads reminders from file', async () => {
            const reminders = { 'gitlab-101-1': futureTime(10) };
            setGlobalFileData({
                gitlab: {
                    url: '',
                    user: '',
                    globalConfig: {
                        visible: true,
                        filter: {
                            showAssigned: true,
                            showReviewRequested: true,
                            showDrafts: false,
                            projectPaths: [],
                            refreshInterval: 5,
                        },
                    },
                    reminders,
                },
                github: {
                    url: '',
                    user: '',
                    globalConfig: {
                        visible: true,
                        filter: {
                            showAssigned: true,
                            showReviewRequested: true,
                            showDrafts: false,
                            projectPaths: [],
                            refreshInterval: 5,
                        },
                    },
                    reminders: {},
                },
            });

            await service.initialize();

            const state = service.getState();
            assert.strictEqual(state.gitlab.reminders['gitlab-101-1'], reminders['gitlab-101-1']);
        });

        test('does not connect without stored credentials', async () => {
            await service.initialize();
            const state = service.getState();
            assert.strictEqual(state.gitlab.connectionStatus, 'disconnected');
            assert.strictEqual(state.github.connectionStatus, 'disconnected');
        });
    });

    suite('connect', () => {
        test('rejects plain HTTP URL that cannot be upgraded', async () => {
            const result = await service.connect('gitlab', 'http://gitlab.com', 'token');
            assert.strictEqual(result.success, false);
        });

        test('sanitizes URL by adding https and removing trailing slashes', async () => {
            const result = await service.connect('gitlab', 'gitlab.example.com///', 'token');
            assert.strictEqual(result.success, false);
            assert.notStrictEqual(result.error, 'URL must use HTTPS');
        });
    });

    suite('disconnect', () => {
        test('clears all state for the platform', async () => {
            injectMergeRequests(service, 'gitlab', sampleGitlabMergeRequests(), []);
            await service.setReminder('gitlab-101-1', futureTime(10));

            await service.disconnect('gitlab');

            const state = service.getState();
            assert.strictEqual(state.gitlab.connectionStatus, 'disconnected');
            assert.strictEqual(state.gitlab.user, null);
            assert.deepStrictEqual(state.gitlab.assigned, []);
            assert.deepStrictEqual(state.gitlab.reviewRequested, []);
            assert.deepStrictEqual(state.gitlab.reminders, {});
        });

        test('does not affect the other platform', async () => {
            const nonDraftMergeRequests = sampleGithubMergeRequests().filter((mr) => !mr.isDraft);
            injectMergeRequests(service, 'gitlab', sampleGitlabMergeRequests(), []);
            injectMergeRequests(service, 'github', nonDraftMergeRequests, []);

            await service.disconnect('gitlab');

            const state = service.getState();
            assert.strictEqual(state.gitlab.connectionStatus, 'disconnected');
            assert.strictEqual(state.github.connectionStatus, 'connected');
            assert.strictEqual(state.github.assigned.length, 1);
        });

        test('clears global file data for the platform', async () => {
            injectMergeRequests(service, 'gitlab', sampleGitlabMergeRequests(), []);
            await service.setReminder('gitlab-101-1', futureTime(10));

            await service.disconnect('gitlab');

            const fileData = getGlobalFileData();
            assert.ok(fileData);
            assert.strictEqual(fileData.gitlab.url, '');
            assert.deepStrictEqual(fileData.gitlab.reminders, {});
        });

        test('clears secret token', async () => {
            await context.secrets.store('todopad.git.gitlab.token', 'secret123');

            await service.disconnect('gitlab');

            const token = await context.secrets.get('todopad.git.gitlab.token');
            assert.strictEqual(token, undefined);
        });
    });

    suite('saveSettings', () => {
        test('persists global config to file', async () => {
            const globalConfig: GitScopeConfig = {
                visible: true,
                filter: {
                    showAssigned: true,
                    showReviewRequested: false,
                    showDrafts: true,
                    projectPaths: ['team/frontend'],
                    refreshInterval: 10,
                },
            };
            const workspaceConfig: GitScopeConfig = {
                visible: true,
                filter: {
                    showAssigned: true,
                    showReviewRequested: true,
                    showDrafts: false,
                    projectPaths: [],
                    refreshInterval: 5,
                },
            };

            await service.saveSettings('gitlab', globalConfig, workspaceConfig);

            const fileData = getGlobalFileData();
            assert.strictEqual(fileData.gitlab.globalConfig.filter.showReviewRequested, false);
            assert.strictEqual(fileData.gitlab.globalConfig.filter.showDrafts, true);
            assert.deepStrictEqual(fileData.gitlab.globalConfig.filter.projectPaths, ['team/frontend']);
        });

        test('persists workspace config to workspace state', async () => {
            const globalConfig: GitScopeConfig = {
                visible: true,
                filter: {
                    showAssigned: true,
                    showReviewRequested: true,
                    showDrafts: false,
                    projectPaths: [],
                    refreshInterval: 5,
                },
            };
            const workspaceConfig: GitScopeConfig = {
                visible: true,
                filter: {
                    showAssigned: false,
                    showReviewRequested: true,
                    showDrafts: false,
                    projectPaths: ['team/backend'],
                    refreshInterval: 3,
                },
            };

            await service.saveSettings('github', globalConfig, workspaceConfig);

            const stored = context.workspaceState.data['todopad.git.workspaceConfig'];
            assert.deepStrictEqual(stored.github.filter.projectPaths, ['team/backend']);
            assert.strictEqual(stored.github.filter.showAssigned, false);
        });

        test('updates getState to reflect new configs', async () => {
            const globalConfig: GitScopeConfig = {
                visible: false,
                filter: {
                    showAssigned: true,
                    showReviewRequested: true,
                    showDrafts: true,
                    projectPaths: [],
                    refreshInterval: 3,
                },
            };
            const workspaceConfig: GitScopeConfig = {
                visible: true,
                filter: {
                    showAssigned: false,
                    showReviewRequested: true,
                    showDrafts: false,
                    projectPaths: ['myorg/api'],
                    refreshInterval: 3,
                },
            };

            await service.saveSettings('gitlab', globalConfig, workspaceConfig);

            const state = service.getState();
            assert.strictEqual(state.gitlab.globalConfig.visible, false);
            assert.strictEqual(state.gitlab.globalConfig.filter.showDrafts, true);
            assert.strictEqual(state.gitlab.workspaceConfig.filter.showAssigned, false);
            assert.deepStrictEqual(state.gitlab.workspaceConfig.filter.projectPaths, ['myorg/api']);
        });
    });

    suite('filtering', () => {
        setup(() => {
            injectMergeRequests(
                service,
                'gitlab',
                sampleGitlabMergeRequests(),
                [sampleGitlabMergeRequests()[1]],
            );
        });

        test('no filters returns all merge requests', () => {
            const state = service.getState();
            assert.strictEqual(state.gitlab.assigned.length, 2);
            assert.strictEqual(state.gitlab.reviewRequested.length, 1);
        });

        test('filters by project paths', async () => {
            await service.saveSettings(
                'gitlab',
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: ['team/frontend'],
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: [],
                        refreshInterval: 5,
                    },
                },
            );
            injectMergeRequests(
                service,
                'gitlab',
                sampleGitlabMergeRequests(),
                [sampleGitlabMergeRequests()[1]],
            );

            const state = service.getState();
            assert.strictEqual(state.gitlab.assigned.length, 2);
            assert.ok(state.gitlab.assigned.every((mr) => mr.projectPath === 'team/frontend'));
        });

        test('project path filtering is case insensitive', async () => {
            await service.saveSettings(
                'gitlab',
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: ['TEAM/FRONTEND'],
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: [],
                        refreshInterval: 5,
                    },
                },
            );
            injectMergeRequests(
                service,
                'gitlab',
                sampleGitlabMergeRequests(),
                [sampleGitlabMergeRequests()[1]],
            );

            const state = service.getState();
            assert.strictEqual(state.gitlab.assigned.length, 2);
        });

        test('hides drafts when showDrafts is false', () => {
            const drafts: MergeRequest[] = [
                { ...sampleGitlabMergeRequests()[0], isDraft: true, id: 'gitlab-999-1' },
            ];
            injectMergeRequests(service, 'gitlab', drafts, []);

            const state = service.getState();
            assert.strictEqual(state.gitlab.assigned.length, 0);
        });

        test('shows drafts when showDrafts is true', async () => {
            await service.saveSettings(
                'gitlab',
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: true,
                        projectPaths: [],
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: true,
                        projectPaths: [],
                        refreshInterval: 5,
                    },
                },
            );
            const drafts: MergeRequest[] = [
                { ...sampleGitlabMergeRequests()[0], isDraft: true, id: 'gitlab-999-1' },
            ];
            injectMergeRequests(service, 'gitlab', drafts, []);

            const state = service.getState();
            assert.strictEqual(state.gitlab.assigned.length, 1);
        });

        test('returns empty when visibility is false', async () => {
            await service.saveSettings(
                'gitlab',
                {
                    visible: false,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: [],
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: [],
                        refreshInterval: 5,
                    },
                },
            );
            injectMergeRequests(
                service,
                'gitlab',
                sampleGitlabMergeRequests(),
                [sampleGitlabMergeRequests()[1]],
            );

            const state = service.getState();
            assert.deepStrictEqual(state.gitlab.assigned, []);
            assert.deepStrictEqual(state.gitlab.reviewRequested, []);
            assert.strictEqual(state.gitlab.workspaceAssigned.length, 2);
        });

        test('workspace scope filters independently from global', async () => {
            await service.saveSettings(
                'gitlab',
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: [],
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: ['team/frontend'],
                        refreshInterval: 5,
                    },
                },
            );
            injectMergeRequests(
                service,
                'gitlab',
                sampleGitlabMergeRequests(),
                [sampleGitlabMergeRequests()[1]],
            );

            const state = service.getState();
            assert.strictEqual(state.gitlab.assigned.length, 2);
            assert.strictEqual(state.gitlab.workspaceAssigned.length, 2);
            assert.strictEqual(state.gitlab.workspaceReviewRequested.length, 1);
        });

        test('non-matching project path returns empty', async () => {
            await service.saveSettings(
                'gitlab',
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: ['other/repo'],
                        refreshInterval: 5,
                    },
                },
                {
                    visible: true,
                    filter: {
                        showAssigned: true,
                        showReviewRequested: true,
                        showDrafts: false,
                        projectPaths: [],
                        refreshInterval: 5,
                    },
                },
            );
            injectMergeRequests(
                service,
                'gitlab',
                sampleGitlabMergeRequests(),
                [sampleGitlabMergeRequests()[1]],
            );

            const state = service.getState();
            assert.deepStrictEqual(state.gitlab.assigned, []);
            assert.deepStrictEqual(state.gitlab.reviewRequested, []);
        });
    });

    suite('reminders', () => {
        setup(() => {
            injectMergeRequests(
                service,
                'gitlab',
                sampleGitlabMergeRequests(),
                [sampleGitlabMergeRequests()[1]],
            );
        });

        test('setReminder stores reminder in state', async () => {
            const time = futureTime(30);
            await service.setReminder('gitlab-101-1', time);
            const state = service.getState();
            assert.strictEqual(state.gitlab.reminders['gitlab-101-1'], time);
        });

        test('setReminder persists to file', async () => {
            const time = futureTime(30);
            await service.setReminder('gitlab-101-1', time);
            const fileData = getGlobalFileData();
            assert.strictEqual(fileData.gitlab.reminders['gitlab-101-1'], time);
        });

        test('clearReminder removes the reminder', async () => {
            await service.setReminder('gitlab-101-1', futureTime(30));
            await service.clearReminder('gitlab-101-1');
            const state = service.getState();
            assert.strictEqual(state.gitlab.reminders['gitlab-101-1'], undefined);
        });

        test('clearReminder persists removal', async () => {
            await service.setReminder('gitlab-101-1', futureTime(30));
            await service.clearReminder('gitlab-101-1');
            const fileData = getGlobalFileData();
            assert.strictEqual(fileData.gitlab.reminders['gitlab-101-1'], undefined);
        });

        test('multiple reminders can coexist', async () => {
            await service.setReminder('gitlab-101-1', futureTime(10));
            await service.setReminder('gitlab-102-1', futureTime(20));
            const state = service.getState();
            assert.ok(state.gitlab.reminders['gitlab-101-1']);
            assert.ok(state.gitlab.reminders['gitlab-102-1']);
        });

        test('setting reminder on same MR overwrites previous', async () => {
            const firstTime = futureTime(10);
            const secondTime = futureTime(60);
            await service.setReminder('gitlab-101-1', firstTime);
            await service.setReminder('gitlab-101-1', secondTime);
            const state = service.getState();
            assert.strictEqual(state.gitlab.reminders['gitlab-101-1'], secondTime);
        });

        test('github reminders are stored separately from gitlab', async () => {
            injectMergeRequests(service, 'github', sampleGithubMergeRequests(), []);
            await service.setReminder('gitlab-101-1', futureTime(10));
            await service.setReminder('github-201-myorg/api', futureTime(20));

            const state = service.getState();
            assert.ok(state.gitlab.reminders['gitlab-101-1']);
            assert.strictEqual(state.gitlab.reminders['github-201-myorg/api'], undefined);
            assert.ok(state.github.reminders['github-201-myorg/api']);
            assert.strictEqual(state.github.reminders['gitlab-101-1'], undefined);
        });
    });

    suite('reminder firing', () => {
        let firedReminders: {
            platform: string;
            mergeRequestId: string;
            title: string;
            url: string;
        }[];

        setup(() => {
            firedReminders = [];
            injectMergeRequests(
                service,
                'gitlab',
                [],
                [sampleGitlabMergeRequests()[1]],
            );
            service.onReminderFired((platform, mergeRequestId, title, url) => {
                firedReminders.push({ platform, mergeRequestId, title, url });
            });
        });

        test('fires callback for past-due reminder', async () => {
            await service.setReminder('gitlab-102-1', pastTime(5));
            (service as any).checkReminders('gitlab');
            assert.strictEqual(firedReminders.length, 1);
            assert.strictEqual(firedReminders[0].platform, 'gitlab');
            assert.strictEqual(firedReminders[0].mergeRequestId, 'gitlab-102-1');
            assert.ok(firedReminders[0].title.includes('!102'));
            assert.ok(firedReminders[0].title.includes('Add user preferences page'));
        });

        test('does not fire for future reminder', async () => {
            await service.setReminder('gitlab-102-1', futureTime(30));
            (service as any).checkReminders('gitlab');
            assert.strictEqual(firedReminders.length, 0);
        });

        test('does not fire if MR not in review list', async () => {
            await service.setReminder('gitlab-999-1', pastTime(5));
            (service as any).checkReminders('gitlab');
            assert.strictEqual(firedReminders.length, 0);
        });

        test('does not re-fire during snooze window', async () => {
            await service.setReminder('gitlab-102-1', pastTime(5));
            (service as any).checkReminders('gitlab');
            (service as any).checkReminders('gitlab');
            assert.strictEqual(firedReminders.length, 1);
        });

        test('does not fire for invalid date string', async () => {
            await service.setReminder('gitlab-102-1', 'not-a-date');
            (service as any).checkReminders('gitlab');
            assert.strictEqual(firedReminders.length, 0);
        });
    });

    suite('dispose', () => {
        test('stops refresh timers for both platforms', () => {
            injectMergeRequests(service, 'gitlab', sampleGitlabMergeRequests(), []);
            injectMergeRequests(service, 'github', sampleGithubMergeRequests(), []);
            (service as any).startRefreshTimer('gitlab');
            (service as any).startRefreshTimer('github');
            assert.ok((service as any).platforms.gitlab.refreshTimer);
            assert.ok((service as any).platforms.github.refreshTimer);

            service.dispose();

            assert.strictEqual((service as any).platforms.gitlab.refreshTimer, undefined);
            assert.strictEqual((service as any).platforms.github.refreshTimer, undefined);
        });

        test('stops reminder timers for both platforms', () => {
            injectMergeRequests(service, 'gitlab', sampleGitlabMergeRequests(), []);
            (service as any).startReminderTimer('gitlab');
            assert.ok((service as any).platforms.gitlab.reminderTimer);

            service.dispose();

            assert.strictEqual((service as any).platforms.gitlab.reminderTimer, undefined);
        });
    });

    suite('platform ID parsing', () => {
        test('routes gitlab reminders to gitlab platform', async () => {
            injectMergeRequests(service, 'gitlab', sampleGitlabMergeRequests(), []);
            await service.setReminder('gitlab-101-1', futureTime(10));
            const state = service.getState();
            assert.ok(state.gitlab.reminders['gitlab-101-1']);
            assert.strictEqual(state.github.reminders['gitlab-101-1'], undefined);
        });

        test('routes github reminders to github platform', async () => {
            injectMergeRequests(service, 'github', sampleGithubMergeRequests(), []);
            await service.setReminder('github-201-myorg/api', futureTime(10));
            const state = service.getState();
            assert.ok(state.github.reminders['github-201-myorg/api']);
            assert.strictEqual(state.gitlab.reminders['github-201-myorg/api'], undefined);
        });

        test('ignores unknown platform prefix', async () => {
            await service.setReminder('bitbucket-1-x', futureTime(10));
            const state = service.getState();
            assert.deepStrictEqual(state.gitlab.reminders, {});
            assert.deepStrictEqual(state.github.reminders, {});
        });
    });
});
