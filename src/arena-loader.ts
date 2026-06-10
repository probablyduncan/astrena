import type { Loader, LoaderContext } from 'astro/loaders'
import { createArena, ArenaAuthError, ArenaNotFoundError, ArenaRateLimitError } from '@aredotna/sdk'
import type { Block, ContentTypeFilter } from '@aredotna/sdk'
import type { ChannelContentSort } from '@aredotna/sdk/api'
import { arenaBlockSchema } from './schema.js'

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
  const arena = createArena({ token: config.token })

  return {
    name: 'arena-loader',
    schema: arenaBlockSchema,
    async load(context: LoaderContext): Promise<void> {
      context.store.clear()
      context.logger.info(`Loading Are.na channel "${config.channel}"`)

      let count = 0
      const query: Record<string, unknown> = {}
      if (config.sort !== undefined) query.sort = config.sort

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const page of arena.channels.paginateContents(config.channel, query as any)) {
          for (const item of page.data) {
            // Filter out sub-channels embedded in channel contents
            if ((item as { type?: string }).type === 'Channel') continue
            // Filter by type if specified
            if (config.types && config.types.length > 0) {
              if (!config.types.includes((item as { type: string }).type as ContentTypeFilter))
                continue
            }

            const block = item as Block
            const id = String(block.id)
            const digest = context.generateDigest(block as unknown as Record<string, unknown>)
            const data = await context.parseData({ id, data: block as unknown as Record<string, unknown> })
            context.store.set({ id, data, digest })
            count++
          }
        }
      } catch (err) {
        if (
          err instanceof ArenaAuthError ||
          err instanceof ArenaNotFoundError ||
          err instanceof ArenaRateLimitError
        ) {
          throw err
        }
        throw new Error(
          `Arena loader failed for channel "${config.channel}": ${err instanceof Error ? err.message : String(err)}`,
        )
      }

      context.logger.info(`Loaded ${count} blocks from Are.na channel "${config.channel}"`)
    },
  } satisfies Loader
}
