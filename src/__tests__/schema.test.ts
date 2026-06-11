import { describe, it, expect } from 'vitest'
import { buildArenaBlockSchema, arenaBlockSchema } from '../schema.js'

// ---------------------------------------------------------------------------
// Fixtures — minimal valid block data for each type
// ---------------------------------------------------------------------------

const base = {
  base_type: 'Block' as const,
  state: 'available' as const,
  visibility: 'public' as const,
  comment_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  user: { id: 1, type: 'User' as const, name: 'Test', slug: 'test', avatar: null, initials: 'T' },
  source: null,
  metadata: null,
  _links: { self: { href: 'https://api.are.na/v3/blocks/1' } },
}

const textBlock = { ...base, type: 'Text' as const, id: 1, content: { markdown: '# Hi', html: '<h1>Hi</h1>', plain: 'Hi' } }

const imageBlock = {
  ...base,
  type: 'Image' as const,
  id: 2,
  image: {
    src: 'https://example.com/img.jpg',
    width: null,
    height: null,
    small: { src: 'https://example.com/sm.jpg', width: null, height: null },
    medium: { src: 'https://example.com/md.jpg', width: null, height: null },
    large: { src: 'https://example.com/lg.jpg', width: null, height: null },
    square: { src: 'https://example.com/sq.jpg', width: null, height: null },
  },
}

const linkBlock = { ...base, type: 'Link' as const, id: 3, image: null, content: null }

const attachmentBlock = {
  ...base,
  type: 'Attachment' as const,
  id: 4,
  attachment: { url: 'https://example.com/file.pdf' },
  image: null,
}

const embedBlock = {
  ...base,
  type: 'Embed' as const,
  id: 5,
  embed: { html: '<iframe />', url: 'https://example.com' },
  image: null,
}

const pendingBlock = { ...base, type: 'PendingBlock' as const, id: 6 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function accepts(schema: ReturnType<typeof buildArenaBlockSchema>, data: object) {
  return schema.safeParse(data).success
}

// ---------------------------------------------------------------------------
// buildArenaBlockSchema
// ---------------------------------------------------------------------------

describe('buildArenaBlockSchema', () => {
  describe('no filter (all types)', () => {
    it('returns the full schema when called with no args', () => {
      expect(buildArenaBlockSchema()).toBe(arenaBlockSchema)
    })

    it('returns the full schema for an empty array', () => {
      expect(buildArenaBlockSchema([])).toBe(arenaBlockSchema)
    })

    it("returns the full schema when 'Block' is in the array", () => {
      expect(buildArenaBlockSchema(['Block'])).toBe(arenaBlockSchema)
    })

    it('accepts all block types', () => {
      const schema = buildArenaBlockSchema()
      expect(accepts(schema, textBlock)).toBe(true)
      expect(accepts(schema, imageBlock)).toBe(true)
      expect(accepts(schema, linkBlock)).toBe(true)
      expect(accepts(schema, attachmentBlock)).toBe(true)
      expect(accepts(schema, embedBlock)).toBe(true)
      expect(accepts(schema, pendingBlock)).toBe(true)
    })
  })

  describe("'Channel' filter (ignored — not a block type)", () => {
    it("returns the full schema when only 'Channel' is specified", () => {
      expect(buildArenaBlockSchema(['Channel'])).toBe(arenaBlockSchema)
    })
  })

  describe('single type filter', () => {
    it("accepts only Text blocks for types: ['Text']", () => {
      const schema = buildArenaBlockSchema(['Text'])
      expect(accepts(schema, textBlock)).toBe(true)
      expect(accepts(schema, imageBlock)).toBe(false)
      expect(accepts(schema, linkBlock)).toBe(false)
      expect(accepts(schema, attachmentBlock)).toBe(false)
      expect(accepts(schema, embedBlock)).toBe(false)
      expect(accepts(schema, pendingBlock)).toBe(false)
    })

    it("accepts only Image blocks for types: ['Image']", () => {
      const schema = buildArenaBlockSchema(['Image'])
      expect(accepts(schema, imageBlock)).toBe(true)
      expect(accepts(schema, textBlock)).toBe(false)
      expect(accepts(schema, linkBlock)).toBe(false)
    })

    it("accepts only Link blocks for types: ['Link']", () => {
      const schema = buildArenaBlockSchema(['Link'])
      expect(accepts(schema, linkBlock)).toBe(true)
      expect(accepts(schema, textBlock)).toBe(false)
      expect(accepts(schema, imageBlock)).toBe(false)
    })

    it("accepts only Attachment blocks for types: ['Attachment']", () => {
      const schema = buildArenaBlockSchema(['Attachment'])
      expect(accepts(schema, attachmentBlock)).toBe(true)
      expect(accepts(schema, textBlock)).toBe(false)
    })

    it("accepts only Embed blocks for types: ['Embed']", () => {
      const schema = buildArenaBlockSchema(['Embed'])
      expect(accepts(schema, embedBlock)).toBe(true)
      expect(accepts(schema, textBlock)).toBe(false)
    })
  })

  describe('multiple type filter', () => {
    it("accepts Image and Text for types: ['Image', 'Text']", () => {
      const schema = buildArenaBlockSchema(['Image', 'Text'])
      expect(accepts(schema, imageBlock)).toBe(true)
      expect(accepts(schema, textBlock)).toBe(true)
      expect(accepts(schema, linkBlock)).toBe(false)
      expect(accepts(schema, attachmentBlock)).toBe(false)
      expect(accepts(schema, embedBlock)).toBe(false)
      expect(accepts(schema, pendingBlock)).toBe(false)
    })

    it("ignores 'Channel' in a mixed array and filters only the valid block types", () => {
      const schema = buildArenaBlockSchema(['Link', 'Channel'])
      expect(accepts(schema, linkBlock)).toBe(true)
      expect(accepts(schema, textBlock)).toBe(false)
    })

    it("returns the full schema when 'Block' is mixed with other types", () => {
      expect(buildArenaBlockSchema(['Block', 'Image'])).toBe(arenaBlockSchema)
    })
  })

  describe('image with null dimensions (real API data)', () => {
    it('accepts an Image block where width/height are null', () => {
      const schema = buildArenaBlockSchema(['Image'])
      expect(accepts(schema, imageBlock)).toBe(true)
    })

    it('accepts a full schema Image block where image version widths are null', () => {
      const schema = buildArenaBlockSchema()
      expect(accepts(schema, imageBlock)).toBe(true)
    })
  })
})
