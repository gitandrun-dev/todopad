var jiraConnecting = false;
var jiraWaitingForSave = false;

function initIntegrationPages() {
    var integrationsPage = document.getElementById('pageIntegrations');
    if (
        integrationsPage &&
        !integrationsPage.innerHTML.trim() &&
        typeof TPL_INTEGRATIONS_LIST !== 'undefined'
    ) {
        integrationsPage.innerHTML = TPL_INTEGRATIONS_LIST;
    }
}

function navigateTo(pageId) {
    initIntegrationPages();
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove('active');
    }
    var target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
    }
    if (pageId === 'pageJira') {
        var jiraPage = document.getElementById('pageJira');
        if (jiraPage && typeof TPL_JIRA_SETTINGS !== 'undefined') {
            jiraPage.innerHTML = TPL_JIRA_SETTINGS;
        }
        populateJiraSettings();
        bindScopeToggles();
    }
    if (pageId === 'pageIntegrations') {
        updateIntegrationCards();
    }
    if (pageId === 'pageMain') {
        if (state.jira) {
            renderJiraSection(state.scope);
        }
    }
}

function updateGearBadge() {
    var badge = document.getElementById('gearBadge');
    if (!badge) {
        return;
    }
    if (state.jira && state.jira.needsAttention) {
        badge.classList.add('visible');
    } else {
        badge.classList.remove('visible');
    }
}

function updateIntegrationCards() {
    var jiraStatus = document.getElementById('jiraCardStatus');
    if (jiraStatus && state.jira) {
        jiraStatus.classList.toggle('connected', state.jira.connectionStatus === 'connected');
    }
}

function populateJiraSettings() {
    if (!state.jira) {
        return;
    }

    var jira = state.jira;
    var dot = document.getElementById('jiraConnectionDot');
    var text = document.getElementById('jiraConnectionText');
    var connectionSection = document.getElementById('jiraConnectionSection');
    var disconnectRow = document.getElementById('jiraDisconnectRow');
    var filterSection = document.getElementById('jiraFilterSection');
    var saveSection = document.getElementById('jiraSaveSection');

    if (jira.connectionStatus === 'connected') {
        if (dot) {
            dot.className = 'connection-dot connected';
        }
        if (text) {
            text.innerHTML = 'Connected as <strong>' + escapeHtml(jira.user || '') + '</strong>';
        }
        if (connectionSection) {
            connectionSection.style.display = 'none';
        }
        if (disconnectRow) {
            disconnectRow.style.display = 'flex';
        }
        if (filterSection) {
            filterSection.classList.remove('settings-disabled');
        }
        if (saveSection) {
            saveSection.classList.remove('settings-disabled');
        }
        restoreSettings(jira);
    } else {
        if (dot) {
            dot.className = 'connection-dot';
        }
        if (text) {
            text.textContent = 'Not connected';
        }
        if (connectionSection) {
            connectionSection.style.display = 'block';
        }
        if (disconnectRow) {
            disconnectRow.style.display = 'none';
        }
        if (filterSection) {
            filterSection.classList.add('settings-disabled');
        }
        if (saveSection) {
            saveSection.classList.add('settings-disabled');
        }
    }
}

function restoreSettings(jira) {
    var globalConfig = jira.globalConfig || { visible: true, filter: {} };
    var workspaceConfig = jira.workspaceConfig || { visible: true, filter: {} };
    var globalFilter = globalConfig.filter || {};
    var workspaceFilter = workspaceConfig.filter || {};

    var showGlobalInput = document.getElementById('jiraShowGlobalInput');
    if (showGlobalInput) {
        showGlobalInput.checked = globalConfig.visible !== false;
    }

    var showWorkspaceInput = document.getElementById('jiraShowWorkspaceInput');
    if (showWorkspaceInput) {
        showWorkspaceInput.checked = workspaceConfig.visible !== false;
    }

    var globalStatusInput = document.getElementById('jiraGlobalStatusInput');
    if (globalStatusInput) {
        globalStatusInput.value = (globalFilter.statuses || []).join(', ');
    }

    var globalProjectInput = document.getElementById('jiraGlobalProjectInput');
    if (globalProjectInput) {
        globalProjectInput.value = (globalFilter.projectKeys || []).join(', ');
    }

    var globalJqlInput = document.getElementById('jiraGlobalJqlInput');
    if (globalJqlInput) {
        globalJqlInput.value = globalFilter.customJql || '';
    }

    var workspaceStatusInput = document.getElementById('jiraWorkspaceStatusInput');
    if (workspaceStatusInput) {
        workspaceStatusInput.value = (workspaceFilter.statuses || []).join(', ');
    }

    var workspaceProjectFilterInput = document.getElementById('jiraWorkspaceProjectFilterInput');
    if (workspaceProjectFilterInput) {
        workspaceProjectFilterInput.value = (workspaceFilter.projectKeys || []).join(', ');
    }

    var workspaceJqlInput = document.getElementById('jiraWorkspaceJqlInput');
    if (workspaceJqlInput) {
        workspaceJqlInput.value = workspaceFilter.customJql || '';
    }

    var refreshInput = document.getElementById('jiraRefreshInput');
    if (refreshInput) {
        refreshInput.value = globalFilter.refreshInterval || 5;
    }

    updateScopeFieldsState();
}

function bindScopeToggles() {
    var showGlobalInput = document.getElementById('jiraShowGlobalInput');
    var showWorkspaceInput = document.getElementById('jiraShowWorkspaceInput');

    if (showGlobalInput) {
        showGlobalInput.onchange = updateScopeFieldsState;
    }
    if (showWorkspaceInput) {
        showWorkspaceInput.onchange = updateScopeFieldsState;
    }
}

function updateScopeFieldsState() {
    var showGlobalInput = document.getElementById('jiraShowGlobalInput');
    var showWorkspaceInput = document.getElementById('jiraShowWorkspaceInput');
    var globalFields = document.getElementById('jiraGlobalFields');
    var workspaceFields = document.getElementById('jiraWorkspaceFields');

    if (globalFields && showGlobalInput) {
        globalFields.classList.toggle('disabled', !showGlobalInput.checked);
    }
    if (workspaceFields && showWorkspaceInput) {
        workspaceFields.classList.toggle('disabled', !showWorkspaceInput.checked);
    }
}

function jiraConnect() {
    var url = document.getElementById('jiraUrlInput').value.trim();
    var email = document.getElementById('jiraEmailInput').value.trim();
    var token = document.getElementById('jiraTokenInput').value.trim();

    if (!url || !email || !token) {
        return;
    }

    jiraConnecting = true;
    var spinner = document.getElementById('jiraSpinner');
    var btn = document.getElementById('jiraConnectBtn');
    if (spinner) {
        spinner.classList.add('visible');
    }
    if (btn) {
        btn.textContent = 'Connecting...';
        btn.disabled = true;
    }

    vscode.postMessage({ type: 'jiraConnect', url: url, email: email, token: token });
}

function jiraDisconnect() {
    vscode.postMessage({ type: 'jiraDisconnect' });
}

function handleJiraConnectionResult() {
    jiraConnecting = false;
    var spinner = document.getElementById('jiraSpinner');
    var btn = document.getElementById('jiraConnectBtn');
    if (spinner) {
        spinner.classList.remove('visible');
    }
    if (btn) {
        btn.textContent = 'Connect';
        btn.disabled = false;
    }
    document.getElementById('jiraTokenInput').value = '';
}

function showJiraConnectionError(error) {
    var text = document.getElementById('jiraConnectionText');
    if (text) {
        text.innerHTML =
            '<span style="color: var(--red)">' +
            escapeHtml(error || 'Connection failed') +
            '</span>';
    }
}

function toggleJiraAdvanced(btn, contentId) {
    btn.classList.toggle('open');
    var content = document.getElementById(contentId);
    if (content) {
        content.classList.toggle('open');
    }
}

function parseCommaSeparated(value) {
    if (!value || !value.trim()) {
        return [];
    }
    return value
        .split(',')
        .map(function (s) {
            return s.trim();
        })
        .filter(function (s) {
            return s.length > 0;
        });
}

function saveJiraSettings() {
    var showGlobalInput = document.getElementById('jiraShowGlobalInput');
    var showWorkspaceInput = document.getElementById('jiraShowWorkspaceInput');
    var refreshInterval = parseInt(document.getElementById('jiraRefreshInput').value, 10) || 5;

    var globalConfig = {
        visible: showGlobalInput ? showGlobalInput.checked : true,
        filter: {
            statuses: parseCommaSeparated(document.getElementById('jiraGlobalStatusInput').value),
            projectKeys: parseCommaSeparated(
                document.getElementById('jiraGlobalProjectInput').value,
            ).map(function (k) {
                return k.toUpperCase();
            }),
            customJql: document.getElementById('jiraGlobalJqlInput').value.trim() || null,
            refreshInterval: refreshInterval,
        },
    };

    var workspaceConfig = {
        visible: showWorkspaceInput ? showWorkspaceInput.checked : true,
        filter: {
            statuses: parseCommaSeparated(
                document.getElementById('jiraWorkspaceStatusInput').value,
            ),
            projectKeys: parseCommaSeparated(
                document.getElementById('jiraWorkspaceProjectFilterInput').value,
            ).map(function (k) {
                return k.toUpperCase();
            }),
            customJql: document.getElementById('jiraWorkspaceJqlInput').value.trim() || null,
            refreshInterval: refreshInterval,
        },
    };

    jiraWaitingForSave = true;
    vscode.postMessage({
        type: 'jiraSaveSettings',
        globalConfig: globalConfig,
        workspaceConfig: workspaceConfig,
    });
}

function resetJiraSettings() {
    var inputs = [
        'jiraGlobalStatusInput',
        'jiraGlobalProjectInput',
        'jiraGlobalJqlInput',
        'jiraWorkspaceStatusInput',
        'jiraWorkspaceProjectFilterInput',
        'jiraWorkspaceJqlInput',
    ];
    for (var i = 0; i < inputs.length; i++) {
        var el = document.getElementById(inputs[i]);
        if (el) {
            el.value = '';
        }
    }

    var refreshInput = document.getElementById('jiraRefreshInput');
    if (refreshInput) {
        refreshInput.value = '5';
    }

    var showGlobalInput = document.getElementById('jiraShowGlobalInput');
    if (showGlobalInput) {
        showGlobalInput.checked = true;
    }

    var showWorkspaceInput = document.getElementById('jiraShowWorkspaceInput');
    if (showWorkspaceInput) {
        showWorkspaceInput.checked = true;
    }

    updateScopeFieldsState();
    saveJiraSettings();
}
