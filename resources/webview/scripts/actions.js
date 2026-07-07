function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toggleDone(scope, id, currentDone) {
    var items = state.data[scope] || [];
    var item = items.find(function (t) {
        return t.id === id;
    });
    if (item) item.done = !item.done;
    render();
    vscode.postMessage({ type: 'toggleDone', scope: scope, id: id, done: currentDone });
}

function deleteTodo(scope, id) {
    vscode.postMessage({ type: 'delete', scope: scope, id: id });
}

function clearCompleted(scope) {
    vscode.postMessage({ type: 'clearCompleted', scope: scope });
}
