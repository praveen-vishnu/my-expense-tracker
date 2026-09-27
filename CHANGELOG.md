# Changelog

All notable changes to Khaata are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.5.1] - 2026-09-27

### Added

- Accessible native modal sheets for adding and editing expenses and income, with contained keyboard focus, Escape dismissal, and focus restoration.
- A skip-to-main-content link and current-page navigation state.
- Live announcements for sync, authentication, form errors, and successful settings actions.

### Changed

- History filters now reflow without horizontal scrolling on phone and tablet widths.
- Settings validation messages appear beside their own form, identify invalid fields, and move focus to the field that needs attention.
- Recurring schedule removal buttons identify the schedule they affect to assistive technology.
- Improved helper and sync-status text contrast, keyboard focus visibility, and reduced-motion behavior.

### Fixed

- Native date filters no longer exceed their grid columns on narrow screens.
- Budget and recurring-schedule errors no longer appear in the unrelated Data section.

## [1.5.0] - 2026-09-26

### Added

- Spending breakdown chart with a clear visual comparison across categories.

## [1.4.1] - 2026-09-25

### Removed

- Removed the Demo data section and its action from Settings.

## [1.4.0] - 2026-09-25

### Added

- Recurring monthly expense schedules.
- EMI schedules with installment counts and automatic stop dates.
- Automatic monthly expense generation without duplicate entries.
- Recurring schedule management from Settings.

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
