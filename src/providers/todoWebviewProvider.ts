import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StorageService } from '../services/storageService';
import { PersistenceService } from '../services/persistenceService';
import { ReminderService } from '../services/reminderService';
import { CodeScannerService } from '../services/codeScannerService';
import { StatusBarService } from '../services/statusBarService';
import { JiraService } from '../services/jiraService';
import { createTodoItem, TodoItem } from '../models/todoItem';
import { WebviewMessage } from '../models/webviewMessages';
import { parseTitleWithPriority } from '../utils/parseTitle';
import { countDueReminders } from '../utils/dueReminders';

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
        private jiraService: JiraService,
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
            case 'toggleDone': {
                const markingDone = !msg.done;
                const updates: Partial<TodoItem> = { done: markingDone };
                if (markingDone) {
                    const items = this.storageService.getAll(msg.scope);
                    const item = items.find((t) => t.id === msg.id);
                    if (item?.reminderAt && new Date(item.reminderAt).getTime() <= Date.now()) {
                        updates.reminderAt = null;
                    }
                }
                this.storageService.update(msg.scope, msg.id, updates);
                await this.persistenceService.save(msg.scope);
                this.refresh();
                break;
            }
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
            case 'jiraConnect': {
                const result = await this.jiraService.connect(msg.url, msg.email, msg.token);
                if (result.success) {
                    this.refresh();
                } else {
                    this.sendJiraError(result.error || 'Connection failed');
                }
                break;
            }
            case 'jiraDisconnect':
                await this.jiraService.disconnect();
                this.refresh();
                break;
            case 'jiraSaveFilter':
                await this.jiraService.saveFilter(msg.config);
                this.refresh();
                break;
            case 'jiraRequestData':
                this.sendJiraState();
                break;
            case 'jiraRefresh':
                await this.jiraService.refreshTickets();
                this.refresh();
                break;
            case 'jiraOpenTicket': {
                const jiraState = this.jiraService.getState();
                const ticketUrl = msg.url;
                const isValidJiraUrl = jiraState.tickets.some((t) => t.url === ticketUrl);
                if (isValidJiraUrl) {
                    vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
                }
                break;
            }
        }
    }

    refresh(): void {
        this.statusBarService.update();
        this.updateBadge();

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
        this.sendJiraState();
    }

    private updateBadge(): void {
        if (!this._view) {
            return;
        }
        const dueCount = countDueReminders(
            (scope) => this.storageService.getAll(scope),
            Date.now(),
        );
        this._view.badge =
            dueCount > 0
                ? { tooltip: `${dueCount} reminder${dueCount > 1 ? 's' : ''} due`, value: dueCount }
                : undefined;
    }

    private sendJiraState(): void {
        if (!this._view) {
            return;
        }
        this._view.webview.postMessage({
            type: 'jiraUpdate',
            ...this.jiraService.getState(),
        });
    }

    private sendJiraError(error: string): void {
        if (!this._view) {
            return;
        }
        this._view.webview.postMessage({
            type: 'jiraError',
            error,
        });
    }

    private getHtml(): string {
        const htmlPath = path.join(this.extensionUri.fsPath, 'resources', 'webview.html');
        return fs.readFileSync(htmlPath, 'utf-8');
    }
}
