var jiraCollapsed = false;

function renderJiraSection(tickets) {
    var container = document.getElementById('jiraSection');
    if (!container) {
        return;
    }

    if (!state.jira || state.jira.connectionStatus !== 'connected') {
        container.innerHTML = '';
        return;
    }

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
        html +=
            '<li class="jira-item" onclick="openJiraTicket(\'' + escapeHtml(ticket.url) + '\')">';
        html += '<span class="jira-item-key">' + escapeHtml(ticket.key) + '</span>';
        html += '<span class="jira-item-title">' + escapeHtml(ticket.summary) + '</span>';
        html +=
            '<span class="jira-item-status ' +
            statusClass +
            '">' +
            escapeHtml(ticket.status) +
            '</span>';
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
