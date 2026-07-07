import { Priority, Scope } from './todoItem';
import { JiraScopeConfig } from './jiraTypes';

export type WebviewMessage =
    | { type: 'quickAdd'; title: string; scope: Scope }
    | { type: 'toggleDone'; scope: Scope; id: string; done: boolean }
    | {
          type: 'edit';
          scope: Scope;
          id: string;
          title: string;
          description: string;
          priority: Priority;
          reminderAt: string | null;
      }
    | { type: 'delete'; scope: Scope; id: string }
    | { type: 'clearCompleted'; scope: Scope }
    | { type: 'reorder'; scope: Scope; id: string; targetId: string }
    | { type: 'requestData' }
    | { type: 'openFile'; uri: string; line: number }
    | { type: 'setReminder'; scope: Scope; id: string; reminderAt: string }
    | { type: 'clearReminder'; scope: Scope; id: string }
    | { type: 'jiraConnect'; url: string; email: string; token: string }
    | { type: 'jiraDisconnect' }
    | {
          type: 'jiraSaveSettings';
          globalConfig: JiraScopeConfig;
          workspaceConfig: JiraScopeConfig;
      }
    | { type: 'jiraRequestData' }
    | { type: 'jiraRefresh' }
    | { type: 'jiraOpenTicket'; url: string }
    | { type: 'jiraSetReminder'; ticketKey: string; reminderAt: string }
    | { type: 'jiraClearReminder'; ticketKey: string };
