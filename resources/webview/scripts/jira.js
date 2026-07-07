var jiraCollapsed = false;

function renderJiraSection(scope) {
    var container = document.getElementById('jiraSection');
    if (!container) {
        return;
    }

    if (!state.jira || state.jira.connectionStatus !== 'connected') {
        container.innerHTML = '';
        return;
    }

    var scopeConfig = (scope === 'workspace') ? state.jira.workspaceConfig : state.jira.globalConfig;
    if (scopeConfig && scopeConfig.visible === false) {
        container.innerHTML = '';
        return;
    }

    var tickets = (scope === 'workspace')
        ? state.jira.workspaceTickets
        : state.jira.tickets;

    if (!tickets || tickets.length === 0) {
        var message = 'No tickets match your filter';
        if (state.jira.lastError) {
            message = 'Could not fetch tickets. Check your connection settings.';
        }
        container.innerHTML =
            '<div class="jira-section">' +
            '<div class="jira-section-header" onclick="toggleJiraSection()">' +
            '<span class="jira-arrow open">&#9654;</span>' +
            '<span class="jira-icon">' +
            ICON_JIRA +
            '</span>' +
            '<span class="jira-label">Jira</span>' +
            '<span class="jira-count">0</span>' +
            '</div>' +
            '<div style="padding: 8px 12px; font-size: 11px; color: var(--text-3);">' +
            escapeHtml(message) +
            '</div></div>';
        return;
    }

    var count = tickets.length;
    var arrowClass = jiraCollapsed ? 'jira-arrow' : 'jira-arrow open';
    var itemsClass = jiraCollapsed ? 'jira-items collapsed' : 'jira-items';

    var html = '<div class="jira-section">';
    html += '<div class="jira-section-header" onclick="toggleJiraSection()">';
    html += '<span class="' + arrowClass + '">&#9654;</span>';
    html += '<span class="jira-icon">' + ICON_JIRA + '</span>';
    html += '<span class="jira-label">Jira</span>';
    html += '<span class="jira-count">' + count + '</span>';
    html += '</div>';
    html += '<ul class="' + itemsClass + '" id="jiraItems">';

    for (var i = 0; i < tickets.length; i++) {
        var ticket = tickets[i];
        var statusClass = getStatusClass(ticket.statusCategory);
        var reminderAt = (state.jira.reminders && state.jira.reminders[ticket.key]) || null;
        var reminderIsDue = reminderAt && new Date(reminderAt).getTime() <= Date.now();
        var bellClass = reminderIsDue ? 'jira-item-bell reminder-due' : (reminderAt ? 'jira-item-bell has-reminder' : 'jira-item-bell');
        var bellIcon = reminderAt ? ICON_BELL_RING : ICON_BELL_SM;
        var bellHtml = '<span class="' + bellClass + '" onclick="event.stopPropagation();openJiraReminderPicker(\'' + escapeHtml(ticket.key) + '\',\'' + escapeHtml(reminderAt || '') + '\')">' + bellIcon + '</span>';
        var itemClass = reminderIsDue ? 'jira-item alarming' : 'jira-item';
        html +=
            '<li class="' + itemClass + '" onclick="openJiraTicket(\'' + escapeHtml(ticket.url) + '\')">';
        html += '<span class="jira-item-key">' + escapeHtml(ticket.key) + '</span>';
        html += '<span class="jira-item-title">' + escapeHtml(ticket.summary) + '</span>';
        html +=
            '<span class="jira-item-status ' +
            statusClass +
            '">' +
            escapeHtml(ticket.status) +
            '</span>';
        html += bellHtml;
        html += '</li>';
    }

    html += '</ul></div>';
    container.innerHTML = html;
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
    var arrow = document.querySelector('.jira-arrow');
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

function openJiraReminderPicker(ticketKey, current) {
    dp.scope = 'jira';
    dp.id = ticketKey;

    var now = new Date();
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
