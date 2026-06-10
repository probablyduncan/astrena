import type { LiveLoader } from 'astro/loaders'
import type { Block, ContentTypeFilter } from '@aredotna/sdk'
import type { ChannelContentSort } from '@aredotna/sdk/api'

export type ArenaLiveLoaderConfig = {
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

export function arenaLiveLoader(
  config: ArenaLiveLoaderConfig,
): LiveLoader<BlockData, ArenaEntryFilter, ArenaCollectionFilter> {
  return {
    name: 'arena-live-loader',
    async loadCollection(_context) {
      // TODO: use createArena({ token: config.token }) to fetch channel contents,
      // paginate through all pages, filter by filter.types and apply filter.sort,
      // return entries as { id: String(block.id), data: block }
      return { entries: [] }
    },
    async loadEntry(_context) {
      // TODO: use arena.blocks.get(filter.id) and return { id: String(block.id), data: block }
      return undefined
    },
  } satisfies LiveLoader<BlockData, ArenaEntryFilter, ArenaCollectionFilter>
}
