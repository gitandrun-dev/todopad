const fs = require('fs');
const path = require('path');

const mockDir = path.join(__dirname, '..', 'node_modules', 'vscode');
const packagePath = path.join(mockDir, 'package.json');
const indexPath = path.join(mockDir, 'index.js');

if (fs.existsSync(indexPath)) {
    process.exit(0);
}

fs.mkdirSync(mockDir, { recursive: true });

fs.writeFileSync(
    packagePath,
    JSON.stringify({ name: 'vscode', version: '0.0.0', main: './index.js' }, null, 2),
);

fs.writeFileSync(
    indexPath,
    `"use strict";

const fileStore = {};

class Uri {
    constructor(value) { this._value = value; }
    toString() { return this._value; }
    static joinPath(base, ...segments) {
        const joined = segments.reduce(
            (acc, seg) => acc.replace(/\\/+$/, '') + '/' + seg,
            base.toString(),
        );
        return new Uri(joined);
    }
    static parse(value) { return new Uri(value); }
}

const workspace = {
    fs: {
        async readFile(uri) {
            const key = uri.toString();
            if (key in fileStore) return fileStore[key];
            const error = new Error('FileNotFound');
            error.code = 'FileNotFound';
            throw error;
        },
        async writeFile(uri, content) { fileStore[uri.toString()] = content; },
    },
    getConfiguration() {
        return { get(_key, defaultValue) { return defaultValue; } };
    },
};

const env = { openExternal() {} };
const window = { showInformationMessage() { return Promise.resolve(undefined); } };

function resetFileStore() { for (const key of Object.keys(fileStore)) delete fileStore[key]; }
function getFileStore() { return fileStore; }

module.exports = { Uri, workspace, env, window, resetFileStore, getFileStore };
`,
);
