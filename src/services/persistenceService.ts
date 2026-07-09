import * as vscode from 'vscode';
import { TodoItem, Scope } from '../models/todoItem';
import { StorageService } from './storageService';

const LEGACY_GLOBAL_STORAGE_KEY = 'todopad.globalTodos';
const GLOBAL_TODOS_FILENAME = 'globalTodos.json';
const WORKSPACE_STORAGE_KEY = 'todopad.workspaceTodos';

export class PersistenceService implements vscode.Disposable {
    private globalFileUri: vscode.Uri;
    private watcher?: vscode.FileSystemWatcher;
    private onExternalChangeCallback?: () => void;
    private suppressNextWatch = false;

    constructor(
        private context: vscode.ExtensionContext,
        private storageService: StorageService,
    ) {
        this.globalFileUri = vscode.Uri.joinPath(context.globalStorageUri, GLOBAL_TODOS_FILENAME);
    }

    async load(): Promise<void> {
        const globalData = await this.loadGlobalTodos();
        this.storageService.loadAll('global', globalData);

        const workspaceData = this.context.workspaceState.get<TodoItem[]>(
            WORKSPACE_STORAGE_KEY,
            [],
        );
        this.storageService.loadAll('workspace', workspaceData);
    }

    startWatching(): void {
        const pattern = new vscode.RelativePattern(
            this.context.globalStorageUri,
            GLOBAL_TODOS_FILENAME,
        );
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.watcher.onDidChange(() => this.handleExternalChange());
        this.watcher.onDidCreate(() => this.handleExternalChange());
    }

    onExternalChange(callback: () => void): void {
        this.onExternalChangeCallback = callback;
    }

    private async handleExternalChange(): Promise<void> {
        if (this.suppressNextWatch) {
            this.suppressNextWatch = false;
            return;
        }
        const globalData = await this.loadGlobalTodos();
        this.storageService.loadAll('global', globalData);
        this.onExternalChangeCallback?.();
    }

    async save(scope: Scope): Promise<void> {
        const items = this.storageService.exportAll(scope);

        if (scope === 'global') {
            this.suppressNextWatch = true;
            await this.saveGlobalTodos(items);
        } else {
            await this.context.workspaceState.update(WORKSPACE_STORAGE_KEY, items);
        }
    }

    async saveAll(): Promise<void> {
        await this.save('global');
        await this.save('workspace');
    }

    dispose(): void {
        this.watcher?.dispose();
    }

    private async loadGlobalTodos(): Promise<TodoItem[]> {
        try {
            const content = await vscode.workspace.fs.readFile(this.globalFileUri);
            const json = Buffer.from(content).toString('utf8');
            return JSON.parse(json) as TodoItem[];
        } catch {
            return this.migrateFromGlobalState();
        }
    }

    private async saveGlobalTodos(items: TodoItem[]): Promise<void> {
        const json = JSON.stringify(items, null, 2);
        const content = Buffer.from(json, 'utf8');
        await vscode.workspace.fs.writeFile(this.globalFileUri, content);
    }

    private async migrateFromGlobalState(): Promise<TodoItem[]> {
        const legacyData = this.context.globalState.get<TodoItem[]>(LEGACY_GLOBAL_STORAGE_KEY, []);
        if (legacyData.length > 0) {
            await this.saveGlobalTodos(legacyData);
            await this.context.globalState.update(LEGACY_GLOBAL_STORAGE_KEY, undefined);
        }
        return legacyData;
    }
}
