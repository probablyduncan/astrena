import type { Loader, LoaderContext } from 'astro/loaders'
import { z } from 'astro/zod'
import type { ContentTypeFilter } from '@aredotna/sdk'
import type { ChannelContentSort } from '@aredotna/sdk/api'

export type ArenaLoaderConfig = {
  /** Are.na channel slug (e.g. "my-channel") or numeric ID */
  channel: string | number
  /** Personal Access Token — required for private or closed channels */
  token?: string
  /** Block sort order. Defaults to 'position_desc' (owner's arrangement) */
  sort?: ChannelContentSort
  /** Only store blocks of these types. Omit to store all block types. */
  types?: ContentTypeFilter[]
}

export function arenaLoader(config: ArenaLoaderConfig): Loader {
  return {
    name: 'arena-loader',
    async load(context: LoaderContext): Promise<void> {
      context.store.clear()
      // TODO: use createArena({ token: config.token }) to fetch channel contents,
      // paginate through all pages, filter by config.types, call parseData + store.set
      // for each block using String(block.id) as the entry id.
    },
    schema: z.any(),
  } satisfies Loader
}
