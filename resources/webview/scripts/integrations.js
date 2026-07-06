var jiraConnecting = false;
var jiraWaitingForSave = false;
var integrationsInitialized = false;

function initIntegrationPages() {
    if (integrationsInitialized) {
        return;
    }
    var integrationsPage = document.getElementById('pageIntegrations');
    var jiraPage = document.getElementById('pageJira');
    if (integrationsPage && typeof TPL_INTEGRATIONS_LIST !== 'undefined') {
        integrationsPage.innerHTML = TPL_INTEGRATIONS_LIST;
    }
    if (jiraPage && typeof TPL_JIRA_SETTINGS !== 'undefined') {
        jiraPage.innerHTML = TPL_JIRA_SETTINGS;
    }
    integrationsInitialized = true;
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
        populateJiraSettings();
    }
    if (pageId === 'pageIntegrations') {
        updateIntegrationCards();
    }
    if (pageId === 'pageMain') {
        if (state.jira) {
            renderJiraSection(state.jira.tickets);
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
    var connectBtn = document.getElementById('jiraConnectBtn');
    var disconnectBtn = document.getElementById('jiraDisconnectBtn');
    var filterSection = document.getElementById('jiraFilterSection');
    var advancedSection = document.getElementById('jiraAdvancedSection');
    var saveSection = document.getElementById('jiraSaveSection');

    if (jira.connectionStatus === 'connected') {
        if (dot) {
            dot.className = 'connection-dot connected';
        }
        if (text) {
            text.innerHTML = 'Connected as <strong>' + escapeHtml(jira.user || '') + '</strong>';
        }
        if (connectBtn) {
            connectBtn.style.display = 'none';
        }
        if (disconnectBtn) {
            disconnectBtn.style.display = 'block';
        }
        if (filterSection) {
            filterSection.classList.remove('settings-disabled');
        }
        if (advancedSection) {
            advancedSection.classList.remove('settings-disabled');
        }
        if (saveSection) {
            saveSection.classList.remove('settings-disabled');
        }
        restoreFilterState(jira.filter);
    } else {
        if (dot) {
            dot.className = 'connection-dot';
        }
        if (text) {
            text.textContent = 'Not connected';
        }
        if (connectBtn) {
            connectBtn.style.display = 'block';
        }
        if (disconnectBtn) {
            disconnectBtn.style.display = 'none';
        }
        if (filterSection) {
            filterSection.classList.add('settings-disabled');
        }
        if (advancedSection) {
            advancedSection.classList.add('settings-disabled');
        }
        if (saveSection) {
            saveSection.classList.add('settings-disabled');
        }
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

function restoreFilterState(filter) {
    if (!filter) {
        return;
    }

    var statusInput = document.getElementById('jiraStatusInput');
    if (statusInput) {
        statusInput.value = (filter.statuses || []).join(', ');
    }

    var projectInput = document.getElementById('jiraProjectInput');
    if (projectInput) {
        projectInput.value = filter.projectKeys.join(', ');
    }

    var jqlInput = document.getElementById('jiraJqlInput');
    if (jqlInput && filter.customJql) {
        jqlInput.value = filter.customJql;
    }
}

function toggleJiraAdvanced(btn) {
    btn.classList.toggle('open');
    var content = document.getElementById('jiraAdvancedContent');
    if (content) {
        content.classList.toggle('open');
    }
}

function saveJiraFilter() {
    var jqlInput = document.getElementById('jiraJqlInput');
    var customJql = jqlInput ? jqlInput.value.trim() : '';

    var statusInput = document.getElementById('jiraStatusInput');
    var statuses = [];
    if (statusInput && statusInput.value.trim()) {
        statuses = statusInput.value
            .split(',')
            .map(function (s) {
                return s.trim();
            })
            .filter(function (s) {
                return s.length > 0;
            });
    }

    var projectInput = document.getElementById('jiraProjectInput');
    var projectKeys = [];
    if (projectInput && projectInput.value.trim()) {
        projectKeys = projectInput.value
            .split(',')
            .map(function (k) {
                return k.trim().toUpperCase();
            })
            .filter(function (k) {
                return k.length > 0;
            });
    }

    var config = {
        statuses: statuses,
        projectKeys: projectKeys,
        customJql: customJql || null,
    };

    jiraWaitingForSave = true;
    vscode.postMessage({ type: 'jiraSaveFilter', config: config });
}

function resetJiraFilter() {
    var statusInput = document.getElementById('jiraStatusInput');
    if (statusInput) {
        statusInput.value = '';
    }

    var projectInput = document.getElementById('jiraProjectInput');
    if (projectInput) {
        projectInput.value = '';
    }

    var jqlInput = document.getElementById('jiraJqlInput');
    if (jqlInput) {
        jqlInput.value = '';
    }

    saveJiraFilter();
}
