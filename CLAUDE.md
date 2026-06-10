# Implementation Notes

## Build tooling

tsdown 0.22.2 is configured via CLI flags in `package.json` only — **do not create a `tsdown.config.ts` or `tsdown.config.js`**. Both require the `unrun` module for config file loading, which is not installed. Pass all options directly:

```json
"build": "tsdown src/index.ts --dts --clean"
```

With `"type": "module"` in `package.json`, tsdown outputs `.mjs` / `.d.mts` (not `.js` / `.d.ts`). The `exports` and `types` fields in `package.json` must reflect this.

## Auth

Personal Access Token only — **not OAuth**. OAuth is for browser-facing user apps. This loader runs at build time (CI) or server-side (SSR live loader); a PAT in `.env` is the right pattern. Token is optional for public channels.

## SDK usage

`createArena({ token? })` returns the client. The `token` field accepts a `string`. Call it inside the factory function (not inside `load`/`loadCollection`/`loadEntry`) so the client is created once per loader instance.

### Pagination

`arena.channels.paginateContents(channelId, query?)` is an `AsyncGenerator`. Use `for await`:

```typescript
for await (const page of arena.channels.paginateContents(channel, query)) {
  for (const item of page.data) { ... }
}
```

The query object is cast `as any` because `ChannelContentsOptions` is an opaque generated type not exported directly from the SDK.

### Filtering sub-channels

`ConnectableList.data` contains both blocks and embedded sub-channels. Filter them out before processing:

```typescript
if ((item as { type?: string }).type === 'Channel') continue
```

### Type casting

`Block` is a discriminated union — it does not satisfy `Record<string, unknown>` without a cast. Use `block as unknown as Record<string, unknown>` when passing to `context.parseData` or `context.generateDigest`. The `BlockData = Block & Record<string, any>` alias in the live loader satisfies TypeScript's `TData extends Record<string, any>` constraint on `LiveLoader`.

## Error handling

- **Build-time loader (`arenaLoader`)**: Re-throw `ArenaAuthError`, `ArenaNotFoundError`, `ArenaRateLimitError` as-is. Wrap anything else: `throw new Error(\`Arena loader failed for channel "...": ...\`)`. The word "Arena" in the message is used by tests to verify wrapping.
- **Live loader (`arenaLiveLoader`)**: Catch all errors and return `{ error }` — never re-throw from `loadCollection` or `loadEntry`. Returning `undefined` from `loadEntry` signals "not found" to Astro (renders a 404).

## Schema

`arenaBlockSchema` in `src/schema.ts` is a `z.discriminatedUnion('type', [...])` over the six block types: `Text`, `Image`, `Link`, `Attachment`, `Embed`, `PendingBlock`. Each variant uses `.passthrough()` so unknown fields from the API are preserved in the stored data.

Shared base properties (id, created_at, user, etc.) are defined as a plain object spread (`baseBlockProperties`) rather than a base schema, because `z.discriminatedUnion` requires each member to be a standalone `z.object(...)`.

## Type filtering

The Are.na API does not expose a server-side content type filter on the channel contents endpoint. Filtering by `config.types` / `filter.types` is done client-side after fetching each page. This means all blocks are fetched regardless of the type filter — a potential optimization if the SDK adds server-side type filtering in the future.
