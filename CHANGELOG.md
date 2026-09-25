# Changelog

All notable changes to Khaata are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Recurring expenses and detailed EMI tracking
- Reports and charts

## [1.3.0] - 2026-09-25

### Changed

- Moved expense categories from frontend constants into the Supabase database.
- Added per-user category storage with row-level security.
- Added database seeding for starter categories on new accounts.
- Added migration support for categories already stored in existing payloads.

## [1.2.0] - 2026-09-25

### Added

- Expense history search by category and note.
- Category, date-range, minimum amount, and maximum amount filters.
- One-click filter reset and no-match feedback.

## [1.1.0] - 2026-09-25

### Added

- Monthly budgets stored per month and synced with the user's cloud data.
- Dashboard budget progress, remaining budget, and over-budget warning.
- Monthly budget editing from Settings.

## [1.0.0] - 2026-09-25

### Added

- Dashboard with monthly income, spending, remaining balance, and category breakdown.
- Expense creation, editing, deletion, notes, dates, and categories.
- Built-in EMI expense category.
- Income tracking by month.
- Expense history with category filtering.
- Monthly review with spending insights.
- Local import and export of tracker data.
- Supabase persistence with row-level security.
- Email/password authentication for cross-device access.
- Password recovery, account email display, and sign out.
- Cloud sync status feedback.
- Responsive mobile layout.
