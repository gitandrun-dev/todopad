import * as vscode from 'vscode';
import { StorageService } from './services/storageService';
import { PersistenceService } from './services/persistenceService';
import { ReminderService } from './services/reminderService';
import { CodeScannerService } from './services/codeScannerService';
import { StatusBarService } from './services/statusBarService';
import { VscodeNotifier } from './services/vscodeNotifier';
import { TodoWebviewProvider } from './providers/todoWebviewProvider';
import { createSetReminderCommand } from './commands/setReminder';

export async function activate(context: vscode.ExtensionContext) {
    const storageService = new StorageService();
    const persistenceService = new PersistenceService(context, storageService);
    const reminderService = new ReminderService(storageService, new VscodeNotifier());
    const statusBarService = new StatusBarService(storageService);

    await persistenceService.load();
    statusBarService.update();

    reminderService.start();
    reminderService.onReminderFired(() => {
        persistenceService.saveAll();
        statusBarService.update();
        todoWebviewProvider.refresh();
    });
    reminderService.onDidCheck(() => statusBarService.update());

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
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TodoWebviewProvider.viewType,
            todoWebviewProvider,
        ),
    );

    context.subscriptions.push(reminderService);
    context.subscriptions.push(statusBarService);

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
