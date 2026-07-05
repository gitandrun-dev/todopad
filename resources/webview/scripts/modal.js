function fillTemplate(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        vars[key] !== undefined ? vars[key] : '',
    );
}

function showModal(content) {
    document.getElementById('modal-root').innerHTML =
        '<div class="modal-overlay" onclick="if(event.target===this)closeEdit()">' +
        '<div class="modal">' +
        content +
        '</div></div>';
}

function closeEdit() {
    state.editingId = null;
    state.editingScope = null;
    document.getElementById('modal-root').innerHTML = '';
}

function openEdit(scope, id) {
    var items = scope === 'global' ? state.data.global : state.data.workspace;
    var todo = items.find((x) => x.id === id);
    if (!todo) return;
    state.editingId = id;
    state.editingScope = scope;

    var reminderDisplay = todo.reminderAt
        ? new Date(todo.reminderAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : 'None';

    var priorityOptions = ['normal', 'high', 'low']
        .map(
            (p) =>
                '<option value="' +
                p +
                '"' +
                (todo.priority === p ? ' selected' : '') +
                '>' +
                p.charAt(0).toUpperCase() +
                p.slice(1) +
                '</option>',
        )
        .join('');

    showModal(
        fillTemplate(TPL_EDIT_MODAL, {
            title: escapeHtml(todo.title),
            description: escapeHtml(todo.description || ''),
            priorityOptions: priorityOptions,
            reminderClass: todo.reminderAt ? ' has-value' : '',
            reminderDisplay: reminderDisplay,
            reminderAt: todo.reminderAt || '',
            bellIcon: ICON_BELL_SM,
            scope: scope,
            id: id,
        }),
    );

    setTimeout(() => {
        var el = document.getElementById('eTitle');
        if (el) el.focus();
    }, 50);
}

function saveEdit(scope, id) {
    var title = document.getElementById('eTitle').value.trim();
    var description = document.getElementById('eDesc').value.trim();
    var priority = document.getElementById('ePri').value;
    if (!title) return;

    var items = scope === 'global' ? state.data.global : state.data.workspace;
    var todo = items.find((x) => x.id === id);
    var reminderAt = todo ? todo.reminderAt : null;

    vscode.postMessage({
        type: 'edit',
        scope: scope,
        id,
        title,
        description,
        priority,
        reminderAt,
    });
    closeEdit();
}

function confirmClear() {
    document.getElementById('overflowMenu').style.display = 'none';
    var items = state.data[state.scope] || [];
    var doneCount = items.filter((t) => t.done).length;

    showModal(
        fillTemplate(TPL_CONFIRM_CLEAR, {
            count: doneCount,
            plural: doneCount > 1 ? 's' : '',
            scope: state.scope,
        }),
    );
}

function toggleOverflow(e) {
    e.stopPropagation();
    var menu = document.getElementById('overflowMenu');

    if (menu.style.display === 'none') {
        var items = state.data[state.scope] || [];
        var doneCount = items.filter((t) => t.done).length;

        menu.innerHTML = doneCount
            ? '<button class="overflow-menu-item danger" onclick="confirmClear()">Clear ' +
              doneCount +
              ' completed</button>'
            : '<button class="overflow-menu-item" disabled style="opacity:0.4;cursor:default">No completed tasks</button>';
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

document.addEventListener('click', () => {
    var menu = document.getElementById('overflowMenu');
    if (menu) menu.style.display = 'none';
});
