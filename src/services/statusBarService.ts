import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { JiraService } from './jiraService';
import { GitMergeRequestService } from './gitMergeRequestService';
import { countDueReminders } from '../utils/dueReminders';

const PULSE_INTERVAL_MS = 1_100;

export class StatusBarService implements vscode.Disposable {
    private item: vscode.StatusBarItem;
    private pulseTimer: ReturnType<typeof setInterval> | undefined;
    private pulseOn = false;
    private dueCount = 0;
    private jiraService?: JiraService;
    private gitMergeRequestService?: GitMergeRequestService;

    constructor(private storageService: StorageService) {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10_000);
        this.item.command = 'todopadView.focus';
    }

    setJiraService(jiraService: JiraService): void {
        this.jiraService = jiraService;
    }

    setGitMergeRequestService(service: GitMergeRequestService): void {
        this.gitMergeRequestService = service;
    }

    update(): void {
        const todoCount = countDueReminders(
            (scope) => this.storageService.getAll(scope),
            Date.now(),
        );
        const jiraCount = this.countDueJiraReminders();
        const gitCount = this.countDueGitReminders();
        this.dueCount = todoCount + jiraCount + gitCount;

        if (this.dueCount > 0) {
            this.item.text = `$(bell) ${this.dueCount}`;
            this.item.tooltip = `${this.dueCount} reminder${this.dueCount > 1 ? 's' : ''} due \u2014 click to open TodoPad`;
            this.startPulse();
            this.item.show();
        } else {
            this.stopPulse();
            this.item.hide();
        }
    }

    private countDueJiraReminders(): number {
        if (!this.jiraService) {
            return 0;
        }
        const state = this.jiraService.getState();
        const now = Date.now();
        let count = 0;
        for (const reminderAt of Object.values(state.reminders)) {
            if (new Date(reminderAt).getTime() <= now) {
                count++;
            }
        }
        return count;
    }

    private countDueGitReminders(): number {
        if (!this.gitMergeRequestService) {
            return 0;
        }
        const state = this.gitMergeRequestService.getState();
        const now = Date.now();
        let count = 0;
        for (const platform of [state.gitlab, state.github]) {
            for (const reminderAt of Object.values(platform.reminders)) {
                if (new Date(reminderAt).getTime() <= now) {
                    count++;
                }
            }
        }
        return count;
    }

    private startPulse(): void {
        this.renderPulseFrame();
        if (this.pulseTimer) {
            return;
        }
        this.pulseTimer = setInterval(() => {
            this.pulseOn = !this.pulseOn;
            this.renderPulseFrame();
        }, PULSE_INTERVAL_MS);
    }

    private renderPulseFrame(): void {
        this.item.backgroundColor = this.pulseOn
            ? new vscode.ThemeColor('statusBarItem.warningBackground')
            : undefined;
    }

    private stopPulse(): void {
        if (this.pulseTimer) {
            clearInterval(this.pulseTimer);
            this.pulseTimer = undefined;
        }
        this.pulseOn = false;
    }

    dispose(): void {
        this.stopPulse();
        this.item.dispose();
    }
}
