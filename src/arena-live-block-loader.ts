import type { LiveLoader } from 'astro/loaders'
import { createArena } from '@aredotna/sdk'
import type { Block, ContentTypeFilter } from '@aredotna/sdk'
import type { ChannelContentSort } from '@aredotna/sdk/api'

export type ArenaLiveBlockLoaderConfig = {
  /** Are.na channel slug (e.g. "my-channel") or numeric ID */
  channel: string | number
  /** Personal Access Token — required for private or closed channels */
  token?: string
}

export type ArenaCollectionFilter = {
  /** Block sort order */
  sort?: ChannelContentSort
  /** Only return blocks of these types */
  types?: ContentTypeFilter[]
}

export type ArenaEntryFilter = {
  /** Are.na block ID */
  id: number
}

// Block satisfies Record<string, any> at runtime; the intersection makes it explicit to TypeScript.
type BlockData = Block & Record<string, any>

export function arenaLiveBlockLoader(
  config: ArenaLiveBlockLoaderConfig,
): LiveLoader<BlockData, ArenaEntryFilter, ArenaCollectionFilter> {
  const arena = createArena({ token: config.token })

  return {
    name: 'arena-live-block-loader',

    async loadCollection(context) {
      const filter = context.filter
      const query: Record<string, unknown> = {}
      if (filter?.sort !== undefined) query.sort = filter.sort

      const entries: Array<{ id: string; data: BlockData }> = []

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const page of arena.channels.paginateContents(config.channel, query as any)) {
          for (const item of page.data) {
            // Filter out sub-channels embedded in channel contents
            if ((item as { type?: string }).type === 'Channel') continue
            // Filter by type if specified
            if (filter?.types && filter.types.length > 0) {
              if (!filter.types.includes((item as { type: string }).type as ContentTypeFilter))
                continue
            }

            const block = item as BlockData
            entries.push({ id: String(block.id), data: block })
          }
        }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) }
      }

      return { entries }
    },

    async loadEntry(context) {
      try {
        const block = await arena.blocks.get(context.filter.id, {})
        if (block == null) return undefined
        return { id: String(block.id), data: block as BlockData }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) }
      }
    },
  } satisfies LiveLoader<BlockData, ArenaEntryFilter, ArenaCollectionFilter>
}
