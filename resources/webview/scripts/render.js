function render() {
    updateScopeBtns();
    var items = state.data[state.scope] || [];
    var total = items.length;
    var doneCount = items.filter(function (t) {
        return t.done;
    }).length;
    var progressWrap = document.getElementById('progressWrap');

    if (total === 0) {
        progressWrap.style.display = 'none';
    } else {
        progressWrap.style.display = 'flex';
        document.getElementById('progressBar').style.width =
            Math.round((doneCount / total) * 100) + '%';
        document.getElementById('progressLabel').textContent = doneCount + '/' + total + ' done';
    }

    var html = '';
    if (items.length) html = renderItems(state.scope, items);
    if (!html) html = fillTemplate(TPL_EMPTY_STATE, { clipboardIcon: ICON_CLIPBOARD });

    document.getElementById('list').innerHTML = html;
}

function renderItems(currentScope, items) {
    var html = '';
    var now = Date.now();
    items.forEach(function (todo) {
        var hasReminder = !!todo.reminderAt;
        var isAlarming = hasReminder && !todo.done && new Date(todo.reminderAt).getTime() <= now;
        var reminderLabel = hasReminder
            ? new Date(todo.reminderAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
              })
            : '';

        var badgeClass = 'reminder-badge' + (isAlarming ? ' alarming' : '');
        var badgeIcon = isAlarming ? ICON_BELL_RING : ICON_BELL;
        var badgeTitle = isAlarming ? 'Reminder due! ' + reminderLabel : reminderLabel;

        var reminderLabelHtml = '';
        if (hasReminder && !todo.done && !isAlarming) {
            var msUntil = new Date(todo.reminderAt).getTime() - now;
            var hoursUntil = Math.floor(msUntil / 3600000);
            var minutesUntil = Math.floor((msUntil % 3600000) / 60000);
            var labelText = '';
            if (hoursUntil < 24) {
                if (hoursUntil < 1) {
                    labelText = minutesUntil + 'm';
                } else {
                    labelText = hoursUntil + 'h ' + minutesUntil + 'm';
                }
            } else {
                labelText = new Date(todo.reminderAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                });
            }
            reminderLabelHtml =
                '<span class="reminder-time" title="' +
                escapeHtml(reminderLabel) +
                '">' +
                labelText +
                '</span>';
        }

        html += fillTemplate(TPL_TODO_ITEM, {
            id: todo.id,
            scope: currentScope,
            doneClass: todo.done ? ' done' : '',
            alarmingClass: isAlarming ? ' alarming' : '',
            done: todo.done,
            checkmark: todo.done ? '&#10003;' : '',
            priorityClass:
                todo.priority === 'high' ? 'p-h' : todo.priority === 'low' ? 'p-l' : 'p-n',
            title: escapeHtml(todo.title),
            reminderAt: todo.reminderAt || '',
            reminderLabel: reminderLabelHtml,
            reminderBadge: hasReminder
                ? '<span class="' +
                  badgeClass +
                  '" title="' +
                  badgeTitle +
                  '">' +
                  badgeIcon +
                  '</span>'
                : '',
            bellClass: hasReminder ? ' bell-active' : '',
            bellTitle: hasReminder ? 'Edit reminder' : 'Set reminder',
            bellIcon: ICON_BELL_SM,
        });
    });
    return html;
}
