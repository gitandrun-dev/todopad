var jiraCollapsed = false;

function getJiraGroupBy(scope) {
    if (!state.jira) {
        return 'none';
    }
    var scopeConfig = scope === 'workspace' ? state.jira.workspaceConfig : state.jira.globalConfig;
    return (scopeConfig && scopeConfig.filter && scopeConfig.filter.groupBy) || 'none';
}

function getJiraCollapsedGroups(scope) {
    if (!state.jira || !state.jira.collapsedGroups) {
        return {};
    }
    return state.jira.collapsedGroups[scope] || {};
}

function isJiraGroupCollapsed(scope, groupBy, groupName) {
    var collapsed = getJiraCollapsedGroups(scope);
    var list = collapsed[groupBy] || [];
    return list.indexOf(groupName) !== -1;
}

function toggleJiraGroup(scope, groupBy, groupName) {
    var collapsed = isJiraGroupCollapsed(scope, groupBy, groupName);
    var newCollapsed = !collapsed;
    vscode.postMessage({
        type: 'jiraToggleGroup',
        scope: scope,
        groupBy: groupBy,
        groupName: groupName,
        collapsed: newCollapsed,
    });

    if (!state.jira.collapsedGroups) {
        state.jira.collapsedGroups = { global: {}, workspace: {} };
    }
    if (!state.jira.collapsedGroups[scope]) {
        state.jira.collapsedGroups[scope] = {};
    }
    if (!state.jira.collapsedGroups[scope][groupBy]) {
        state.jira.collapsedGroups[scope][groupBy] = [];
    }
    var list = state.jira.collapsedGroups[scope][groupBy];
    var index = list.indexOf(groupName);
    if (newCollapsed && index === -1) {
        list.push(groupName);
    } else if (!newCollapsed && index !== -1) {
        list.splice(index, 1);
    }

    renderJiraSection(scope);
}

function groupJiraTickets(tickets, groupBy) {
    var groups = {};
    var meta = {};

    for (var i = 0; i < tickets.length; i++) {
        var t = tickets[i];
        var key;
        switch (groupBy) {
            case 'issueType':
                key = t.issueType || 'Unknown';
                break;
            case 'project':
                key = t.projectKey || 'Unknown';
                break;
            case 'priority':
                key = t.priority || 'None';
                break;
            case 'parent':
                if (t.parentKey) {
                    key = t.parentKey;
                    if (!meta[key]) {
                        meta[key] = { summary: t.parentSummary || '', type: t.parentType || '' };
                    }
                } else {
                    key = '__ungrouped__';
                }
                break;
            case 'label':
                if (!t.labels || t.labels.length === 0) {
                    key = '__unlabeled__';
                    if (!groups[key]) {
                        groups[key] = [];
                    }
                    groups[key].push(t);
                    continue;
                } else {
                    for (var li = 0; li < t.labels.length; li++) {
                        var label = t.labels[li];
                        if (!groups[label]) {
                            groups[label] = [];
                        }
                        groups[label].push(t);
                    }
                    continue;
                }
            default:
                key = 'All';
                break;
        }
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(t);
    }

    return { groups: groups, meta: meta };
}

function sortGroupKeys(keys, groupBy, meta) {
    return keys.sort(function (a, b) {
        if (a === '__ungrouped__' || a === '__unlabeled__') return 1;
        if (b === '__ungrouped__' || b === '__unlabeled__') return -1;
        if (groupBy === 'parent' && meta[a] && meta[b]) {
            return (meta[a].summary || '').localeCompare(meta[b].summary || '');
        }
        return a.localeCompare(b);
    });
}

function getGroupDisplayName(groupBy, groupName, meta) {
    if (groupName === '__ungrouped__') return 'No Parent';
    if (groupName === '__unlabeled__') return 'Unlabeled';
    if (groupBy === 'parent' && meta[groupName]) {
        return (
            '<span class="jira-parent-key" onclick="event.stopPropagation();openJiraParentTicket(\'' +
            escapeHtml(groupName) +
            '\')">' +
            escapeHtml(groupName) +
            '</span> &mdash; ' +
            escapeHtml(meta[groupName].summary)
        );
    }
    return escapeHtml(groupName);
}

function getGroupBadgeHtml(groupBy, groupName, meta) {
    if (groupBy !== 'parent' || !meta[groupName] || !meta[groupName].type) return '';
    var type = meta[groupName].type;
    var badgeClass = 'jira-parent-badge badge-' + type.toLowerCase().replace(/[^a-z]/g, '');
    return ' <span class="' + badgeClass + '">' + escapeHtml(type) + '</span>';
}

function getGroupIconHtml(groupBy, groupName) {
    if (groupBy === 'issueType') {
        var normalized = groupName.toLowerCase().replace(/[\s\-]/g, '');
        var knownTypes = [
            'bug',
            'story',
            'task',
            'epic',
            'subtask',
            'improvement',
            'newfeature',
            'change',
        ];
        if (knownTypes.indexOf(normalized) !== -1) {
            var typeClass = 'jira-type-icon type-' + normalized;
            return '<span class="' + typeClass + '"></span>';
        }
        var color = hashToColor(groupName);
        return '<span class="jira-type-icon" style="background:' + color + '"></span>';
    }
    return '';
}

function getGroupNameClass(groupBy, groupName) {
    if (groupBy === 'issueType') {
        var normalized = groupName.toLowerCase().replace(/[\s\-]/g, '');
        var knownTypes = [
            'bug',
            'story',
            'task',
            'epic',
            'subtask',
            'improvement',
            'newfeature',
            'change',
        ];
        if (knownTypes.indexOf(normalized) !== -1) {
            return 'jira-group-name type-color-' + normalized;
        }
        return 'jira-group-name';
    }
    return 'jira-group-name';
}

function getGroupNameStyle(groupBy, groupName) {
    if (groupBy === 'issueType') {
        var normalized = groupName.toLowerCase().replace(/[\s\-]/g, '');
        var knownTypes = [
            'bug',
            'story',
            'task',
            'epic',
            'subtask',
            'improvement',
            'newfeature',
            'change',
        ];
        if (knownTypes.indexOf(normalized) === -1) {
            return ' style="color:' + hashToColor(groupName) + '"';
        }
    }
    return '';
}

function hashToColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var index = ((hash % 1000) + 1000) % 1000;
    var hue = (index * 137.508) % 360;
    var reserved = [
        [0, 15],
        [25, 50],
        [105, 140],
        [190, 220],
        [260, 285],
    ];
    var shifted = true;
    var passes = 0;
    while (shifted && passes < 5) {
        shifted = false;
        passes++;
        for (var r = 0; r < reserved.length; r++) {
            if (hue >= reserved[r][0] && hue <= reserved[r][1]) {
                hue = (hue + 40) % 360;
                shifted = true;
                break;
            }
        }
    }
    return 'hsl(' + Math.round(hue) + ', 55%, 62%)';
}

function renderJiraSection(scope) {
    var container = document.getElementById('jiraSection');
    if (!container) {
        return;
    }

    if (!state.jira || state.jira.connectionStatus !== 'connected') {
        container.innerHTML = '';
        return;
    }

    var scopeConfig = scope === 'workspace' ? state.jira.workspaceConfig : state.jira.globalConfig;
    if (scopeConfig && scopeConfig.visible === false) {
        container.innerHTML = '';
        return;
    }

    if (
        scope === 'workspace' &&
        scopeConfig &&
        scopeConfig.filter.projectKeys.length === 0 &&
        !scopeConfig.filter.customJql
    ) {
        container.innerHTML = '';
        return;
    }

    if (state.jira.loading) {
        container.innerHTML = `
            <div class="jira-section">
                <div class="jira-section-header">
                    <span class="jira-icon">${ICON_JIRA}</span>
                    <span class="jira-label">Jira</span>
                    <span class="jira-loading-spinner"></span>
                </div>
            </div>`;
        return;
    }

    var tickets = scope === 'workspace' ? state.jira.workspaceTickets : state.jira.tickets;

    if (!tickets || tickets.length === 0) {
        var message = state.jira.lastError
            ? 'Could not fetch tickets. Check your connection settings.'
            : 'No tickets match your filter';
        container.innerHTML = `
            <div class="jira-section">
                <div class="jira-section-header" onclick="toggleJiraSection()">
                    <span class="jira-arrow open">&#9654;</span>
                    <span class="jira-icon">${ICON_JIRA}</span>
                    <span class="jira-label">Jira</span>
                    <span class="jira-count">0</span>
                </div>
                <div style="padding: 8px 12px; font-size: 11px; color: var(--text-3);">
                    ${escapeHtml(message)}
                </div>
            </div>`;
        return;
    }

    var groupBy = getJiraGroupBy(scope);
    var arrowClass = jiraCollapsed ? 'jira-arrow' : 'jira-arrow open';

    var contentHtml;
    if (groupBy === 'none') {
        var itemsClass = jiraCollapsed ? 'jira-items collapsed' : 'jira-items';
        var itemsHtml = '';
        for (var i = 0; i < tickets.length; i++) {
            itemsHtml += renderJiraTicketItem(tickets[i]);
        }
        contentHtml = '<ul class="' + itemsClass + '" id="jiraItems">' + itemsHtml + '</ul>';
    } else {
        var contentClass = jiraCollapsed ? 'jira-groups collapsed' : 'jira-groups';
        contentHtml =
            '<div class="' +
            contentClass +
            '" id="jiraItems">' +
            renderJiraGroups(tickets, scope, groupBy) +
            '</div>';
    }

    container.innerHTML = `
        <div class="jira-section">
            <div class="jira-section-header" onclick="toggleJiraSection()">
                <span class="${arrowClass}">&#9654;</span>
                <span class="jira-icon">${ICON_JIRA}</span>
                <span class="jira-label">Jira</span>
                <span class="jira-count">${tickets.length}</span>
            </div>
            ${contentHtml}
        </div>`;
}

function renderJiraGroups(tickets, scope, groupBy) {
    var result = groupJiraTickets(tickets, groupBy);
    var groups = result.groups;
    var meta = result.meta;
    var sortedKeys = sortGroupKeys(Object.keys(groups), groupBy, meta);

    var html = '';
    for (var k = 0; k < sortedKeys.length; k++) {
        var groupName = sortedKeys[k];
        var items = groups[groupName];
        var isCollapsed = isJiraGroupCollapsed(scope, groupBy, groupName);
        var arrowClass = isCollapsed ? 'jira-group-arrow' : 'jira-group-arrow open';
        var listClass = isCollapsed ? 'jira-items collapsed' : 'jira-items';
        var iconHtml = getGroupIconHtml(groupBy, groupName);
        var displayName = getGroupDisplayName(groupBy, groupName, meta);
        var badgeHtml = getGroupBadgeHtml(groupBy, groupName, meta);

        var escapedScope = escapeHtml(scope);
        var escapedGroupBy = escapeHtml(groupBy);
        var jsEscapedGroupName = groupName
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/</g, '\\x3c')
            .replace(/>/g, '\\x3e');
        var attrGroupName = escapeHtml(jsEscapedGroupName);

        html += '<div class="jira-group">';
        html +=
            '<div class="jira-group-header" onclick="toggleJiraGroup(\'' +
            escapedScope +
            "','" +
            escapedGroupBy +
            "','" +
            attrGroupName +
            '\')">';
        html += '<span class="' + arrowClass + '">&#9654;</span>';
        if (iconHtml) html += '<span class="jira-group-icon">' + iconHtml + '</span>';
        html +=
            '<span class="' +
            getGroupNameClass(groupBy, groupName) +
            '"' +
            getGroupNameStyle(groupBy, groupName) +
            '>' +
            displayName +
            badgeHtml +
            '</span>';
        html += '<span class="jira-group-count">' + items.length + '</span>';
        html += '</div>';
        html += '<ul class="' + listClass + '">';
        for (var j = 0; j < items.length; j++) {
            html += renderJiraTicketItem(items[j]);
        }
        html += '</ul>';
        html += '</div>';
    }
    return html;
}

function renderJiraTicketItem(ticket) {
    var statusClass = getStatusClass(ticket.statusCategory);
    var reminderAt = (state.jira.reminders && state.jira.reminders[ticket.key]) || null;
    var reminderIsDue = reminderAt && new Date(reminderAt).getTime() <= Date.now();

    var bellClass = reminderIsDue
        ? 'jira-item-bell reminder-due'
        : reminderAt
          ? 'jira-item-bell has-reminder'
          : 'jira-item-bell';
    var bellIcon = reminderAt ? ICON_BELL_RING : ICON_BELL_SM;
    var itemClass = reminderIsDue ? 'jira-item alarming' : 'jira-item';
    var escapedKey = escapeHtml(ticket.key);
    var escapedReminderAt = escapeHtml(reminderAt || '');

    return `
        <li class="${itemClass}">
            <span class="jira-item-key" onclick="openJiraTicket('${escapeHtml(ticket.url)}')">${escapedKey}</span>
            <span class="jira-item-title">${escapeHtml(ticket.summary)}</span>
            <span class="jira-item-status ${statusClass}">${escapeHtml(ticket.status)}</span>
            <span class="${bellClass}" onclick="openJiraReminderPicker('${escapedKey}','${escapedReminderAt}')">${bellIcon}</span>
        </li>`;
}

function getStatusClass(statusCategory) {
    switch (statusCategory) {
        case 'In Progress':
            return 'status-inprogress';
        case 'Done':
            return 'status-done';
        default:
            return 'status-todo';
    }
}

function toggleJiraSection() {
    jiraCollapsed = !jiraCollapsed;
    var items = document.getElementById('jiraItems');
    var arrow = document.querySelector('.jira-section-header .jira-arrow');
    if (items) {
        items.classList.toggle('collapsed', jiraCollapsed);
    }
    if (arrow) {
        arrow.classList.toggle('open', !jiraCollapsed);
    }
}

function openJiraTicket(url) {
    vscode.postMessage({ type: 'jiraOpenTicket', url: url });
}

function openJiraParentTicket(parentKey) {
    var tickets =
        state.jira.tickets && state.jira.tickets.length > 0
            ? state.jira.tickets
            : state.jira.workspaceTickets || [];
    if (tickets.length === 0) return;
    var baseUrl = tickets[0].url.replace(/\/browse\/.*$/, '');
    var url = baseUrl + '/browse/' + parentKey;
    vscode.postMessage({ type: 'jiraOpenTicket', url: url });
}

function openJiraReminderPicker(ticketKey, current) {
    dp.scope = 'jira';
    dp.id = ticketKey;

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
        ? '<button class="m-btn cancel" onclick="clearJiraReminder(\'' +
          ticketKey +
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

function clearJiraReminder(ticketKey) {
    vscode.postMessage({ type: 'jiraClearReminder', ticketKey: ticketKey });
}
