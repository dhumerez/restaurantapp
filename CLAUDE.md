# Project Instructions

## Git Workflow — Feature Branching

Follow this workflow for ALL feature work:

### When starting a new feature:
1. Create a branch from `master` named `feature/<short-name>` (e.g., `feature/reports-dashboard`, `feature/discounts`)
2. Switch to the branch before making any changes

### While a feature is in progress (not complete):
1. Stage and commit all changes to the feature branch with a descriptive message
2. Do NOT push or merge — just commit locally

### When a feature is completed:
1. Commit any remaining changes to the feature branch
2. Push the branch to origin
3. Merge the feature branch into `master` (fast-forward or merge commit)
4. Push `master` to origin
5. Delete the feature branch locally and remotely

### Branch naming convention:
- `feature/<short-kebab-name>` — e.g., `feature/reports-dashboard`, `feature/manual-discounts`, `feature/table-transfer`

### Commit message style:
- `feat: <description>` for new features
- `fix: <description>` for bug fixes
- `chore: <description>` for maintenance
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
