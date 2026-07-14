const vscode = acquireVsCodeApi();

const state = {
    data: { global: [], workspace: [] },
    scope: 'global',
    editingId: null,
    editingScope: null,
    dragItemId: null,
    dragItemScope: null,
    jira: null,
    git: null,
};

function setScope(newScope) {
    state.scope = newScope;
    updateScopeBtns();
    render();
    renderJiraSection(state.scope);
    renderMergeRequestSection(state.scope);
}

function countJiraForScope(scope) {
    if (!state.jira || state.jira.connectionStatus !== 'connected') {
        return 0;
    }
    var scopeConfig = scope === 'workspace' ? state.jira.workspaceConfig : state.jira.globalConfig;
    if (scopeConfig && scopeConfig.visible === false) {
        return 0;
    }
    if (
        scope === 'workspace' &&
        scopeConfig &&
        scopeConfig.filter.projectKeys.length === 0 &&
        !scopeConfig.filter.customJql
    ) {
        return 0;
    }
    var tickets = scope === 'workspace' ? state.jira.workspaceTickets : state.jira.tickets;
    return (tickets || []).length;
}

function countMergeRequestsForScope(scope) {
    var gitState = state.git;
    if (!gitState) {
        return 0;
    }
    var gitlab = gitState.gitlab;
    var github = gitState.github;
    var gitlabVisible =
        gitlab && gitlab.connectionStatus === 'connected' && isScopeVisible(gitlab, scope);
    var githubVisible =
        github && github.connectionStatus === 'connected' && isScopeVisible(github, scope);

    if (!gitlabVisible && !githubVisible) {
        return 0;
    }

    if (scope === 'workspace') {
        var hasWorkspaceFilter = false;
        if (
            gitlabVisible &&
            gitlab.workspaceConfig &&
            gitlab.workspaceConfig.filter.projectPaths.length > 0
        ) {
            hasWorkspaceFilter = true;
        }
        if (
            githubVisible &&
            github.workspaceConfig &&
            github.workspaceConfig.filter.projectPaths.length > 0
        ) {
            hasWorkspaceFilter = true;
        }
        if (!hasWorkspaceFilter) {
            return 0;
        }
    }

    return (
        getMergeRequestsForScope(scope, 'reviewRequested').length +
        getMergeRequestsForScope(scope, 'assigned').length
    );
}

function updateScopeBtns() {
    var globalCount =
        (state.data.global || []).filter((t) => !t.done).length +
        countJiraForScope('global') +
        countMergeRequestsForScope('global');
    var workspaceCount =
        (state.data.workspace || []).filter((t) => !t.done).length +
        countJiraForScope('workspace') +
        countMergeRequestsForScope('workspace');

    document.getElementById('scopeGlobal').innerHTML =
        'Global' + (globalCount ? ' <span class="seg-badge">' + globalCount + '</span>' : '');
    document.getElementById('scopeWorkspace').innerHTML =
        'Workspace' +
        (workspaceCount ? ' <span class="seg-badge">' + workspaceCount + '</span>' : '');
    document.getElementById('scopeGlobal').className =
        'seg-btn' + (state.scope === 'global' ? ' active' : '');
    document.getElementById('scopeWorkspace').className =
        'seg-btn' + (state.scope === 'workspace' ? ' active' : '');
}

document.getElementById('taskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        var value = e.target.value.trim();
        if (value) {
            vscode.postMessage({ type: 'quickAdd', title: value, scope: state.scope });
            e.target.value = '';
            updateAddBtn();
        }
    }
});
document.getElementById('taskInput').addEventListener('input', updateAddBtn);

function updateAddBtn() {
    document
        .getElementById('addBtn')
        .classList.toggle('visible', document.getElementById('taskInput').value.trim().length > 0);
}

function submitTask() {
    var input = document.getElementById('taskInput');
    var value = input.value.trim();
    if (value) {
        vscode.postMessage({ type: 'quickAdd', title: value, scope: state.scope });
        input.value = '';
        updateAddBtn();
        input.focus();
    }
}

window.addEventListener('message', (e) => {
    if (e.data.type === 'update') {
        state.data = e.data.data;
        renderCodeTodos(e.data.data.codeTodos || []);
        render();
    }
    if (e.data.type === 'jiraUpdate') {
        state.jira = {
            connectionStatus: e.data.connectionStatus,
            user: e.data.user,
            tickets: e.data.tickets,
            workspaceTickets: e.data.workspaceTickets,
            globalConfig: e.data.globalConfig,
            workspaceConfig: e.data.workspaceConfig,
            reminders: e.data.reminders,
            collapsedGroups: e.data.collapsedGroups,
            needsAttention: e.data.needsAttention,
            loading: e.data.loading,
            lastError: e.data.lastError,
        };
        renderJiraSection(state.scope);
        updateGearBadge();
        updateScopeBtns();
        if (jiraConnecting) {
            if (state.jira.connectionStatus === 'connected') {
                handleJiraConnectionResult();
                populateJiraSettings();
            }
        }
        if (jiraDisconnecting) {
            if (state.jira.connectionStatus === 'disconnected') {
                jiraDisconnecting = false;
                populateJiraSettings();
            }
        }
        if (jiraWaitingForSave) {
            jiraWaitingForSave = false;
            navigateTo('pageMain');
        }
    }
    if (e.data.type === 'jiraError') {
        if (jiraConnecting) {
            handleJiraConnectionResult();
            showJiraConnectionError(e.data.error);
        }
    }
    if (e.data.type === 'gitUpdate') {
        state.git = {
            gitlab: e.data.gitlab,
            github: e.data.github,
        };
        renderMergeRequestSection(state.scope);
        updateGearBadge();
        updateGitIntegrationCards();
        updateScopeBtns();
        if (gitConnecting) {
            var platform = gitConnecting;
            var platformState = state.git[platform];
            if (platformState && platformState.connectionStatus === 'connected') {
                handleGitConnectionResult(platform);
                populateGitSettings(platform);
            }
        }
        if (gitDisconnecting) {
            var disconnectedPlatform = gitDisconnecting;
            var disconnectedState = state.git[disconnectedPlatform];
            if (disconnectedState && disconnectedState.connectionStatus === 'disconnected') {
                gitDisconnecting = null;
                populateGitSettings(disconnectedPlatform);
            }
        }
        if (gitWaitingForSave) {
            gitWaitingForSave = false;
            navigateTo('pageMain');
        }
    }
    if (e.data.type === 'gitError') {
        if (gitConnecting) {
            var errorPlatform = gitConnecting;
            handleGitConnectionResult(errorPlatform);
            showGitConnectionError(errorPlatform, e.data.error);
        }
    }
});
