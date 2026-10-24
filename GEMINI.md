# Workspace Boundary & Operational Guidelines

## 1. Strict Directory Boundary
- **WORKSPACE BOUNDARY**: All operations, file searches, reads, writes, and commands must strictly stay confined within `C:\Projects\SKIL Master`.
- **NO OUT-OF-BOUNDS ACCESS**: Never search, list, read, or inspect external directories (including `Downloads`, `Desktop`, or user profile folders) unless the user explicitly provides an external file path and explicitly asks to access it.
- All documents, bank statements, invoices, and vouchers must be sourced solely from within the workspace.

## 2. Dynamic Managed Directory Timestamps
- All managed document directories under `user-documents-read-only-access/` and `Tally Files` must adhere to the timestamp convention:
  `<Prefix> - last updated on <DD-MM-YYYY at HH-mm hrs>`
- Always invoke `sync-engine/folder-updater.js` (`FolderUpdater.updateAll()`) after adding or modifying files in these directories.
