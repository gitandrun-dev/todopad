var BELL_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.7 2 6 4.7 6 8c0 6-3 8-3 8h18s-3-2-3-8c0-3.3-2.7-6-6-6z"/><path d="M10 20c.2.6.8 1 1.5 1h1c.7 0 1.3-.4 1.5-1"/></svg>';
var BELL_RING_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.7 2 6 4.7 6 8c0 6-3 8-3 8h18s-3-2-3-8c0-3.3-2.7-6-6-6z"/><path d="M10 20c.2.6.8 1 1.5 1h1c.7 0 1.3-.4 1.5-1"/><path d="M2 8c0-2.2.9-4.2 2.3-5.7"/><path d="M22 8c0-2.2-.9-4.2-2.3-5.7"/></svg>';
var JIRA_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#2684ff"><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35V2.65A.65.65 0 0 0 21.36 2H11.53zM6.77 6.8c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35V7.44a.65.65 0 0 0-.65-.65H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35v-9.75a.65.65 0 0 0-.65-.65H2z"/></svg>';
var GIT_MERGE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/></svg>';
var GITLAB_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0c.05.05.09.11.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0c.05.05.09.11.11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/></svg>';
var GEAR_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

function renderPanels() {
}

renderPanels();

function renderDetailPanels() {
    // Tasks detail
    document.getElementById('panel-tasks-detail').innerHTML =
        '<div class="sf-header">' +
        '<div class="scope-row"><div class="segmented"><div class="seg-btn active">Global <span class="seg-badge">3</span></div><div class="seg-btn">Workspace <span class="seg-badge">2</span></div></div><div class="gear-btn">'+GEAR_SVG+'</div></div>' +
        '<div class="input-wrap"><input type="text" placeholder="Add a new task..." disabled><div class="add-btn">+</div></div>' +
        '<div class="progress"><div class="progress-track"><div class="progress-bar" style="width:40%"></div></div><span class="progress-label">2/5 done</span><div class="overflow-btn">&#8943;</div></div>' +
        '</div><div class="sf-scroll">' +
        '<div class="item"><div class="ck"></div><div class="pr p-h"></div><span class="lbl">Review PR for auth refactor</span><span class="reminder-time">4h 30m</span><div class="tail"><span class="reminder-badge">'+BELL_SVG+'</span></div></div>' +
        '<div class="item"><div class="ck"></div><div class="pr p-n"></div><span class="lbl">Write migration script for user table</span><div class="tail"></div></div>' +
        '<div class="item"><div class="ck"></div><div class="pr p-l"></div><span class="lbl">Update README with new API docs</span><div class="tail"></div></div>' +
        '<div class="item done"><div class="ck">&#10003;</div><div class="pr p-n"></div><span class="lbl">Fix pagination bug on /orders</span><div class="tail"></div></div>' +
        '<div class="item done"><div class="ck">&#10003;</div><div class="pr p-h"></div><span class="lbl">Deploy hotfix v2.3.1</span><div class="tail"></div></div>' +
        '</div>';

    // Reminders panel
    document.getElementById('panel-reminders').innerHTML =
        '<div class="sf-header">' +
        '<div class="scope-row"><div class="segmented"><div class="seg-btn active">Global <span class="seg-badge">3</span></div><div class="seg-btn">Workspace</div></div><div class="gear-btn">'+GEAR_SVG+'</div></div>' +
        '</div><div class="sf-scroll">' +
        '<div class="item alarming"><div class="ck"></div><div class="pr p-h"></div><span class="lbl">Review PR for auth refactor</span><div class="tail"><span class="reminder-badge alarming">'+BELL_RING_SVG+'</span></div></div>' +
        '<div class="item"><div class="ck"></div><div class="pr p-n"></div><span class="lbl">Write migration script</span><span class="reminder-time">in 2h 15m</span><div class="tail"><span class="reminder-badge">'+BELL_SVG+'</span></div></div>' +
        '<div class="item"><div class="ck"></div><div class="pr p-l"></div><span class="lbl">Update API documentation</span><div class="tail"></div></div>' +
        '</div>' +
        '<div class="statusbar-mock"><span class="sb-left">main* &nbsp; &#x2713; 0 &#x26A0; 2</span><span class="sb-right"><span class="sb-bell">'+BELL_SVG+' 2</span> &nbsp; Ln 42, Col 8 &nbsp; UTF-8</span></div>';

    // Toast
    document.getElementById('panel-toast').innerHTML =
        '<div class="toast-top"><span class="toast-info">i</span><span class="toast-msg">&#x23F0; Reminder: Review PR for auth refactor</span><span class="toast-icons">&#x2699; &#x2715;</span></div>' +
        '<div class="toast-bottom"><span class="toast-source">Source: TodoPad</span><div class="toast-actions"><span class="toast-btn primary">Mark Done</span><span class="toast-btn">Snooze 10m</span><span class="toast-btn">Dismiss</span></div></div>';

    // Jira detail
    document.getElementById('panel-jira-detail').innerHTML =
        '<div class="sf-header">' +
        '<div class="scope-row"><div class="segmented"><div class="seg-btn active">Global <span class="seg-badge">7</span></div><div class="seg-btn">Workspace <span class="seg-badge">4</span></div></div><div class="gear-btn">'+GEAR_SVG+'</div></div>' +
        '</div><div class="sf-scroll">' +
        '<div class="jira-section"><div class="jira-section-header"><span class="jira-arrow open">&#9654;</span><span class="jira-icon">'+JIRA_SVG+'</span><span class="jira-label">Jira</span><span class="jira-count">4</span></div>' +
        '<ul class="jira-items">' +
        '<li class="jira-item alarming"><span class="jira-item-key">PROJ-305</span><span class="jira-item-title">Information Edit modal fix</span><span class="jira-item-status status-todo">Open</span><span class="jira-item-bell reminder-due">'+BELL_RING_SVG+'</span></li>' +
        '<li class="jira-item"><span class="jira-item-key">PROJ-14550</span><span class="jira-item-title">Exit point for Custom List</span><span class="jira-item-status status-inprogress">In Progress</span><span class="jira-item-bell"></span></li>' +
        '<li class="jira-item"><span class="jira-item-key">PROJ-14371</span><span class="jira-item-title">Inbox - Fields Items mapping</span><span class="jira-item-status status-todo">Open</span><span class="jira-item-bell"></span></li>' +
        '<li class="jira-item"><span class="jira-item-key">PROJ-14543</span><span class="jira-item-title">Convert from legacy API</span><span class="jira-item-status status-inprogress">In Progress</span><span class="jira-item-bell has-reminder">'+BELL_SVG+'</span></li>' +
        '</ul></div></div>';

    // MR detail
    document.getElementById('panel-mr-detail').innerHTML =
        '<div class="sf-header">' +
        '<div class="scope-row"><div class="segmented"><div class="seg-btn active">Global <span class="seg-badge">11</span></div><div class="seg-btn">Workspace <span class="seg-badge">5</span></div></div><div class="gear-btn">'+GEAR_SVG+'</div></div>' +
        '</div><div class="sf-scroll">' +
        '<div class="mr-section"><div class="mr-section-header"><span class="mr-arrow open">&#9654;</span><span class="mr-icon">'+GIT_MERGE_SVG+'</span><span class="mr-label">Merge Requests</span><span class="mr-count">5</span></div>' +
        '<ul class="mr-items">' +
        '<div class="mr-group-label">Review Requested</div>' +
        '<li class="mr-item alarming"><span class="mr-item-platform gitlab">'+GITLAB_SVG+'</span><span class="mr-item-number">!4281</span><span class="mr-item-title">Frequently sold together</span><span class="mr-item-badge review-pending">Review</span><span class="mr-item-bell reminder-due">'+BELL_RING_SVG+'</span></li>' +
        '<li class="mr-item"><span class="mr-item-platform gitlab">'+GITLAB_SVG+'</span><span class="mr-item-number">!4375</span><span class="mr-item-title">Edit Order - Upgrade theme</span><span class="mr-item-badge review-pending">Review</span><span class="mr-item-bell has-reminder">'+BELL_SVG+'</span></li>' +
        '<div class="mr-group-label">Assigned to Me</div>' +
        '<li class="mr-item"><span class="mr-item-platform gitlab">'+GITLAB_SVG+'</span><span class="mr-item-number">!4380</span><span class="mr-item-title">Order Summary - Redesign</span><span class="mr-item-badge approval-partial">1/2 Approved</span><span class="mr-item-bell"></span></li>' +
        '<li class="mr-item"><span class="mr-item-platform gitlab">'+GITLAB_SVG+'</span><span class="mr-item-number">!4515</span><span class="mr-item-title">Set column button width</span><span class="mr-item-badge review-approved">Approved &#x2713;</span><span class="mr-item-bell"></span></li>' +
        '</ul></div></div>';

    // Code TODOs
    document.getElementById('panel-codetodos').innerHTML =
        '<div class="sf-header">' +
        '<div class="scope-row"><div class="segmented"><div class="seg-btn active">Global <span class="seg-badge">1</span></div><div class="seg-btn">Workspace</div></div><div class="gear-btn">'+GEAR_SVG+'</div></div>' +
        '</div><div class="sf-scroll">' +
        '<div class="item"><div class="ck"></div><div class="pr p-n"></div><span class="lbl">Clean up old migrations</span><div class="tail"></div></div>' +
        '</div>' +
        '<div class="ct-wrap">' +
        '<div class="ct-toggle">&#x25B2; <strong>Code TODOs</strong> <span class="ct-badge">8</span></div>' +
        '<div class="ct-panel">' +
        '<div class="ct-file"><div class="ct-file-header">src/services/authService.ts</div>' +
        '<div class="ct-item"><span class="ct-type todo">TODO</span><span class="ct-text">Add refresh token rotation</span><span class="ct-line">:42</span></div>' +
        '<div class="ct-item"><span class="ct-type fixme">FIXME</span><span class="ct-text">Race condition on concurrent logins</span><span class="ct-line">:87</span></div></div>' +
        '<div class="ct-file"><div class="ct-file-header">src/utils/dateHelpers.ts</div>' +
        '<div class="ct-item"><span class="ct-type todo">TODO</span><span class="ct-text">Handle timezone edge cases</span><span class="ct-line">:15</span></div>' +
        '<div class="ct-item"><span class="ct-type hack">HACK</span><span class="ct-text">Workaround for Safari date parsing</span><span class="ct-line">:31</span></div></div>' +
        '</div></div>';
}

renderDetailPanels();
