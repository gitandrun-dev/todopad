var mrCollapsed = false;

function renderMergeRequestSection(scope) {
    var container = document.getElementById('mrSection');
    if (!container) {
        return;
    }

    var gitState = state.git;
    if (!gitState) {
        container.innerHTML = '';
        return;
    }

    var gitlab = gitState.gitlab;
    var github = gitState.github;
    var gitlabConnected = gitlab && gitlab.connectionStatus === 'connected';
    var githubConnected = github && github.connectionStatus === 'connected';

    if (!gitlabConnected && !githubConnected) {
        container.innerHTML = '';
        return;
    }

    var gitlabVisible = gitlabConnected && isScopeVisible(gitlab, scope);
    var githubVisible = githubConnected && isScopeVisible(github, scope);

    if (!gitlabVisible && !githubVisible) {
        container.innerHTML = '';
        return;
    }

    var reviewRequested = getMergeRequestsForScope(scope, 'reviewRequested');
    var assigned = getMergeRequestsForScope(scope, 'assigned');

    if ((gitlab && gitlab.loading) || (github && github.loading)) {
        if (reviewRequested.length === 0 && assigned.length === 0) {
            container.innerHTML = `
                <div class="mr-section">
                    <div class="mr-section-header">
                        <span class="mr-icon">${ICON_GIT_MERGE}</span>
                        <span class="mr-label">Merge Requests</span>
                        <span class="mr-loading-spinner"></span>
                    </div>
                </div>`;
            return;
        }
    }

    var total = reviewRequested.length + assigned.length;

    if (total === 0) {
        var hasError = (gitlab && gitlab.lastError) || (github && github.lastError);
        var message = hasError
            ? 'Could not fetch merge requests. Check your connection.'
            : 'No open merge requests';
        container.innerHTML = `
            <div class="mr-section">
                <div class="mr-section-header" onclick="toggleMergeRequestSection()">
                    <span class="mr-arrow open">&#9654;</span>
                    <span class="mr-icon">${ICON_GIT_MERGE}</span>
                    <span class="mr-label">Merge Requests</span>
                    <span class="mr-count">0</span>
                </div>
                <div style="padding: 8px 12px; font-size: 11px; color: var(--text-3);">
                    ${escapeHtml(message)}
                </div>
            </div>`;
        return;
    }

    var arrowClass = mrCollapsed ? 'mr-arrow' : 'mr-arrow open';
    var itemsClass = mrCollapsed ? 'mr-items collapsed' : 'mr-items';

    var itemsHtml = '';

    if (reviewRequested.length > 0) {
        itemsHtml += '<div class="mr-group-label">Review Requested</div>';
        for (var i = 0; i < reviewRequested.length; i++) {
            itemsHtml += renderMergeRequestItem(reviewRequested[i], true);
        }
    }

    if (assigned.length > 0) {
        itemsHtml += '<div class="mr-group-label">Assigned to Me</div>';
        for (var j = 0; j < assigned.length; j++) {
            itemsHtml += renderMergeRequestItem(assigned[j], false);
        }
    }

    container.innerHTML = `
        <div class="mr-section">
            <div class="mr-section-header" onclick="toggleMergeRequestSection()">
                <span class="${arrowClass}">&#9654;</span>
                <span class="mr-icon">${ICON_GIT_MERGE}</span>
                <span class="mr-label">Merge Requests</span>
                <span class="mr-count">${total}</span>
            </div>
            <ul class="${itemsClass}" id="mrItems">${itemsHtml}</ul>
        </div>`;
}

function getMergeRequestsForScope(scope, category) {
    var gitState = state.git;
    if (!gitState) {
        return [];
    }

    var results = [];
    var platforms = [gitState.gitlab, gitState.github];

    for (var i = 0; i < platforms.length; i++) {
        var platform = platforms[i];
        if (!platform || platform.connectionStatus !== 'connected') {
            continue;
        }
        var items =
            scope === 'workspace'
                ? category === 'reviewRequested'
                    ? platform.workspaceReviewRequested
                    : platform.workspaceAssigned
                : category === 'reviewRequested'
                  ? platform.reviewRequested
                  : platform.assigned;
        if (items) {
            results = results.concat(items);
        }
    }

    return results;
}

function renderMergeRequestItem(mergeRequest, showReminder) {
    var platformIcon = mergeRequest.platform === 'gitlab' ? ICON_GITLAB_SM : ICON_GITHUB_SM;
    var platformClass = mergeRequest.platform === 'gitlab' ? 'gitlab' : 'github';
    var numberPrefix = mergeRequest.platform === 'gitlab' ? '!' : '#';
    var badge = getMergeRequestBadge(mergeRequest, showReminder);
    var escapedUrl = escapeHtml(mergeRequest.url);
    var escapedId = escapeHtml(mergeRequest.id);

    var reminderHtml = '';
    var itemClass = 'mr-item';
    if (showReminder) {
        var allReminders = getMergeRequestReminders();
        var reminderAt = allReminders[mergeRequest.id] || null;
        var reminderIsDue = reminderAt && new Date(reminderAt).getTime() <= Date.now();
        var bellClass = reminderIsDue
            ? 'mr-item-bell reminder-due'
            : reminderAt
              ? 'mr-item-bell has-reminder'
              : 'mr-item-bell';
        var bellIcon = reminderAt ? ICON_BELL_RING : ICON_BELL_SM;

        if (reminderIsDue) {
            itemClass = 'mr-item alarming';
        }

        reminderHtml = `<span class="${bellClass}" onclick="event.stopPropagation();openMergeRequestReminderPicker('${escapedId}','${escapeHtml(reminderAt || '')}')">${bellIcon}</span>`;
    }

    return `
        <li class="${itemClass}" onclick="openMergeRequest('${escapedUrl}')">
            <span class="mr-item-platform ${platformClass}">${platformIcon}</span>
            <span class="mr-item-number">${escapeHtml(numberPrefix + mergeRequest.number)}</span>
            <span class="mr-item-title">${escapeHtml(mergeRequest.title)}</span>
            ${badge}
            ${reminderHtml}
        </li>`;
}

function getMergeRequestBadge(mergeRequest, isReviewItem) {
    if (mergeRequest.isDraft) {
        return '<span class="mr-item-badge draft">Draft</span>';
    }

    if (isReviewItem) {
        return '<span class="mr-item-badge review-pending">Review</span>';
    }

    var approval = mergeRequest.approval;
    if (approval && approval.required > 0) {
        var given = parseInt(approval.given, 10) || 0;
        var required = parseInt(approval.required, 10) || 0;
        if (given >= required) {
            return '<span class="mr-item-badge review-approved">Approved \u2713</span>';
        }
        if (given > 0) {
            return (
                '<span class="mr-item-badge approval-partial">' +
                given +
                '/' +
                required +
                ' Approved</span>'
            );
        }
        return (
            '<span class="mr-item-badge approval-pending">' +
            given +
            '/' +
            required +
            ' Approved</span>'
        );
    }

    return '<span class="mr-item-badge assigned">Open</span>';
}

function getMergeRequestReminders() {
    var reminders = {};
    var gitState = state.git;
    if (!gitState) {
        return reminders;
    }
    if (gitState.gitlab && gitState.gitlab.reminders) {
        Object.assign(reminders, gitState.gitlab.reminders);
    }
    if (gitState.github && gitState.github.reminders) {
        Object.assign(reminders, gitState.github.reminders);
    }
    return reminders;
}

function toggleMergeRequestSection() {
    mrCollapsed = !mrCollapsed;
    var items = document.getElementById('mrItems');
    var arrow = document.querySelector('.mr-arrow');
    if (items) {
        items.classList.toggle('collapsed', mrCollapsed);
    }
    if (arrow) {
        arrow.classList.toggle('open', !mrCollapsed);
    }
}

function openMergeRequest(url) {
    vscode.postMessage({ type: 'gitOpenMergeRequest', url: url });
}

function openMergeRequestReminderPicker(mergeRequestId, current) {
    dp.scope = 'git';
    dp.id = mergeRequestId;

    var hasValidCurrent = current && !isNaN(new Date(current).getTime());
    var ref = hasValidCurrent ? new Date(current) : new Date(Date.now() + 60 * 60 * 1000);

    dp.year = ref.getFullYear();
    dp.month = ref.getMonth();
    dp.selectedDate = ref.getDate();

    var hours = hasValidCurrent ? new Date(current).getHours() : ref.getHours();
    var minutes = hasValidCurrent ? new Date(current).getMinutes() : ref.getMinutes();
    var h12 = hours % 12 || 12;
    var ampm = hours >= 12 ? 'PM' : 'AM';

    var removeButton = hasValidCurrent
        ? '<button class="m-btn cancel" onclick="clearMergeRequestReminder(\'' +
          escapeHtml(mergeRequestId) +
          '\');closeEdit()" style="margin-right:auto;color:var(--red);border-color:rgba(255,69,58,0.3)">Remove</button>'
        : '';

    showModal(
        fillTemplate(TPL_REMINDER_PICKER, {
            bellIconLg: ICON_BELL_LG,
            clockIcon: ICON_CLOCK,
            hour: String(h12).padStart(2, '0'),
            minute: String(minutes).padStart(2, '0'),
            amSelected: ampm === 'AM' ? ' selected' : '',
            pmSelected: ampm === 'PM' ? ' selected' : '',
            removeButton: removeButton,
        }),
    );

    dpRenderCal();
}

function clearMergeRequestReminder(mergeRequestId) {
    vscode.postMessage({ type: 'gitClearReminder', mergeRequestId: mergeRequestId });
}

function isScopeVisible(platformState, scope) {
    if (!platformState) {
        return false;
    }
    var config = scope === 'workspace' ? platformState.workspaceConfig : platformState.globalConfig;
    return config && config.visible !== false;
}
