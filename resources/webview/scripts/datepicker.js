var dp = {
    year: null,
    month: null,
    selectedDate: null,
    scope: null,
    id: null,
};

var MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

// --- Public API (called from templates/other scripts) ---

function openReminderPicker(scope, id, current) {
    dp.scope = scope;
    dp.id = id;

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
        ? '<button class="m-btn cancel" onclick="clearReminder(\'' +
          scope +
          "','" +
          id +
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

function dpNav(dir) {
    dp.month += dir;
    if (dp.month > 11) {
        dp.month = 0;
        dp.year++;
    }
    if (dp.month < 0) {
        dp.month = 11;
        dp.year--;
    }
    dp.selectedDate = null;
    dpRenderCal();
}

function dpSelect(day) {
    dp.selectedDate = day;
    dpRenderCal();
}

function dpClampHour() {
    var el = document.getElementById('dpHour');
    var v = Math.min(12, Math.max(1, parseInt(el.value) || 0));
    el.value = String(v).padStart(2, '0');
}

function dpClampMin() {
    var el = document.getElementById('dpMin');
    var v = Math.min(59, Math.max(0, parseInt(el.value) || 0));
    el.value = String(v).padStart(2, '0');
}

function dpSave() {
    var dt = dpGetDateTime();
    if (!dt || dt.getTime() <= Date.now()) return;
    dpPostReminder(dt.toISOString());
}

function dpPreset(minutes) {
    dpPostReminder(new Date(Date.now() + minutes * 60000).toISOString());
}

function clearReminder(scope, id) {
    vscode.postMessage({ type: 'clearReminder', scope: scope, id: id });
}

// --- Internal helpers ---

function dpPostReminder(isoDate) {
    if (dp.scope === 'jira') {
        vscode.postMessage({
            type: 'jiraSetReminder',
            ticketKey: dp.id,
            reminderAt: isoDate,
        });
    } else {
        vscode.postMessage({
            type: 'setReminder',
            scope: dp.scope,
            id: dp.id,
            reminderAt: isoDate,
        });
    }
    closeEdit();
}

function dpGetDateTime() {
    if (!dp.selectedDate) return null;
    var h = parseInt(document.getElementById('dpHour').value) || 12;
    var m = parseInt(document.getElementById('dpMin').value) || 0;
    var ampm = document.getElementById('dpAmpm').value;
    if (ampm === 'AM' && h === 12) h = 0;
    if (ampm === 'PM' && h !== 12) h += 12;
    return new Date(dp.year, dp.month, dp.selectedDate, h, m, 0);
}

function dpRenderCal() {
    var now = new Date();
    var todayVal = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    var startDay = new Date(dp.year, dp.month, 1).getDay();
    var daysInMonth = new Date(dp.year, dp.month + 1, 0).getDate();
    var prevMonthDays = new Date(dp.year, dp.month, 0).getDate();

    var html = dpRenderHeader() + dpRenderWeekdays();
    html += '<div class="dp-days">';
    html += dpRenderPrevOverflow(startDay, prevMonthDays);
    html += dpRenderDays(daysInMonth, todayVal);
    html += dpRenderNextOverflow(startDay + daysInMonth);
    html += '</div>';

    document.getElementById('dpCal').innerHTML = html;
}

function dpRenderHeader() {
    return (
        '<div class="dp-header">' +
        '<button class="dp-nav" onclick="dpNav(-1)">&#8249;</button>' +
        '<span class="dp-title">' +
        MONTH_NAMES[dp.month] +
        ' ' +
        dp.year +
        '</span>' +
        '<button class="dp-nav" onclick="dpNav(1)">&#8250;</button>' +
        '</div>'
    );
}

function dpRenderWeekdays() {
    return (
        '<div class="dp-weekdays">' +
        '<span>Su</span><span>Mo</span><span>Tu</span><span>We</span>' +
        '<span>Th</span><span>Fr</span><span>Sa</span></div>'
    );
}

function dpRenderPrevOverflow(startDay, prevMonthDays) {
    var html = '';
    for (var i = startDay - 1; i >= 0; i--) {
        html += '<button class="dp-day other past">' + (prevMonthDays - i) + '</button>';
    }
    return html;
}

function dpRenderDays(daysInMonth, todayVal) {
    var html = '';
    for (var d = 1; d <= daysInMonth; d++) {
        var dateVal = dp.year * 10000 + (dp.month + 1) * 100 + d;
        var isPast = dateVal < todayVal;
        var cls = 'dp-day';
        if (isPast) cls += ' past';
        if (dateVal === todayVal) cls += ' today';
        if (d === dp.selectedDate) cls += ' selected';
        var click = isPast ? '' : ' onclick="dpSelect(' + d + ')"';
        html += '<button class="' + cls + '"' + click + '>' + d + '</button>';
    }
    return html;
}

function dpRenderNextOverflow(totalCells) {
    var remainder = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    var html = '';
    for (var i = 1; i <= remainder; i++) {
        html += '<button class="dp-day other past">' + i + '</button>';
    }
    return html;
}
