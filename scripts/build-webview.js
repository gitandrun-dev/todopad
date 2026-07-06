const fs = require('fs');
const path = require('path');

const WEBVIEW_DIR = path.join(__dirname, '..', 'resources', 'webview');
const OUTPUT_FILE = path.join(__dirname, '..', 'resources', 'webview.html');

const CSS_FILES = [
    'styles/base.css',
    'styles/ui.css',
    'styles/todo-item.css',
    'styles/datepicker.css',
    'styles/code-todos.css',
    'styles/jira.css',
    'styles/integrations.css',
];

const JS_FILES = [
    'scripts/icons.js',
    'scripts/actions.js',
    'scripts/app.js',
    'scripts/render.js',
    'scripts/modal.js',
    'scripts/datepicker.js',
    'scripts/code-todos.js',
    'scripts/drag.js',
    'scripts/jira.js',
    'scripts/integrations.js',
];

const TEMPLATE_FILES = [
    { file: 'templates/edit-modal.html', varName: 'TPL_EDIT_MODAL' },
    { file: 'templates/confirm-clear-modal.html', varName: 'TPL_CONFIRM_CLEAR' },
    { file: 'templates/todo-item.html', varName: 'TPL_TODO_ITEM' },
    { file: 'templates/empty-state.html', varName: 'TPL_EMPTY_STATE' },
    { file: 'templates/reminder-picker.html', varName: 'TPL_REMINDER_PICKER' },
    { file: 'templates/integrations-list.html', varName: 'TPL_INTEGRATIONS_LIST' },
    { file: 'templates/jira-settings.html', varName: 'TPL_JIRA_SETTINGS' },
];

function readFile(relativePath) {
    return fs.readFileSync(path.join(WEBVIEW_DIR, relativePath), 'utf-8');
}

function buildTemplates() {
    return TEMPLATE_FILES.map(({ file, varName }) => {
        const content = readFile(file)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n');
        return `var ${varName} = '${content}';`;
    }).join('\n');
}

function build() {
    let html = readFile('index.html');
    const css = CSS_FILES.map((f) => readFile(f)).join('\n');
    const templates = buildTemplates();
    const scripts = JS_FILES.map((f) => readFile(f)).join('\n\n');
    const js = templates + '\n\n' + scripts;

    html = html.replace('/* {{STYLES}} */', css);
    html = html.replace('/* {{SCRIPTS}} */', js);

    fs.writeFileSync(OUTPUT_FILE, html, 'utf-8');
    console.log('  webview.html  ' + (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1) + 'kb');
}

build();
