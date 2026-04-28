# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (Turbopack by default)
npm run build    # production build (Turbopack by default)
npm run lint     # ESLint (flat config)
npx next typegen # generate PageProps/LayoutProps/RouteContext type helpers
```

No test runner is configured.

## Stack

- **Next.js 16** (App Router, `src/app/`) with React 19
- **Tailwind CSS v4** — configured via CSS (`src/app/globals.css`), no `tailwind.config.ts`
- **shadcn/ui** — `radix-mira` style, HugeIcons icon library; add components with `npx shadcn add <name>` (MCP available)
- **Prisma v7** — client generated to `src/generated/prisma`; datasource URL is in `prisma.config.ts`, not `prisma/schema.prisma`
- **Supabase** — `@supabase/supabase-js` for auth/database

## Next.js 16 Breaking Changes

These differ from training data — read `node_modules/next/dist/docs/` for full details.

**Async request APIs** — `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` are now fully async. Synchronous access is removed.

```tsx
// page.tsx — params and searchParams must be awaited
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const query = await props.searchParams
}
```

**`revalidateTag` requires a second argument** — the `cacheLife` profile (e.g. `'max'`). Single-argument form is deprecated.

```ts
revalidateTag('posts', 'max')   // correct
revalidateTag('posts')           // deprecated
```

**`middleware.ts` → `proxy.ts`** — the file and the named export are renamed. The `edge` runtime is not supported in `proxy`; use `middleware` if you need `edge`.

```ts
// proxy.ts
export function proxy(request: Request) {}
```

**ESLint flat config** — `eslint.config.mjs` (already set up); legacy `.eslintrc` is not used.

**Turbopack is default** — `next dev` and `next build` use Turbopack. Custom `webpack` config in `next.config.ts` will break the build.

**Parallel Routes `default.js`** — all parallel route slots require a `default.js` file.

**Instant navigation** — for slow client-side navigations, `<Suspense>` alone is not enough; also export `unstable_instant` from the route. See `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.mdx`.
