import { z } from 'astro/zod'
import type { Block } from '@aredotna/sdk'

const markdownContentSchema = z.object({
  markdown: z.string(),
  html: z.string(),
  plain: z.string(),
})

const embeddedUserSchema = z.object({
  id: z.number(),
  type: z.literal('User'),
  name: z.string(),
  slug: z.string(),
  avatar: z.string().nullable().optional(),
  initials: z.string(),
})

const imageVersionSchema = z.object({
  src: z.string(),
  src_2x: z.string().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
})

const blockImageSchema = z.object({
  src: z.string().optional(),
  alt_text: z.string().nullable().optional(),
  blurhash: z.string().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  aspect_ratio: z.number().nullable().optional(),
  content_type: z.string().optional(),
  filename: z.string().optional(),
  file_size: z.number().nullable().optional(),
  updated_at: z.string().optional(),
  small: imageVersionSchema.optional(),
  medium: imageVersionSchema.optional(),
  large: imageVersionSchema.optional(),
  square: imageVersionSchema.optional(),
})

const blockSourceSchema = z.object({
  url: z.string(),
  title: z.string().nullable().optional(),
  provider: z
    .object({
      name: z.string(),
      url: z.string(),
    })
    .nullable()
    .optional(),
})

const baseBlockProperties = {
  id: z.number(),
  base_type: z.literal('Block'),
  title: z.string().nullable().optional(),
  description: markdownContentSchema.nullable().optional(),
  state: z.enum(['processing', 'available', 'failed']),
  visibility: z.enum(['public', 'private', 'orphan']),
  comment_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  user: embeddedUserSchema,
  source: blockSourceSchema.nullable().optional(),
  metadata: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .nullable()
    .optional(),
  _links: z
    .object({ self: z.object({ href: z.string() }).passthrough() })
    .passthrough(),
}

export const arenaBlockSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...baseBlockProperties,
      type: z.literal('Text'),
      content: markdownContentSchema,
    })
    .passthrough(),
  z
    .object({
      ...baseBlockProperties,
      type: z.literal('Image'),
      image: blockImageSchema,
    })
    .passthrough(),
  z
    .object({
      ...baseBlockProperties,
      type: z.literal('Link'),
      image: blockImageSchema.nullable().optional(),
      content: markdownContentSchema.nullable().optional(),
    })
    .passthrough(),
  z
    .object({
      ...baseBlockProperties,
      type: z.literal('Attachment'),
      attachment: z.object({
        url: z.string(),
        content_type: z.string().nullable().optional(),
        filename: z.string().nullable().optional(),
        file_size: z.number().nullable().optional(),
        file_extension: z.string().nullable().optional(),
      }).passthrough(),
      image: blockImageSchema.nullable().optional(),
    })
    .passthrough(),
  z
    .object({
      ...baseBlockProperties,
      type: z.literal('Embed'),
      embed: z.object({
        type: z.string().nullable().optional(),
        html: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        source_url: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        author_name: z.string().nullable().optional(),
        author_url: z.string().nullable().optional(),
        width: z.number().nullable().optional(),
        height: z.number().nullable().optional(),
        thumbnail_url: z.string().nullable().optional(),
      }).passthrough(),
      image: blockImageSchema.nullable().optional(),
    })
    .passthrough(),
  z
    .object({
      ...baseBlockProperties,
      type: z.literal('PendingBlock'),
    })
    .passthrough(),
])

export type ArenaBlock = z.infer<typeof arenaBlockSchema>

// Compile-time guard: if the SDK's Block type stops being assignable to our schema's
// output type, TypeScript will error here, surfacing schema drift at build time.
type _BlockSchemaGuard = Block extends ArenaBlock ? true : never
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _blockSchemaGuard: _BlockSchemaGuard = true
