var gitConnecting = null;
var gitDisconnecting = null;
var gitWaitingForSave = false;

function navigateToGitSettings(platform) {
    var pageId = platform === 'gitlab' ? 'pageGitlab' : 'pageGithub';
    var page = document.getElementById(pageId);
    if (page && typeof TPL_GIT_SETTINGS !== 'undefined') {
        page.innerHTML = TPL_GIT_SETTINGS;
    }
    navigateTo(pageId);
    populateGitSettings(platform);
}

function populateGitSettings(platform) {
    if (!state.git) {
        return;
    }

    var platformState = state.git[platform];
    if (!platformState) {
        return;
    }

    var pageId = platform === 'gitlab' ? 'pageGitlab' : 'pageGithub';
    var page = document.getElementById(pageId);
    if (!page) {
        return;
    }

    var title = page.querySelector('.git-settings-title');
    if (title) {
        title.textContent = platform === 'gitlab' ? 'GitLab' : 'GitHub';
    }

    var dot = page.querySelector('.connection-status .connection-dot');
    var text = page.querySelector('.connection-status .connection-text');
    var connectionSection = page.querySelector('.git-connection-section');
    var disconnectRow = page.querySelector('.git-disconnect-row');
    var filterSection = page.querySelector('.git-filter-section');
    var saveSection = page.querySelector('.git-save-section');

    var urlInput = page.querySelector('.git-url-input');
    var tokenInput = page.querySelector('.git-token-input');
    var urlHint = page.querySelector('.git-url-hint');
    var urlField = urlInput ? urlInput.closest('.settings-field') : null;

    if (platform === 'github') {
        if (urlField) {
            urlField.style.display = 'none';
        }
        if (urlInput) {
            urlInput.value = 'https://github.com';
        }
    } else {
        if (urlField) {
            urlField.style.display = '';
        }
        if (urlInput) {
            urlInput.placeholder = 'https://gitlab.com';
        }
        if (urlHint) {
            urlHint.textContent = 'Your GitLab instance URL. Use https://gitlab.com for cloud.';
        }
    }
    if (tokenInput) {
        tokenInput.placeholder =
            platform === 'gitlab' ? 'glpat-xxxxxxxxxxxxxxxxxxxx' : 'ghp_xxxxxxxxxxxxxxxxxxxx';
    }

    var tokenHintLink = page.querySelector('.git-token-hint');
    if (tokenHintLink) {
        tokenHintLink.innerHTML =
            platform === 'gitlab'
                ? 'Needs <code>read_api</code> scope. Generate under Access Tokens in your GitLab user settings.'
                : 'Generate at GitHub &rarr; Settings &rarr; Developer settings &rarr; Personal access tokens.';
    }

    if (platformState.connectionStatus === 'connected') {
        if (dot) {
            dot.classList.add('connected');
        }
        if (text) {
            text.innerHTML =
                'Connected as <strong>' + escapeHtml(platformState.user || '') + '</strong>';
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
        restoreGitSettings(page, platformState);
    } else {
        if (dot) {
            dot.classList.remove('connected');
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

    page.setAttribute('data-platform', platform);
}

function restoreGitSettings(page, platformState) {
    var globalConfig = platformState.globalConfig || { visible: true, filter: {} };
    var workspaceConfig = platformState.workspaceConfig || { visible: true, filter: {} };
    var globalFilter = globalConfig.filter || {};
    var workspaceFilter = workspaceConfig.filter || {};

    var showAssignedInput = page.querySelector('.git-show-assigned');
    if (showAssignedInput) {
        showAssignedInput.checked = globalFilter.showAssigned !== false;
    }

    var showReviewInput = page.querySelector('.git-show-review');
    if (showReviewInput) {
        showReviewInput.checked = globalFilter.showReviewRequested !== false;
    }

    var showDraftsInput = page.querySelector('.git-show-drafts');
    if (showDraftsInput) {
        showDraftsInput.checked = globalFilter.showDrafts === true;
    }

    var showGlobalInput = page.querySelector('.git-show-global');
    if (showGlobalInput) {
        showGlobalInput.checked = globalConfig.visible !== false;
    }

    var globalProjectsInput = page.querySelector('.git-global-projects');
    if (globalProjectsInput) {
        globalProjectsInput.value = (globalFilter.projectPaths || []).join(', ');
    }

    var showWorkspaceInput = page.querySelector('.git-show-workspace');
    if (showWorkspaceInput) {
        showWorkspaceInput.checked = workspaceConfig.visible !== false;
    }

    var workspaceProjectsInput = page.querySelector('.git-workspace-projects');
    if (workspaceProjectsInput) {
        workspaceProjectsInput.value = (workspaceFilter.projectPaths || []).join(', ');
    }

    var refreshInput = page.querySelector('.git-refresh-interval');
    if (refreshInput) {
        refreshInput.value = globalFilter.refreshInterval || 5;
    }
}

function gitConnect(platform) {
    var pageId = platform === 'gitlab' ? 'pageGitlab' : 'pageGithub';
    var page = document.getElementById(pageId);
    if (!page) {
        return;
    }

    var url =
        platform === 'github'
            ? 'https://github.com'
            : page.querySelector('.git-url-input').value.trim();
    var token = page.querySelector('.git-token-input').value.trim();

    if (!url || !token) {
        return;
    }

    gitConnecting = platform;
    var spinner = page.querySelector('.git-spinner');
    var btn = page.querySelector('.git-connect-btn');
    if (spinner) {
        spinner.classList.add('visible');
    }
    if (btn) {
        btn.textContent = 'Connecting...';
        btn.disabled = true;
    }

    vscode.postMessage({ type: 'gitConnect', platform: platform, url: url, token: token });
}

function gitDisconnect(platform) {
    gitDisconnecting = platform;
    vscode.postMessage({ type: 'gitDisconnect', platform: platform });
}

function handleGitConnectionResult(platform) {
    gitConnecting = null;
    var pageId = platform === 'gitlab' ? 'pageGitlab' : 'pageGithub';
    var page = document.getElementById(pageId);
    if (!page) {
        return;
    }

    var spinner = page.querySelector('.git-spinner');
    var btn = page.querySelector('.git-connect-btn');
    if (spinner) {
        spinner.classList.remove('visible');
    }
    if (btn) {
        btn.textContent = 'Connect';
        btn.disabled = false;
    }
    var tokenInput = page.querySelector('.git-token-input');
    if (tokenInput) {
        tokenInput.value = '';
    }
}

function showGitConnectionError(platform, error) {
    var pageId = platform === 'gitlab' ? 'pageGitlab' : 'pageGithub';
    var page = document.getElementById(pageId);
    if (!page) {
        return;
    }

    var text = page.querySelector('.connection-status .connection-text');
    if (text) {
        text.innerHTML =
            '<span style="color: var(--red)">' +
            escapeHtml(error || 'Connection failed') +
            '</span>';
    }
}

function saveGitSettings(platform) {
    var pageId = platform === 'gitlab' ? 'pageGitlab' : 'pageGithub';
    var page = document.getElementById(pageId);
    if (!page) {
        return;
    }

    var saveBtn = page.querySelector('.git-save-btn');
    if (saveBtn) {
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
    }

    var showAssigned = page.querySelector('.git-show-assigned');
    var showReview = page.querySelector('.git-show-review');
    var showDrafts = page.querySelector('.git-show-drafts');
    var showGlobal = page.querySelector('.git-show-global');
    var globalProjects = page.querySelector('.git-global-projects');
    var showWorkspace = page.querySelector('.git-show-workspace');
    var workspaceProjects = page.querySelector('.git-workspace-projects');
    var refreshInterval = page.querySelector('.git-refresh-interval');

    var refreshValue = parseInt(refreshInterval ? refreshInterval.value : '5', 10) || 5;

    var globalConfig = {
        visible: showGlobal ? showGlobal.checked : true,
        filter: {
            showAssigned: showAssigned ? showAssigned.checked : true,
            showReviewRequested: showReview ? showReview.checked : true,
            showDrafts: showDrafts ? showDrafts.checked : false,
            projectPaths: parseCommaSeparated(globalProjects ? globalProjects.value : ''),
            refreshInterval: refreshValue,
        },
    };

    var workspaceConfig = {
        visible: showWorkspace ? showWorkspace.checked : true,
        filter: {
            showAssigned: showAssigned ? showAssigned.checked : true,
            showReviewRequested: showReview ? showReview.checked : true,
            showDrafts: showDrafts ? showDrafts.checked : false,
            projectPaths: parseCommaSeparated(workspaceProjects ? workspaceProjects.value : ''),
            refreshInterval: refreshValue,
        },
    };

    gitWaitingForSave = true;
    vscode.postMessage({
        type: 'gitSaveSettings',
        platform: platform,
        globalConfig: globalConfig,
        workspaceConfig: workspaceConfig,
    });
}

function updateGitIntegrationCards() {
    if (!state.git) {
        return;
    }

    var gitlabStatus = document.getElementById('gitlabCardStatus');
    if (gitlabStatus && state.git.gitlab) {
        gitlabStatus.classList.toggle(
            'connected',
            state.git.gitlab.connectionStatus === 'connected',
        );
    }

    var githubStatus = document.getElementById('githubCardStatus');
    if (githubStatus && state.git.github) {
        githubStatus.classList.toggle(
            'connected',
            state.git.github.connectionStatus === 'connected',
        );
    }
}
