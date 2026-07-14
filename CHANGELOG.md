# Changelog

All notable changes to TodoPad are documented here.

## [1.1.0]

### Added
- Jira ticket grouping: organize tickets by Issue Type, Priority, Project, Parent/Epic, or Label via a new "Group tickets by" setting in Jira configuration.
- Clickable Jira ticket IDs: ticket keys now underline on hover to indicate they open the ticket in your browser.
- Parent/Epic group headers show the parent key as a clickable link to open the parent ticket directly.
- Colored group headers for Issue Type grouping.

### Changed
- Jira API requests now fetch additional fields (issue type, priority, labels, parent) for grouping support.

## [1.0.4]

### Fixed
- Custom JQL now actually queries the Jira API instead of being ignored. Previously, the fetch always used `assignee = currentUser()` regardless of custom JQL settings.
- Global and workspace scopes fetch tickets independently when custom JQL is set, so each scope can have its own query.
- Pre-encoded values in custom JQL (e.g. `%3A` in account IDs) no longer get double-encoded, which caused empty results.

## [1.0.3]

### Added
- Demo GIF in the README and marketplace listing so you can see TodoPad in action before installing.
- Open VSX install link for Cursor, Windsurf, VSCodium, and other VS Code forks.

Note: no functional changes to the extension in this release — docs and listing only.

## [1.0.2]

### Fixed
- Workspace badge count no longer includes hidden Jira tickets and merge requests.

## [1.0.1]

### Changed
- Minor fixes and polish following the initial release.

## [1.0.0]

### Added
- Global and per-workspace task lists.
- Quick-add with priority flags (`!h` / `!l`), drag-and-drop reordering, and a progress bar.
- Reminders on any task with VS Code notifications (Mark Done / Snooze / Dismiss) that re-fire if ignored and persist across restarts.
- Code comment scanner for TODO/FIXME/HACK/XXX across 20+ languages.
- Jira integration for assigned tickets.
- GitLab and GitHub integration for merge requests and pull requests, including self-hosted instances and approval status.
