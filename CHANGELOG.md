# Changelog

All notable changes to Khaata are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.10.0] - 2026-10-09

### Added
- Monthly Review & Financial Health Scorecard (`Review.jsx`):
  - **Algorithmic Financial Health Score (0-100)**: Evaluates budget adherence, savings rate retention, burn rate pacing, and month-over-month trajectory into grades (A+, A, B, C, D).
  - **Dynamic Actionable Insights**: Context-aware observations highlighting savings benchmark adherence, budget risks, and top surging or shrinking spending categories.
  - **Month-over-Month (MoM) Comparison**: Side-by-side analysis comparing total spending, income retention, and transaction count against the previous calendar month.
  - **Category Spending Drift & Variance Table**: Granular breakdown calculating dollar variance and percentage changes across categories vs prior month.
  - Enhanced responsive cards, visual progress tracks, and full light/dark theme styling.
- `calculateFinancialHealth` analytics utility in `src/utils/calculations.js` with comprehensive unit test coverage.

## [1.9.0] - 2026-10-09

### Added
- Smart Statement Ingestion & CSV Reconciliation Engine (`src/utils/csvParser.js`):
  - Client-side parser for major Indian bank statement CSVs (HDFC, SBI, ICICI, Axis, Kotak, and generic formats).
  - Robust Indian & ISO date parsing (`DD/MM/YYYY`, `DD-MM-YYYY`, `DD Mon YYYY`, `YYYY-MM-DD`).
  - Automated merchant narration cleaner (`cleanNarration`) removing cryptic UPI prefixes (`UPI/REF/`, `POS `, `NEFT-`, card masks).
  - Predictive auto-categorization rule engine (`predictCategory`) mapping merchants to user categories (Swiggy/Zomato -> Food, Blinkit/Zepto -> Groceries, Uber/Ola -> Travel, etc.).
  - Duplicate detection engine flagging transactions that match existing records by amount, date, and merchant.
- Interactive Reconciliation Modal (`StatementImportModal.jsx`):
  - Drag-and-drop CSV upload zone with file selection fallback.
  - Target account selector linking imported transactions to user's bank accounts or cards.
  - Interactive transaction review table with category pickers, duplicate badges, and individual toggles.
  - Batch select/deselect controls with total amount calculation.
- Topbar "Import CSV" button and Settings "Import Statement (CSV)" shortcut.
- Full light & dark mode support and unit test coverage for parser routines.

## [1.8.0] - 2026-10-09

### Added
- Multi-Account & Payment Method Engine: support for Bank Accounts, Credit Cards, Cash, and Digital Wallets.
- Accounts & Liquidity Overview panel on Dashboard tracking Total Net Liquid Worth vs Credit Card Outstandings.
- Account / Payment Method selector in ExpenseForm for tagging expenses to specific accounts.
- Account tags on transaction rows in ExpenseList.
- Full Account management in Settings (adding accounts, starting balances, credit limits, setting default account).
- Idempotent migration script `supabase/migration_v3_accounts.sql` for adding accounts and linking to expenses.

## [1.7.1] - 2026-10-09

### Added
- Real-time spending pace and burn-rate intelligence card on Dashboard: tracks daily burn rate, projected month-end spend, safe daily budget allowance, and budget exhaustion date projections.
- Filter summary metric bar on History view displaying matched expense counts, filtered total sum, and average transaction amount.
- High-density responsive 2-column desktop layout on Dashboard, placing budget analytics and recent transactions side-by-side.

### Changed
- Expanded desktop application max-width to 1180px on displays >= 1100px.

## [1.7.0] - 2026-10-09

### Added
- Direct interactive month-picker jump functionality to MonthSelector.
- Normalized relational database schema with PostgreSQL tables for expenses, incomes, budgets, and recurring schedules with Row Level Security (RLS) and B-Tree indexes.
- Idempotent data unpacking script for existing users' JSON blobs.

### Changed
- Deconstructed monolithic App root component into modular hooks (useTrackerData, useAuth, useTheme) and an expense service layer.
- Added 350ms debounced cloud persistence to prevent network thrashing.
- Replaced aria-hidden progress bars with accessible progressbar semantics.

## [1.6.0] - 2026-10-04

### Added

- A persistent light/dark theme switch, available in the app header and on authentication and password-recovery screens.
- Dark theme styling across the dashboard, expense history, monthly review, settings, forms, charts, and dialogs.

## [1.5.1] - 2026-10-03

### Added

- Accessible native modal sheets for adding and editing expenses and income, with contained keyboard focus, Escape dismissal, and focus restoration.
- A skip-to-main-content link and current-page navigation state.
- Live announcements for sync, authentication, form errors, and successful settings actions.
- Expense-specific edit/delete labels and recurring-schedule removal names for assistive technology.

### Changed

- Recent expenses and History use a consistent, compact trash-icon action. Delete confirmation identifies the category, amount, and date before removing an expense.
- Expense groups show the number of entries displayed, and transaction rows keep descriptions, amounts, and actions aligned.
- History filters now reflow without horizontal scrolling on phone and tablet widths.
- Settings validation messages appear beside their own form, identify invalid fields, and move focus to the field that needs attention.
- Responsive header spacing keeps the brand, sync status, month navigation, and add action legible across viewport widths.
- Improved helper and sync-status text contrast, keyboard focus visibility, and reduced-motion behavior.

### Fixed

- Native date filters no longer exceed their grid columns on narrow screens.
- Budget and recurring-schedule errors no longer appear in the unrelated Data section.
- The sync status no longer inherits wordmark typography or its decorative brand mark.

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
