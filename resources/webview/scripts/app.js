const vscode = acquireVsCodeApi();

const state = {
    data: { global: [], workspace: [] },
    scope: 'global',
    editingId: null,
    editingScope: null,
    dragItemId: null,
    dragItemScope: null,
    jira: null,
};

function setScope(newScope) {
    state.scope = newScope;
    updateScopeBtns();
    render();
    renderJiraSection(state.scope);
}

function updateScopeBtns() {
    var globalCount = (state.data.global || []).filter((t) => !t.done).length;
    var workspaceCount = (state.data.workspace || []).filter((t) => !t.done).length;
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
            needsAttention: e.data.needsAttention,
            loading: e.data.loading,
            lastError: e.data.lastError,
        };
        renderJiraSection(state.scope);
        updateGearBadge();
        if (jiraConnecting) {
            handleJiraConnectionResult();
            if (state.jira.connectionStatus === 'connected') {
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
});
