import { z } from 'astro/zod'

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
  width: z.number(),
  height: z.number(),
})

const blockImageSchema = z.object({
  src: z.string(),
  alt_text: z.string().nullable().optional(),
  blurhash: z.string().nullable().optional(),
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.number().optional(),
  content_type: z.string(),
  filename: z.string(),
  file_size: z.number().optional(),
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
        content_type: z.string(),
        filename: z.string(),
        file_size: z.number().optional(),
        extension: z.string().optional(),
      }),
      image: blockImageSchema.nullable().optional(),
    })
    .passthrough(),
  z
    .object({
      ...baseBlockProperties,
      type: z.literal('Embed'),
      embed: z.object({
        type: z.string().optional(),
        html: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        source: blockSourceSchema.nullable().optional(),
      }),
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
