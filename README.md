<p align="center">
  <img src="resources/icon.svg" width="80" height="80" alt="TodoPad icon" />
</p>

<h1 align="center">TodoPad</h1>

<p align="center">
  A fast, beautiful task manager that lives in your VS Code sidebar.<br/>
  Manage personal and project todos without leaving your editor.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=gitandrun-dev.todopad">
    <img src="https://img.shields.io/visual-studio-marketplace/v/gitandrun-dev.todopad?label=VS%20Code%20Marketplace&color=6e56cf" alt="Marketplace Version" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=gitandrun-dev.todopad">
    <img src="https://img.shields.io/visual-studio-marketplace/i/gitandrun-dev.todopad?color=30d158" alt="Installs" />
  </a>
  <img src="https://img.shields.io/github/license/gitandrun-dev/todopad?color=6e56cf" alt="License" />
</p>

---

## Features

### 🎯 Dual-Scope Task Management

Organize tasks into two scopes that fit how developers actually work:

- **User TODOs** — Personal tasks that follow you across all workspaces. Syncs via VS Code Settings Sync.
- **Workspace TODOs** — Project-specific tasks. Keep them private or commit them to git for your team.

### ⚡ Quick Add with Priority Shorthand

Add tasks instantly from the sidebar input. Append `!h` for high priority or `!l` for low:

```
Fix auth redirect bug !h
Update README
Refactor tests later !l
```

### 🔍 Code TODO Scanner

Automatically finds `TODO`, `FIXME`, `HACK`, and `XXX` comments across your codebase. Click any result to jump directly to the line.

Supports 20+ languages out of the box — TypeScript, Python, Java, Go, Rust, C/C++, Ruby, PHP, Swift, Kotlin, and more.

### 🖱️ Drag & Drop Reordering

Reorder tasks by dragging them within a scope. Prioritize what matters right now.

### ✏️ Rich Edit Modal

Click any task to open a detail editor with title, description, priority, and due date fields — all without leaving the sidebar.

### 📊 Progress Tracking

A live progress bar shows completion across all tasks at a glance.

### 🔄 Settings Sync Support

User-level TODOs sync across all your machines automatically when VS Code Settings Sync is enabled. No extra setup needed.

### 🤝 Team Sharing

Workspace TODOs are saved to `.vscode/todos.json` — commit it to share tasks with your team, or add it to `.gitignore` to keep them private.

---

## Getting Started

1. Install TodoPad from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=gitandrun-dev.todopad)
2. Click the TodoPad icon in the Activity Bar
3. Start adding tasks

That's it. No accounts, no configuration, no internet required.

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `todopad.enableSync` | `true` | Sync user TODOs across machines via Settings Sync. |
| `todopad.codeScan.enabled` | `true` | Enable automatic scanning of code comments. |
| `todopad.codeScan.includePatterns` | `**/*.{ts,tsx,js,...}` | Glob pattern for files to scan. |
| `todopad.codeScan.excludePatterns` | `**/node_modules/**,...` | Glob patterns for files to exclude. |

---

## Architecture

```
src/
├── extension.ts              # Activation, command & view registration
├── commands/
│   ├── addTodo.ts            # Quick add & detailed add flows
│   └── todoActions.ts        # Toggle, edit, delete, priority, move
├── models/
│   ├── todoItem.ts           # Core task data model
│   └── codeTodoItem.ts       # Code comment TODO model
├── providers/
│   ├── todoWebviewProvider.ts   # Sidebar webview panel
│   ├── todoTreeProvider.ts      # Native tree view with drag & drop
│   └── codeTodoTreeProvider.ts  # Code TODOs tree grouped by file
├── services/
│   ├── storageService.ts     # In-memory store with CRUD & reorder
│   ├── persistenceService.ts # Dual-mode persistence (state vs file)
│   └── codeScannerService.ts # Workspace-wide comment scanner
└── utils/
    └── parseTitle.ts         # Priority shorthand parser
```

Key design decisions:
- **Separation of concerns** — Storage, persistence, and UI are fully decoupled
- **Webview + Tree View** — Rich sidebar UI for daily use, native tree for code TODOs
- **Event-driven scanning** — File watcher with debouncing for real-time code TODO updates
- **Zero dependencies** — No runtime dependencies beyond the VS Code API

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode (rebuilds on change)
npm run watch

# Run tests
npm test

# Lint
npm run lint
```

Press `F5` in VS Code to launch the Extension Development Host for testing.

---

## Contributing

Contributions are welcome! Here's how to help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-idea`)
3. Make your changes
4. Run `npm test` and `npm run lint`
5. Open a Pull Request

### Ideas for contribution

- [ ] Recurring tasks / reminders
- [ ] Markdown export
- [ ] Keyboard shortcuts for common actions
- [ ] Task categories / tags
- [ ] Integration with GitHub Issues

---

## Support

If you find TodoPad useful, consider supporting its development:

<a href="https://github.com/sponsors/gitandrun-dev">
  <img src="https://img.shields.io/badge/Sponsor-❤️-ea4aaa?style=for-the-badge" alt="Sponsor" />
</a>

- ⭐ Star the repo on [GitHub](https://github.com/gitandrun-dev/todopad)
- 📢 Share it with your team
- 🐛 Report bugs or suggest features via [Issues](https://github.com/gitandrun-dev/todopad/issues)

---

## License

[MIT](LICENSE) © TodoPad
