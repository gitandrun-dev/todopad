function dragStart(e, id, scope) {
    state.dragItemId = id;
    state.dragItemScope = scope;
    e.target.closest('.item').classList.add('drag');
    e.dataTransfer.effectAllowed = 'move';
}

function dragOver(e) {
    e.preventDefault();
    var el = e.target.closest('.item');
    if (!el || !state.dragItemId || el.dataset.i === state.dragItemId) return;
    if (el.dataset.s !== state.dragItemScope) return;
    el.classList.add('over');
}

function dragLeave(e) {
    var el = e.target.closest('.item');
    if (el) el.classList.remove('over');
}

function drop(e, targetId, targetScope) {
    e.preventDefault();
    document.querySelectorAll('.over,.drag').forEach(function (x) {
        x.classList.remove('over', 'drag');
    });
    if (!state.dragItemId || state.dragItemId === targetId || state.dragItemScope !== targetScope) {
        state.dragItemId = null;
        state.dragItemScope = null;
        return;
    }
    vscode.postMessage({
        type: 'reorder',
        scope: state.dragItemScope,
        id: state.dragItemId,
        targetId: targetId,
    });
    state.dragItemId = null;
    state.dragItemScope = null;
}

document.addEventListener('dragend', function () {
    document.querySelectorAll('.over,.drag').forEach(function (x) {
        x.classList.remove('over', 'drag');
    });
    state.dragItemId = null;
    state.dragItemScope = null;
});
