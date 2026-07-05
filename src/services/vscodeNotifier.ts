import * as vscode from 'vscode';
import { ReminderNotifier } from './reminderService';

export class VscodeNotifier implements ReminderNotifier {
    showReminder(title: string, _id: string, actions: string[]): Promise<string | undefined> {
        return Promise.resolve(
            vscode.window.showInformationMessage(`\u23F0 Reminder: ${title}`, ...actions),
        );
    }

    getSnoozeDuration(): number {
        return vscode.workspace.getConfiguration('todopad').get<number>('snoozeDuration', 10);
    }
}
