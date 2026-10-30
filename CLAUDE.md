# CLAUDE.md

## Project Overview

Wooldanji Admin — a Next.js (App Router) admin dashboard built with TypeScript, Supabase, TanStack React Query, and Mantine v9 (with Tailwind CSS v4 for a few utilities).

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Database / Auth**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **Data Fetching**: TanStack React Query v5, `@supabase-cache-helpers/postgrest-react-query`
- **UI**: Mantine v9 (`@mantine/core`, `@mantine/hooks`, `@mantine/modals`), Tailwind CSS v4 (utilities only), `lucide-react`, `recharts`, `sonner`
- **DnD**: `@dnd-kit`
- **Date**: `date-fns`

## Commands

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npm run start      # Start production server
```

## UI Rules (Mantine)

The UI is Mantine v9. Pre-migration backup: `backup/pre-mantine` branch / `pre-mantine` tag.

### 1. NEVER change logic when working on UI

- UI/design work changes only the **rendering layer** (JSX, component imports, styling).
- **Do NOT modify**: custom hooks (`use*.ts`), Supabase queries, React Query keys/mutations, API routes (`app/api/**`), types, validation rules, permission checks, event handler bodies, state shape, routing/navigation, loading conditions.
- Behavior must stay identical: same fields, default values, validation/error messages, toasts, confirm dialogs, loading/disabled states, empty states, sorting/filtering/pagination, user-facing copy, and where buttons/back actions navigate.
- If a component needs a different value shape (e.g. Mantine `Select` returns `string | null`), adapt it **in the JSX at the call site** — never change the hook to fit the component.
- Some `page.tsx` files still contain logic. Leave that logic exactly as is and change only the JSX.
- If a change truly cannot be made without touching logic, **stop and ask** first — explain why. Logic changes happen only when the user explicitly approves them (e.g. bug fixes), as a separate change.
- After UI work, verify: the code outside JSX `return (...)` blocks is unchanged, no Korean copy was lost, `npx tsc --noEmit` shows no new errors, `npm run build` passes.

### 2. Functional UX changes: propose, don't apply

- Visual changes (spacing, grouping, component choice, hierarchy) are fine. Changes to *what users can do or see* need approval: adding/removing fields or columns, flows, confirmations, copy, defaults.
- Report proposals as a list: **위치** (`file:line`) · **현재** · **문제** · **제안**. Apply only after approval.

### 3. Design system — `lib/theme.ts` is the single source of truth

Reference: `/Users/hyeonwoo/Code/banselin-admin-code` (Skote admin template), adjusted per user feedback. Change tokens in the theme, never per page.

- **Colors**: primary `#556ee6` (Mantine `blue`), success `#34c38f` (`green`), danger `#f46a6a` (`red`), warning `#f1b44c` (`yellow`), info `#50a5f1` (`cyan`). Text `#495057`, dimmed `#5f6478`, page bg `#f8f8fb`. Dark mode: text pure white, `light` variants are soft translucent tints (never saturated).
- **No hardcoded colors**: use color props (`color="red"`, `c="dimmed"`) and theme variables (`--app-bg-muted`, `--app-bg-subtle`, `--app-divider`, `--app-input-bg`, `--mantine-color-<color>-light`). Never fixed light shades (`gray.0`, `blue.0`) — dark mode must work.
- **No borders**: separate areas with background, shadow and spacing. Cards have no outline (theme makes `withBorder` transparent; a card inside a card gets a light gray background). Gray/default buttons and filter chips are light-gray filled. Never `variant="outline"` — use `light`. If a separator is really needed, use `var(--app-divider)` (Divider and Table already default to it).
- **Typography**: Pretendard; body 16px (`1rem`); always rem units; minimum font weight 500 (never 300/400); page title 1.375rem / 600.
- **Sizes**: inputs and buttons 48px (default `sm`); filter chips 36px; pagination (이전·다음·page numbers) all 36px on one line (`size="xs"` buttons, theme sizes `Pagination`); icon buttons and small buttons inside tables 36px. Radius: controls 0.5rem (`sm`), cards 0.75rem (`md`).
- **Inputs**: Toss-style `variant="filled"` (theme default) — no border, light blue-gray background, primary border only on focus.
- **Badges**: always `variant="light"`, weight 700 from the theme — don't override `fw`.
- **Scrollbars**: thin and light gray site-wide (`globals.css`, base layer); the sidebar hides its scrollbar.
- Prefer Mantine layout components (`Stack`, `Group`, `SimpleGrid`, `Flex`) and style props over Tailwind. Check component APIs with the Mantine MCP server (`mcp__mantine__*`).

### 4. Page patterns

- **Shell**: dark navy sidebar with collapsible sections (no icons/numbers in the expanded state; icons only in the 70px collapsed rail), white 70px header with breadcrumb, dark-mode toggle, user menu.
- **List pages**: `PageShell` → `PageHeader` (title, description, actions) → `DataTableShell`:
  - `toolbar` = ONE filter card: search/selects row, `Divider`, then one `FilterRow label="…"` per `FilterChips` group (pill chips with counts; 0 counts dimmed).
  - `summary` = line at the top of the table card ("총 N건", totals).
  - Tables: gray header, centered one-line cells, unique `key`s.
- **Detail / edit / new pages**: put the title + back button in the header with `<HeaderTitle title="…" onBack={…} />` (`@/components/header-title`) instead of a title row in the body. Description text and page actions stay in the body. Two-column layout on PC (content left, sticky info/actions right); merge related actions into one "관리" card instead of one card per button; stats as tile grids; avoid long repetitive lists (group identical rows).
- **Loading**: never replace the whole page with a spinner/text. List pages render header + filters immediately and show `TableSkeleton` (real column count) in the table card; detail/form pages use `DetailSkeleton`. Spinners only inside buttons/uploads.
- **Empty states**: `EmptyState` or a centered icon + dimmed text; side-by-side cards keep equal height.
- **Dialogs**: `Modal`; confirmations via `confirmModal()` (`@/components/confirm-modal`), never native `confirm()`. Disable buttons and block close (`closeOnClickOutside`/`closeOnEscape`) while processing.

### 5. Responsive — every page must fully work on phones (48em and below)

- All information must be visible and every action (register, edit, approve) must work on a phone. Never hide columns or data on mobile.
- Tables automatically become a card list on phones (one row = one card, "column name : value"; labels come from `useTableCardLabels`). Add `data-no-cards` to a `<table>` only if it must stay a table.
- Filter rows stack (label above chips); form/filter inputs go full width; dialogs open full screen; the header shows only the current page title.
- Check new/changed pages at 390px width.

### 6. React keys

- Keys must be unique and stable. Never use display text (labels, names) alone as a key when duplicates are possible — use an id, or `${name}-${index}` for plain string lists, or a dedicated `key` field for config-built rows.

### 7. Component mapping (from shadcn/Radix)

| shadcn/ui | Mantine |
|---|---|
| `Select` | `Select` (**always `allowDeselect={false}`** unless clearing is intended) |
| `Dialog`, `AlertDialog` | `Modal`. `AlertDialogAction`/`Cancel` auto-closed the dialog — replicate with `onClick={() => { action(); close(); }}`. Former AlertDialogs → `closeOnClickOutside={false} withCloseButton={false}` |
| `DropdownMenu` | `Menu` |
| `Command` / combobox | `Select searchable` (use `onOptionSubmit` if a side effect must re-run on re-select) |
| `Sheet` | `Drawer` |
| `Collapsible` | `Collapse` |

### 8. Workflow

- Don't commit unless the user asks. Keep changes in the working tree so the user can review or revert.
- Verify visually: capture the page (PC and 390px phone width) and fix what looks wrong before reporting. `globals.css` changes need a dev-server restart (or check on a production build).

## Project Structure

```
app/               # Next.js App Router pages & layouts
components/        # Shared React components (page shell, table shell, filter chips, header title, skeletons, ...)
lib/               # Utilities, Supabase clients, helpers
  supabase/        # Supabase client/server/middleware/types
  utils/           # Utility functions (format, storage, line)
```

## Code Conventions

### 1. Separate Business Logic from UI Using Custom Hooks

- **Do NOT** put business logic (data fetching, mutations, state management, transformations, validation) directly inside page or component files.
- **Always extract business logic into custom hooks** (`use*.ts`) co-located next to the page or component that uses them.
- Page/component files should only handle **rendering** — all logic lives in custom hooks.
- Custom hooks encapsulate: Supabase queries, React Query calls, mutations, form state, event handlers, and any derived/computed state.

#### File Structure

Simple pages (single hook is enough):

```
app/admin/users/
  page.tsx              # UI only — imports and calls useUsersPage()
  useUsersPage.ts       # Custom hook — all business logic for this page
  types.ts              # (optional) Feature-specific types
```

Complex pages (compose small hooks):

```
app/admin/apartments/[id]/devices/
  page.tsx              # UI only
  types.ts              # All types + per-hook return type interfaces
  useDevicesPage.ts     # Composition hook — wires sub-hooks together
  hooks/
    useDevicesFetch.ts      # Data fetching & permission checks
    useDeviceDialog.ts      # Add/edit dialog state & mutations
    useQuickAdd.ts          # Inline quick-add form & optimistic UI
    useDeviceSelection.ts   # Checkbox selection & delete (single/bulk)
    useTreeExpand.ts        # Tree expand/collapse state
```

#### When to Split: Single Hook vs Composition

Use a **single hook** when the page is simple (< ~200 lines of logic, < ~10 return values).

Switch to **hook composition** when ANY of these apply:
- The hook returns more than ~15 values (sign of a God Hook).
- The hook has multiple independent concerns (fetching, dialogs, selection, tree state).
- You find yourself passing 10+ props down to sub-components (prop drilling).
- Different parts of the state have no dependency on each other.

#### Hook Composition Pattern

**1. Each sub-hook has a single responsibility** and declares its own return type:

```typescript
// hooks/useTreeExpand.ts
export function useTreeExpand(): UseTreeExpandReturn {
  const [expandedBuildings, setExpandedBuildings] = useState<string[]>([]);
  // ...
  return { expandedBuildings, toggleBuilding, expandedLines, toggleLine, ensureLineExpanded };
}
```

**2. Sub-hooks that need external data declare a Deps interface:**

```typescript
// hooks/useQuickAdd.ts
interface UseQuickAddDeps {
  supabase: SupabaseClient;
  apartment: ApartmentDetails | null;
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  ensureLineExpanded: (lineKey: string) => void;   // from useTreeExpand
}

export function useQuickAdd({ supabase, apartment, setDevices, ensureLineExpanded }: UseQuickAddDeps): UseQuickAddReturn {
  // ...
}
```

**3. The composition hook wires everything together** and adds derived state:

```typescript
// useDevicesPage.ts
export function useDevicesPage(params: Promise<{ id: string }>): UseDevicesPageReturn {
  const supabase = createClient();

  // Compose sub-hooks (order matters — later hooks depend on earlier ones)
  const fetchHook = useDevicesFetch(supabase, params);
  const treeHook = useTreeExpand();
  const dialogHook = useDeviceDialog({ supabase, apartment: fetchHook.apartment, fetchData: fetchHook.fetchData });
  const quickAddHook = useQuickAdd({ supabase, apartment: fetchHook.apartment, setDevices: fetchHook.setDevices, ensureLineExpanded: treeHook.ensureLineExpanded });
  const selectionHook = useDeviceSelection({ supabase, devices: fetchHook.devices, setDevices: fetchHook.setDevices, fetchData: fetchHook.fetchData });

  // Derived state (useMemo)
  const filteredDevices = useMemo<Device[]>(() => { ... }, [fetchHook.devices, searchTerm]);

  // Return namespaced groups — NOT 30+ flat values
  return {
    fetch: fetchHook,
    tree: treeHook,
    dialog: dialogHook,
    quickAdd: quickAddHook,
    selection: selectionHook,
    filteredDevices,
    searchTerm, setSearchTerm,
    // ...
  };
}
```

**4. The page consumes namespaced groups** to pass to sub-components cleanly:

```typescript
// page.tsx
export default function DevicesManagementPage({ params }) {
  const page = useDevicesPage(params);

  return (
    <>
      <TreeView tree={page.tree} quickAdd={page.quickAdd} selection={page.selection} />
      <DeviceDialog dialog={page.dialog} apartment={page.fetch.apartment} />
    </>
  );
}
```

#### Custom Hook Guidelines

- Name the hook after its page/component: `useUsersPage`, `useDevicesPage`, `useEditApartment`, etc.
- Define and export a return type interface (e.g., `UseUsersPageReturn`) for every custom hook.
- Keep shared/reusable hooks in `lib/hooks/` — page-specific hooks stay co-located in `hooks/`.
- Sub-hooks declare their dependencies via a `Deps` interface — never reach for global state.
- The composition hook is the **only place** that creates the Supabase client and wires dependencies.
- Return namespaced groups (`fetch`, `tree`, `dialog`) instead of flat values to reduce prop drilling.

### 2. Types Must Live in a Dedicated Types Folder

- Define all shared types/interfaces under `lib/supabase/types.ts` or a dedicated `types/` directory.
- **Always import types** from the types folder — never re-declare them inline.
- Database-generated types belong in `lib/supabase/types.ts`.
- Feature-specific types can be co-located as `types.ts` within their feature folder, but must still be in a separate file.

### 3. Every Function Must Have Explicit Type Annotations

- All function parameters **must** have type annotations.
- All function return types **must** be explicitly declared.
- This applies to: regular functions, arrow functions, React components (props), hooks, utilities, API handlers.

```typescript
// BAD
function formatDate(date) { ... }
const getUser = async (id) => { ... }

// GOOD
function formatDate(date: Date): string { ... }
const getUser = async (id: string): Promise<User | null> => { ... }
```

### 4. General Rules

- Use `"use client"` directive only when client-side APIs (hooks, event handlers, browser APIs) are needed.
- Prefer named exports over default exports for non-page modules.
- Use path aliases (`@/lib/...`, `@/components/...`) for imports.

## Language

- **Always respond in Korean (한국어) at the end of conversations.**
