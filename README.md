<p align="center">
  <img src="https://raw.githubusercontent.com/gitandrun-dev/todopad/main/resources/icon.png" width="120" height="120" alt="TodoPad icon" />
</p>

<h1 align="center">TodoPad</h1>

<p align="center">
  <strong>Your tasks, right where you code.</strong><br/>
  Personal todos, project tasks, code comment scanning, Jira tickets, GitLab merge requests, GitHub pull requests, and reminders — all in your VS Code sidebar.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=gitandrun-dev.todopad">
    <img src="https://img.shields.io/visual-studio-marketplace/v/gitandrun-dev.todopad?label=Marketplace&color=6e56cf" alt="Marketplace Version" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=gitandrun-dev.todopad">
    <img src="https://img.shields.io/visual-studio-marketplace/i/gitandrun-dev.todopad?color=30d158" alt="Installs" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=gitandrun-dev.todopad">
    <img src="https://img.shields.io/visual-studio-marketplace/r/gitandrun-dev.todopad?color=f5a623" alt="Rating" />
  </a>
  <a href="https://github.com/gitandrun-dev/todopad/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/gitandrun-dev/todopad?color=6e56cf" alt="License" />
  </a>
</p>

<p align="center">
  <a href="#features">Features</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#jira-integration">Jira Integration</a> &middot;
  <a href="#git-merge-request-integration">Git MR/PR Integration</a> &middot;
  <a href="#configuration">Configuration</a> &middot;
  <a href="#support-the-project">Support</a>
</p>

<p align="center">
  Free forever. Fueled by caffeine and <a href="https://github.com/sponsors/gitandrun-dev"><b>sponsors</b></a>.
</p>

---

## Why TodoPad?

You already live in your editor. Why should your task list live somewhere else?

TodoPad gives you a clean, fast, keyboard-friendly task manager right in the sidebar — no accounts to create, no browser tabs to juggle, no sync services to configure. It works offline, starts instantly, and stays out of your way until you need it.

Whether you're tracking personal goals across projects, managing workspace-specific tasks with your team, or keeping an eye on your Jira backlog — TodoPad handles it without ever pulling you out of flow.

---

## Features

### Dual-Scope Tasks

Two task lists, one panel. Switch between them with a single click.

- **Global scope** — Personal tasks that follow you across all workspaces. Syncs across multiple VS Code windows in real time.
- **Workspace scope** — Project-specific tasks tied to the current workspace.

### Quick Add with Priority

Type a task and hit Enter. Append `!h` for high priority or `!l` for low — no menus, no friction.

```
Fix auth redirect bug !h
Update dependencies
Clean up old migrations !l
```

### Reminders That Actually Remind You

Set a date and time on any task. When it's due, TodoPad will:

- Show a notification with **Mark Done**, **Snooze**, and **Dismiss** actions
- Re-fire every 60 seconds if ignored — it won't let you forget
- Pulse the status bar bell so you never miss it
- Display a badge count on the sidebar icon

Reminders work on todos, Jira tickets, and merge requests. Snooze duration is configurable (default: 10 minutes). Reminders persist across editor restarts.

### Code TODO Scanner

TodoPad automatically finds `TODO`, `FIXME`, `HACK`, and `XXX` comments across your entire workspace. Results update in real-time as you save files.

- Click any result to jump directly to the line
- Supports 20+ languages: TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, C#, Ruby, PHP, Swift, Kotlin, Scala, shell scripts, YAML, TOML, and more
- Configurable include/exclude patterns

### Jira Integration

Connect your Jira Cloud instance to see your assigned tickets right alongside your todos.

- View tickets filtered by status, project, or custom JQL
- Separate filters for Global and Workspace scopes
- Set reminders on Jira tickets (same snooze/notification system as todos)
- Click to open any ticket in your browser
- Auto-refreshes on a configurable interval

### Git Merge Request Integration

Connect GitLab and GitHub (including self-hosted instances) to track merge requests and pull requests that need your attention.

- **Review Requested** — MRs/PRs where someone asked for your review, with reminder support so you don't forget
- **Assigned to Me** — Your own open MRs with live approval status (`0/2 Approved`, `1/3 Approved`, `Approved ✓`)
- Support for both platforms simultaneously (e.g. work GitLab + personal GitHub)
- Separate Global and Workspace scope filters
- Filter by project paths, toggle draft visibility
- Click to open any MR/PR in your browser
- Auto-refreshes on a configurable interval
- HTTPS enforced for all connections

### Drag & Drop Reordering

Grab any task and drag it to reorder. Your priority, your order.

### Rich Edit Modal

Click a task to open a detail editor — update the title, add a description, change priority, or set a reminder date. All without leaving the sidebar.

### Progress Tracking

A live progress bar at the top shows your completion rate at a glance. Satisfying to watch fill up.

### Status Bar Indicator

When reminders are due, a pulsing bell appears in your status bar with a count. Click it to jump straight to TodoPad.

---

## Getting Started

1. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=gitandrun-dev.todopad)
2. Click the TodoPad icon in the Activity Bar
3. Start typing tasks

No accounts. No configuration. No internet required.

---

## Jira Integration

1. Open the settings gear in the TodoPad panel
2. Navigate to Integrations > Jira
3. Enter your Jira Cloud URL, email, and an [API token](https://id.atlassian.com/manage-profile/security/api-tokens)
4. Click Connect

Once connected, your assigned tickets appear below your todo list. Filter them per-scope, set reminders, and click through to Jira when you need the full context.

---

## Git Merge Request Integration

### GitLab

1. Open the settings gear in the TodoPad panel
2. Navigate to Integrations > GitLab
3. Enter your GitLab URL (e.g. `https://gitlab.com` or your self-hosted instance)
4. Enter a Personal Access Token with `read_api` scope (generate one under Access Tokens in your GitLab user settings)
5. Click Connect

### GitHub

1. Open the settings gear in the TodoPad panel
2. Navigate to Integrations > GitHub
3. Enter a Personal Access Token ([generate one here](https://github.com/settings/tokens))
4. Click Connect

### How it works

Once connected, your merge requests appear in a collapsible section below your todos, grouped into:

- **Review Requested** — MRs/PRs where your review is needed. Set reminders on these so you don't forget.
- **Assigned to Me** — Your own open MRs. Shows approval progress (`1/2 Approved`) so you know when you can merge.

Configure workspace project paths in the settings to filter MRs for the current project only.

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `todopad.codeScan.enabled` | `true` | Scan workspace for TODO/FIXME/HACK/XXX comments |
| `todopad.codeScan.includePatterns` | `**/*.{ts,js,py,...}` | Glob pattern for files to scan |
| `todopad.codeScan.excludePatterns` | `**/node_modules/**,...` | Glob patterns to exclude from scanning |
| `todopad.snoozeDuration` | `10` | Snooze duration in minutes (1–1440) |

---

## Design Philosophy

- **Zero runtime dependencies.** Ships as a single bundled file. No `node_modules` at runtime.
- **Instant startup.** No network calls needed to show your tasks.
- **Theme-aware.** Every color adapts to your VS Code theme — light, dark, or high contrast.
- **Privacy-first.** Nothing is sent to external servers beyond your configured integrations.
- **Keyboard-friendly.** Quick-add from the input, Enter to submit, shortcuts for common actions.

---

## Support the Project

**TodoPad is free and always will be.** Sponsorships keep the caffeine flowing and the features shipping.

<a href="https://github.com/sponsors/gitandrun-dev">
  <img src="https://img.shields.io/badge/Sponsor_on_GitHub-ea4aaa?style=for-the-badge&logo=github-sponsors&logoColor=white" alt="Sponsor on GitHub" />
</a>

**Other ways to help:**

- Star the repo on [GitHub](https://github.com/gitandrun-dev/todopad)
- Leave a review on the [Marketplace](https://marketplace.visualstudio.com/items?itemName=gitandrun-dev.todopad)
- Share it with your team
- [Report bugs or suggest features](https://github.com/gitandrun-dev/todopad/issues)

---

## Contributing

Contributions are welcome! Fork the repo, create a branch, make your changes, and open a PR.

```bash
npm install       # Install dev dependencies
npm run build     # Build the extension
npm test          # Run tests
npm run format    # Format code with Prettier
```

Press `F5` to launch the Extension Development Host for testing.

---

## License

[MIT](LICENSE) — no strings attached. But a star or a [sponsor](https://github.com/sponsors/gitandrun-dev) never hurts.
