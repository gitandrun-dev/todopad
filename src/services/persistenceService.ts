import * as vscode from 'vscode';
import { TodoItem, Scope } from '../models/todoItem';
import { StorageService } from './storageService';

const GLOBAL_STORAGE_KEY = 'todopad.globalTodos';
const WORKSPACE_STORAGE_KEY = 'todopad.workspaceTodos';

export class PersistenceService {
    constructor(
        private context: vscode.ExtensionContext,
        private storageService: StorageService,
    ) {}

    async load(): Promise<void> {
        this.setupSync();

        const globalData = this.context.globalState.get<TodoItem[]>(GLOBAL_STORAGE_KEY, []);
        this.storageService.loadAll('global', globalData);

        const workspaceData = this.context.workspaceState.get<TodoItem[]>(
            WORKSPACE_STORAGE_KEY,
            [],
        );
        this.storageService.loadAll('workspace', workspaceData);
    }

    async save(scope: Scope): Promise<void> {
        const items = this.storageService.exportAll(scope);

        if (scope === 'global') {
            await this.context.globalState.update(GLOBAL_STORAGE_KEY, items);
        } else {
            await this.context.workspaceState.update(WORKSPACE_STORAGE_KEY, items);
        }
    }

    async saveAll(): Promise<void> {
        await this.save('global');
        await this.save('workspace');
    }

    private setupSync(): void {
        const syncEnabled = vscode.workspace
            .getConfiguration('todopad')
            .get<boolean>('enableSync', true);
        if (syncEnabled) {
            this.context.globalState.setKeysForSync([GLOBAL_STORAGE_KEY]);
        } else {
            this.context.globalState.setKeysForSync([]);
        }
    }
}
