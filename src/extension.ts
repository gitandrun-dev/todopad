import * as vscode from 'vscode';
import { StorageService } from './services/storageService';
import { PersistenceService } from './services/persistenceService';
import { ReminderService } from './services/reminderService';
import { CodeScannerService } from './services/codeScannerService';
import { StatusBarService } from './services/statusBarService';
import { JiraService } from './services/jiraService';
import { VscodeNotifier } from './services/vscodeNotifier';
import { TodoWebviewProvider } from './providers/todoWebviewProvider';
import { createSetReminderCommand } from './commands/setReminder';

export async function activate(context: vscode.ExtensionContext) {
    const storageService = new StorageService();
    const persistenceService = new PersistenceService(context, storageService);
    const reminderService = new ReminderService(storageService, new VscodeNotifier());
    const statusBarService = new StatusBarService(storageService);
    const jiraService = new JiraService(context);
    statusBarService.setJiraService(jiraService);

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
    );

    await persistenceService.load();
    statusBarService.update();

    jiraService.onReminderFired((ticketKey, summary, url) => {
        todoWebviewProvider.refresh();
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
    });

    reminderService.start();
    reminderService.onReminderFired(() => {
        persistenceService.saveAll();
        statusBarService.update();
        todoWebviewProvider.refresh();
    });
    reminderService.onDidCheck(() => todoWebviewProvider.refresh());

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TodoWebviewProvider.viewType,
            todoWebviewProvider,
        ),
    );

    context.subscriptions.push(reminderService);
    context.subscriptions.push(statusBarService);
    context.subscriptions.push(jiraService);

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
