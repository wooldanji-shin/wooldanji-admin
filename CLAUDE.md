# CLAUDE.md

## Project Overview

Wooldanji Admin — a Next.js (App Router) admin dashboard built with TypeScript, Supabase, TanStack React Query, and shadcn/ui (Radix + Tailwind CSS v4).

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Database / Auth**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **Data Fetching**: TanStack React Query v5, `@supabase-cache-helpers/postgrest-react-query`
- **UI**: Radix UI primitives, Tailwind CSS v4, `class-variance-authority`, `lucide-react`, `cmdk`, `recharts`, `sonner`
- **DnD**: `@dnd-kit`
- **Date**: `date-fns`

## Commands

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npm run start      # Start production server
```

## Project Structure

```
app/               # Next.js App Router pages & layouts
components/        # Shared React components (+ components/ui for shadcn)
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
