var ctOpen = false;

function toggleCodeTodos() {
    ctOpen = !ctOpen;
    document.getElementById('ctToggle').classList.toggle('open', ctOpen);
    document.getElementById('ctPanel').classList.toggle('open', ctOpen);
    document.querySelector('.ct-arrow').innerHTML = ctOpen ? '&#9650;' : '&#9660;';
}

function renderCodeTodos(groups) {
    var toggle = document.getElementById('ctToggle');
    var panel = document.getElementById('ctPanel');
    var total = groups.reduce((sum, g) => sum + g.items.length, 0);

    toggle.style.display = 'flex';
    document.getElementById('ctCount').textContent = total;

    if (total === 0) {
        panel.innerHTML = `<div style="padding:12px;font-size:11px;color:var(--text-3);text-align:center">No TODO, FIXME, HACK, or XXX comments found in workspace</div>`;
        return;
    }

    panel.innerHTML = groups
        .map(
            (group) => `
    <div class="ct-file">
      <div class="ct-file-header">${escapeHtml(group.file)}</div>
      ${group.items
          .map(
              (item) => `
        <div class="ct-item" onclick="openCodeFile('${escapeHtml(item.uri)}',${item.line})">
          <span class="ct-type ${item.type}">${item.type}</span>
          <span class="ct-text">${escapeHtml(item.text)}</span>
          <span class="ct-line">:${item.line + 1}</span>
        </div>
      `,
          )
          .join('')}
    </div>
  `,
        )
        .join('');
}

function openCodeFile(uri, line) {
    vscode.postMessage({ type: 'openFile', uri, line });
}
