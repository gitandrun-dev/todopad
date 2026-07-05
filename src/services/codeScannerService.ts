import * as vscode from 'vscode';
import { CodeTodoItem, CodeTodoFileGroup, CodeTodoType } from '../models/codeTodoItem';

const COMMENT_PATTERN = /(?:\/\/|\/\*|#|--|%)\s*(TODO|FIXME|HACK|XXX)\s*:?\s*(.+?)(?:\*\/)?$/i;

const DEFAULT_INCLUDE =
    '**/*.{ts,tsx,js,jsx,py,java,c,cpp,h,hpp,cs,go,rs,rb,php,swift,kt,scala,sh,bash,yaml,yml,toml}';
const DEFAULT_EXCLUDE = '**/node_modules/**,**/dist/**,**/build/**,**/.git/**,**/vendor/**';
const MAX_FILE_SIZE = 1024 * 1024;

export class CodeScannerService {
    private results: Map<string, CodeTodoItem[]> = new Map();
    private disposables: vscode.Disposable[] = [];
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private scanTimeout: NodeJS.Timeout | undefined;

    async initialize(): Promise<void> {
        if (!this.isEnabled()) {
            return;
        }

        await this.fullScan();

        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.disposables.push(
            watcher,
            watcher.onDidChange((uri) => this.debouncedScanFile(uri)),
            watcher.onDidCreate((uri) => this.debouncedScanFile(uri)),
            watcher.onDidDelete((uri) => this.handleFileDelete(uri)),
            vscode.workspace.onDidSaveTextDocument((doc) => this.debouncedScanFile(doc.uri)),
        );
    }

    getFileGroups(): CodeTodoFileGroup[] {
        const groups: CodeTodoFileGroup[] = [];
        for (const [file, items] of this.results) {
            if (items.length > 0) {
                groups.push({ file, uri: items[0].uri, items });
            }
        }
        groups.sort((a, b) => a.file.localeCompare(b.file));
        return groups;
    }

    async refresh(): Promise<void> {
        this.results.clear();
        if (this.isEnabled()) {
            await this.fullScan();
        }
        this._onDidChange.fire();
    }

    private isEnabled(): boolean {
        return vscode.workspace.getConfiguration('todopad').get<boolean>('codeScan.enabled', true);
    }

    private getIncludePattern(): string {
        return vscode.workspace
            .getConfiguration('todopad')
            .get<string>('codeScan.includePatterns', DEFAULT_INCLUDE);
    }

    private getExcludePattern(): string {
        return vscode.workspace
            .getConfiguration('todopad')
            .get<string>('codeScan.excludePatterns', DEFAULT_EXCLUDE);
    }

    private async fullScan(): Promise<void> {
        const include = this.getIncludePattern();
        const exclude = this.getExcludePattern();

        const files = await vscode.workspace.findFiles(include, `{${exclude}}`);

        for (const uri of files) {
            await this.scanFile(uri);
        }

        this._onDidChange.fire();
    }

    private debouncedScanFile(uri: vscode.Uri): void {
        if (!this.isEnabled()) {
            return;
        }
        if (!this.isIncluded(uri)) {
            return;
        }

        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
        }
        this.scanTimeout = setTimeout(async () => {
            await this.scanFile(uri);
            this._onDidChange.fire();
        }, 500);
    }

    private isIncluded(uri: vscode.Uri): boolean {
        const path = uri.fsPath;
        if (path.includes('node_modules') || path.includes('.git') || path.includes('dist')) {
            return false;
        }
        return true;
    }

    private async scanFile(uri: vscode.Uri): Promise<void> {
        const relativePath = vscode.workspace.asRelativePath(uri, false);

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.size > MAX_FILE_SIZE) {
                return;
            }

            const content = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(content).toString('utf-8');
            const lines = text.split('\n');
            const items: CodeTodoItem[] = [];

            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(COMMENT_PATTERN);
                if (match) {
                    items.push({
                        type: match[1].toUpperCase() as CodeTodoType,
                        text: match[2].trim(),
                        file: relativePath,
                        uri: uri.toString(),
                        line: i,
                    });
                }
            }

            this.results.set(relativePath, items);
        } catch {
            // File might have been deleted or is binary
            this.results.delete(relativePath);
        }
    }

    private handleFileDelete(uri: vscode.Uri): void {
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        if (this.results.has(relativePath)) {
            this.results.delete(relativePath);
            this._onDidChange.fire();
        }
    }

    dispose(): void {
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
        }
        this.disposables.forEach((d) => d.dispose());
        this._onDidChange.dispose();
    }
}
