import * as vscode from 'vscode';
import { StorageService } from './services/storageService';
import { PersistenceService } from './services/persistenceService';
import { ReminderService } from './services/reminderService';
import { CodeScannerService } from './services/codeScannerService';
import { StatusBarService } from './services/statusBarService';
import { JiraService } from './services/jiraService';
import { GitMergeRequestService } from './services/gitMergeRequestService';
import { VscodeNotifier } from './services/vscodeNotifier';
import { TodoWebviewProvider } from './providers/todoWebviewProvider';
import { createSetReminderCommand } from './commands/setReminder';
import { countDueReminders } from './utils/dueReminders';

export async function activate(context: vscode.ExtensionContext) {
    const storageService = new StorageService();
    const persistenceService = new PersistenceService(context, storageService);
    const reminderService = new ReminderService(storageService, new VscodeNotifier());
    const statusBarService = new StatusBarService(storageService);
    const jiraService = new JiraService(context);
    const gitMergeRequestService = new GitMergeRequestService(context);
    statusBarService.setJiraService(jiraService);

    // TreeView used solely for the activity bar badge. WebviewView.badge only works
    // after the panel is opened, but TreeView.badge works immediately on activation.
    const badgeView = vscode.window.createTreeView('todopadBadge', {
        treeDataProvider: { getTreeItem: (e) => e, getChildren: () => [] },
    });
    context.subscriptions.push(badgeView);

    function updateActivityBadge(): void {
        const todoCount = countDueReminders((scope) => storageService.getAll(scope), Date.now());
        const jiraState = jiraService.getState();
        const now = Date.now();
        let jiraCount = 0;
        for (const reminderAt of Object.values(jiraState.reminders)) {
            if (new Date(reminderAt).getTime() <= now) {
                jiraCount++;
            }
        }
        let gitCount = 0;
        const gitState = gitMergeRequestService.getState();
        for (const platform of [gitState.gitlab, gitState.github]) {
            for (const reminderAt of Object.values(platform.reminders)) {
                if (new Date(reminderAt).getTime() <= now) {
                    gitCount++;
                }
            }
        }
        const total = todoCount + jiraCount + gitCount;
        badgeView.badge =
            total > 0
                ? { tooltip: `${total} reminder${total > 1 ? 's' : ''} due`, value: total }
                : undefined;
    }

    const codeScannerService = new CodeScannerService();
    codeScannerService.initialize();
    context.subscriptions.push(codeScannerService);

    const todoWebviewProvider = new TodoWebviewProvider(
        context.extensionUri,
        storageService,
        persistenceService,
        reminderService,
        codeScannerService,
        statusBarService,
        jiraService,
        gitMergeRequestService,
    );
    todoWebviewProvider.onDidRefresh(() => updateActivityBadge());

    await persistenceService.load();
    statusBarService.update();
    updateActivityBadge();

    jiraService.onReminderFired((ticketKey, summary, url) => {
        todoWebviewProvider.refresh();
        updateActivityBadge();
        const snoozeMins = vscode.workspace
            .getConfiguration('todopad')
            .get<number>('snoozeDuration', 10);
        vscode.window
            .showInformationMessage(
                `\u23F0 Reminder: ${ticketKey} - ${summary}`,
                'Open Ticket',
                `Snooze ${snoozeMins}m`,
            )
            .then((choice) => {
                if (choice === 'Open Ticket') {
                    vscode.env.openExternal(vscode.Uri.parse(url));
                    jiraService.clearReminder(ticketKey);
                    todoWebviewProvider.refresh();
                } else if (choice?.startsWith('Snooze')) {
                    const newTime = new Date(Date.now() + snoozeMins * 60_000).toISOString();
                    jiraService.setReminder(ticketKey, newTime);
                    todoWebviewProvider.refresh();
                }
            });
    });

    jiraService.initialize().then(() => {
        todoWebviewProvider.refresh();
        updateActivityBadge();
    });

    gitMergeRequestService.onReminderFired((platform, mergeRequestId, title, url) => {
        todoWebviewProvider.refresh();
        updateActivityBadge();
        const snoozeMins = vscode.workspace
            .getConfiguration('todopad')
            .get<number>('snoozeDuration', 10);
        vscode.window
            .showInformationMessage(`\u23F0 Review: ${title}`, 'Open MR', `Snooze ${snoozeMins}m`)
            .then((choice) => {
                if (choice === 'Open MR') {
                    vscode.env.openExternal(vscode.Uri.parse(url));
                    gitMergeRequestService.clearReminder(mergeRequestId);
                    todoWebviewProvider.refresh();
                } else if (choice?.startsWith('Snooze')) {
                    const newTime = new Date(Date.now() + snoozeMins * 60_000).toISOString();
                    gitMergeRequestService.setReminder(mergeRequestId, newTime);
                    todoWebviewProvider.refresh();
                }
            });
    });

    gitMergeRequestService.initialize().then(() => {
        todoWebviewProvider.refresh();
        updateActivityBadge();
    });

    reminderService.onReminderFired(() => {
        persistenceService.saveAll();
        statusBarService.update();
        updateActivityBadge();
        todoWebviewProvider.refresh();
    });
    reminderService.onDidCheck(() => {
        statusBarService.update();
        updateActivityBadge();
        todoWebviewProvider.refresh();
    });
    reminderService.start();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TodoWebviewProvider.viewType,
            todoWebviewProvider,
        ),
    );

    context.subscriptions.push(reminderService);
    context.subscriptions.push(statusBarService);
    context.subscriptions.push(jiraService);
    context.subscriptions.push(gitMergeRequestService);

    context.subscriptions.push(
        vscode.commands.registerCommand('todopad.refresh', () => {
            todoWebviewProvider.refresh();
        }),
        vscode.commands.registerCommand(
            'todopad.setReminder',
            createSetReminderCommand({
                storageService,
                persistenceService,
                reminderService,
                webviewProvider: todoWebviewProvider,
            }),
        ),
    );
}

export function deactivate() {}
