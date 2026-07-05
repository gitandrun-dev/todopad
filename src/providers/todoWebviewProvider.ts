import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StorageService } from '../services/storageService';
import { PersistenceService } from '../services/persistenceService';
import { ReminderService } from '../services/reminderService';
import { CodeScannerService } from '../services/codeScannerService';
import { StatusBarService } from '../services/statusBarService';
import { createTodoItem } from '../models/todoItem';
import { WebviewMessage } from '../models/webviewMessages';
import { parseTitleWithPriority } from '../utils/parseTitle';

export class TodoWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'todopadView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private storageService: StorageService,
        private persistenceService: PersistenceService,
        private reminderService: ReminderService,
        private codeScannerService: CodeScannerService,
        private statusBarService: StatusBarService,
    ) {
        codeScannerService.onDidChange(() => this.refresh());
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtml();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            await this.handleMessage(msg);
        });
    }

    private async handleMessage(msg: WebviewMessage): Promise<void> {
        switch (msg.type) {
            case 'quickAdd': {
                const { title, priority } = parseTitleWithPriority(msg.title);
                if (title) {
                    this.storageService.add(msg.scope, createTodoItem(title, { priority }));
                    await this.persistenceService.save(msg.scope);
                    this.refresh();
                }
                break;
            }
            case 'toggleDone':
                this.storageService.update(msg.scope, msg.id, { done: !msg.done });
                await this.persistenceService.save(msg.scope);
                this.refresh();
                break;
            case 'edit':
                this.storageService.update(msg.scope, msg.id, {
                    title: msg.title,
                    description: msg.description || '',
                    priority: msg.priority,
                    reminderAt: msg.reminderAt || null,
                });
                if (msg.reminderAt) {
                    this.reminderService.resetFired(msg.id);
                }
                await this.persistenceService.save(msg.scope);
                this.refresh();
                break;
            case 'delete':
                this.storageService.delete(msg.scope, msg.id);
                await this.persistenceService.save(msg.scope);
                this.refresh();
                break;
            case 'clearCompleted':
                this.storageService.clearCompleted(msg.scope);
                await this.persistenceService.save(msg.scope);
                this.refresh();
                break;
            case 'reorder':
                this.storageService.reorder(msg.scope, msg.id, msg.targetId);
                await this.persistenceService.save(msg.scope);
                this.refresh();
                break;
            case 'requestData':
                this.refresh();
                break;
            case 'openFile': {
                const uri = vscode.Uri.parse(msg.uri);
                const doc = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(doc);
                const position = new vscode.Position(msg.line, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter,
                );
                break;
            }
            case 'setReminder':
                this.storageService.update(msg.scope, msg.id, { reminderAt: msg.reminderAt });
                this.reminderService.resetFired(msg.id);
                await this.persistenceService.save(msg.scope);
                this.refresh();
                break;
            case 'clearReminder':
                this.storageService.update(msg.scope, msg.id, { reminderAt: null });
                await this.persistenceService.save(msg.scope);
                this.refresh();
                break;
        }
    }

    refresh(): void {
        this.statusBarService.update();

        if (!this._view) {
            return;
        }
        this._view.webview.postMessage({
            type: 'update',
            data: {
                global: this.storageService.getAll('global'),
                workspace: this.storageService.getAll('workspace'),
                codeTodos: this.codeScannerService.getFileGroups(),
            },
        });
    }

    private getHtml(): string {
        const htmlPath = path.join(this.extensionUri.fsPath, 'resources', 'webview.html');
        return fs.readFileSync(htmlPath, 'utf-8');
    }
}
