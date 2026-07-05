import * as vscode from 'vscode';
import { Scope } from '../models/todoItem';
import { StorageService } from '../services/storageService';
import { PersistenceService } from '../services/persistenceService';
import { ReminderService } from '../services/reminderService';
import { TodoWebviewProvider } from '../providers/todoWebviewProvider';

interface SetReminderDeps {
    storageService: StorageService;
    persistenceService: PersistenceService;
    reminderService: ReminderService;
    webviewProvider: TodoWebviewProvider;
}

export function createSetReminderCommand(deps: SetReminderDeps): () => Promise<void> {
    const { storageService, persistenceService, reminderService, webviewProvider } = deps;

    return async () => {
        const allItems: { label: string; description: string; scope: Scope; id: string }[] = [];
        for (const scope of ['global', 'workspace'] as Scope[]) {
            for (const item of storageService.getAll(scope)) {
                if (!item.done) {
                    allItems.push({
                        label: item.title,
                        description: `${scope} · ${item.reminderAt ? '\u23F0 ' + new Date(item.reminderAt).toLocaleString() : 'No reminder'}`,
                        scope,
                        id: item.id,
                    });
                }
            }
        }

        if (allItems.length === 0) {
            vscode.window.showInformationMessage('No active todos to set a reminder for.');
            return;
        }

        const picked = await vscode.window.showQuickPick(allItems, {
            placeHolder: 'Select a task to set a reminder for',
        });
        if (!picked) {
            return;
        }

        const dateStr = await vscode.window.showInputBox({
            prompt: 'Reminder date & time (YYYY-MM-DD HH:MM)',
            placeHolder: '2025-01-15 09:00',
            validateInput: (value) => {
                if (!value) {
                    return 'Enter a date and time';
                }
                const d = new Date(value.replace(' ', 'T'));
                if (isNaN(d.getTime())) {
                    return 'Use format YYYY-MM-DD HH:MM';
                }
                if (d.getTime() <= Date.now()) {
                    return 'Reminder must be in the future';
                }
                return null;
            },
        });
        if (!dateStr) {
            return;
        }

        const reminderAt = new Date(dateStr.replace(' ', 'T')).toISOString();
        storageService.update(picked.scope, picked.id, { reminderAt });
        reminderService.resetFired(picked.id);
        await persistenceService.save(picked.scope);
        webviewProvider.refresh();
        vscode.window.showInformationMessage(
            `\u23F0 Reminder set for "${picked.label}" at ${new Date(reminderAt).toLocaleString()}`,
        );
    };
}
