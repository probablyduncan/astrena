import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Block, ContentTypeFilter } from '@aredotna/sdk'
import { createArena, ArenaAuthError, ArenaNotFoundError, ArenaRateLimitError } from '@aredotna/sdk'
import { arenaLoader } from '../arena-loader.js'
import type { LoaderContext } from 'astro/loaders'
import { z } from 'astro/zod'

// Keep real error classes, only mock createArena
vi.mock('@aredotna/sdk', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aredotna/sdk')>()
  return { ...original, createArena: vi.fn() }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(overrides?: Partial<LoaderContext>): LoaderContext {
  return {
    collection: 'arena',
    config: {} as LoaderContext['config'],
    store: {
      set: vi.fn().mockReturnValue(true),
      clear: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn().mockReturnValue([]),
      values: vi.fn().mockReturnValue([]),
      entries: vi.fn().mockReturnValue([]),
    } as unknown as LoaderContext['store'],
    meta: {
      get: vi.fn(),
      set: vi.fn(),
    } as unknown as LoaderContext['meta'],
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fork: vi.fn(),
      label: 'arena-loader',
      options: {},
    } as unknown as LoaderContext['logger'],
    parseData: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    generateDigest: vi.fn().mockReturnValue('digest-abc'),
    renderMarkdown: vi.fn(),
    ...overrides,
  }
}

function makeTextBlock(overrides?: Partial<Block>): Block {
  return {
    type: 'Text',
    base_type: 'Block',
    id: 1001,
    title: 'Test Text Block',
    description: null,
    content: { markdown: '# Hello', html: '<h1>Hello</h1>', plain: 'Hello' },
    state: 'available',
    visibility: 'public',
    comment_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    user: { id: 1, type: 'User', name: 'Test', slug: 'test', avatar: null, initials: 'T' },
    source: null,
    metadata: null,
    _links: { self: { href: 'https://api.are.na/v3/blocks/1001' } },
    ...overrides,
  } as Block
}

function makeImageBlock(overrides?: Partial<Block>): Block {
  return {
    type: 'Image',
    base_type: 'Block',
    id: 1002,
    title: 'Test Image Block',
    description: null,
    image: {
      src: 'https://example.com/image.jpg',
      alt_text: null,
      blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
      width: 800,
      height: 600,
      aspect_ratio: 1.33,
      content_type: 'image/jpeg',
      filename: 'image.jpg',
      file_size: 50000,
      updated_at: '2026-01-01T00:00:00Z',
      small: { src: 'https://example.com/image-sm.jpg', src_2x: 'https://example.com/image-sm@2x.jpg', width: 400, height: 300 },
      medium: { src: 'https://example.com/image-md.jpg', src_2x: 'https://example.com/image-md@2x.jpg', width: 800, height: 600 },
      large: { src: 'https://example.com/image-lg.jpg', src_2x: 'https://example.com/image-lg@2x.jpg', width: 1200, height: 900 },
      square: { src: 'https://example.com/image-sq.jpg', src_2x: 'https://example.com/image-sq@2x.jpg', width: 300, height: 300 },
    },
    state: 'available',
    visibility: 'public',
    comment_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    user: { id: 1, type: 'User', name: 'Test', slug: 'test', avatar: null, initials: 'T' },
    source: null,
    metadata: null,
    _links: { self: { href: 'https://api.are.na/v3/blocks/1002' } },
    ...overrides,
  } as Block
}

function makeLinkBlock(overrides?: Partial<Block>): Block {
  return {
    type: 'Link',
    base_type: 'Block',
    id: 1003,
    title: 'Test Link Block',
    description: null,
    image: null,
    content: null,
    source: {
      url: 'https://example.com',
      title: 'Example',
      provider: { name: 'example.com', url: 'https://example.com' },
    },
    state: 'available',
    visibility: 'public',
    comment_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    user: { id: 1, type: 'User', name: 'Test', slug: 'test', avatar: null, initials: 'T' },
    metadata: null,
    _links: { self: { href: 'https://api.are.na/v3/blocks/1003' } },
    ...overrides,
  } as Block
}

// Async generator helper — simulates paginateContents yielding pages
async function* pagesOf(...pages: { data: Block[]; meta: object }[]) {
  for (const page of pages) yield page
}

function mockArena(paginateContentsImpl: ReturnType<typeof vi.fn>) {
  return {
    channels: { paginateContents: paginateContentsImpl },
    blocks: { get: vi.fn() },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('arenaLoader', () => {
  let mockPaginateContents: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockPaginateContents = vi.fn()
    vi.mocked(createArena).mockReturnValue(mockArena(mockPaginateContents) as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ---- Factory / shape ---------------------------------------------------

  describe('factory', () => {
    it('returns an object without throwing', () => {
      expect(() => arenaLoader({ channel: 'my-channel' })).not.toThrow()
    })

    it('has name "arena-loader"', () => {
      expect(arenaLoader({ channel: 'my-channel' }).name).toBe('arena-loader')
    })

    it('has a load method', () => {
      expect(typeof arenaLoader({ channel: 'my-channel' }).load).toBe('function')
    })

    it('has a schema property', () => {
      expect(arenaLoader({ channel: 'my-channel' }).schema).toBeDefined()
    })

    it('accepts a numeric channel ID', () => {
      expect(() => arenaLoader({ channel: 12345 })).not.toThrow()
    })

    it('accepts a token', () => {
      expect(() => arenaLoader({ channel: 'my-channel', token: 'abc' })).not.toThrow()
    })

    it('accepts sort and types config', () => {
      expect(() =>
        arenaLoader({ channel: 'my-channel', sort: 'created_at_desc', types: ['Image', 'Link'] }),
      ).not.toThrow()
    })
  })

  // ---- store lifecycle ---------------------------------------------------

  describe('load() — store lifecycle', () => {
    it('calls store.clear() once at the start', async () => {
      mockPaginateContents.mockReturnValue(pagesOf({ data: [], meta: { has_more_pages: false } }))
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.store.clear).toHaveBeenCalledOnce()
    })

    it('calls store.set() once per block', async () => {
      const blocks = [makeTextBlock(), makeImageBlock(), makeLinkBlock()]
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: blocks, meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.store.set).toHaveBeenCalledTimes(3)
    })

    it('calls parseData() for each block before store.set()', async () => {
      const blocks = [makeTextBlock(), makeImageBlock()]
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: blocks, meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.parseData).toHaveBeenCalledTimes(2)
    })

    it('uses String(block.id) as the entry id', async () => {
      const block = makeTextBlock({ id: 42 })
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [block], meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.store.set).toHaveBeenCalledWith(
        expect.objectContaining({ id: '42' }),
      )
    })

    it('passes block data to store.set()', async () => {
      const block = makeTextBlock()
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [block], meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.store.set).toHaveBeenCalledWith(
        expect.objectContaining({ data: block }),
      )
    })

    it('uses generateDigest() and skips store.set() when digest is unchanged', async () => {
      const block = makeTextBlock()
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [block], meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext({
        store: {
          ...createMockContext().store,
          set: vi.fn().mockReturnValue(false), // false = digest unchanged, no update
        } as unknown as LoaderContext['store'],
      })
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.generateDigest).toHaveBeenCalledWith(
        expect.objectContaining({ id: block.id }),
      )
    })

    it('never calls store.set() for an empty channel', async () => {
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [], meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.store.set).not.toHaveBeenCalled()
    })
  })

  // ---- pagination --------------------------------------------------------

  describe('load() — pagination', () => {
    it('fetches all pages when has_more_pages is true', async () => {
      const page1Blocks = [makeTextBlock({ id: 1 }), makeTextBlock({ id: 2 })]
      const page2Blocks = [makeTextBlock({ id: 3 })]
      mockPaginateContents.mockReturnValue(
        pagesOf(
          { data: page1Blocks, meta: { has_more_pages: true, current_page: 1 } },
          { data: page2Blocks, meta: { has_more_pages: false, current_page: 2 } },
        ),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.store.set).toHaveBeenCalledTimes(3)
    })

    it('passes channel id to paginateContents', async () => {
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [], meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(mockPaginateContents).toHaveBeenCalledWith(
        'my-channel',
        expect.anything(),
      )
    })
  })

  // ---- sort & filtering --------------------------------------------------

  describe('load() — sort', () => {
    it('passes config.sort to the SDK call', async () => {
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [], meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel', sort: 'created_at_asc' }).load(ctx)
      expect(mockPaginateContents).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sort: 'created_at_asc' }),
      )
    })
  })

  describe('load() — type filtering', () => {
    it('stores only blocks matching config.types', async () => {
      const blocks = [
        makeTextBlock({ id: 1 }),
        makeImageBlock({ id: 2 }),
        makeLinkBlock({ id: 3 }),
      ]
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: blocks, meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel', types: ['Image'] }).load(ctx)
      expect(ctx.store.set).toHaveBeenCalledTimes(1)
      expect(ctx.store.set).toHaveBeenCalledWith(
        expect.objectContaining({ id: '2' }),
      )
    })

    it('stores all block types when config.types is omitted', async () => {
      const blocks = [makeTextBlock({ id: 1 }), makeImageBlock({ id: 2 })]
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: blocks, meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.store.set).toHaveBeenCalledTimes(2)
    })
  })

  // ---- logging -----------------------------------------------------------

  describe('load() — logging', () => {
    it('logs a message when fetch starts', async () => {
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [], meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      expect(ctx.logger.info).toHaveBeenCalled()
    })

    it('logs the count of blocks stored on completion', async () => {
      const blocks = [makeTextBlock(), makeImageBlock()]
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: blocks, meta: { has_more_pages: false } }),
      )
      const ctx = createMockContext()
      await arenaLoader({ channel: 'my-channel' }).load(ctx)
      // Expect at least one info call mentioning block count
      const calls = vi.mocked(ctx.logger.info).mock.calls.map((c) => String(c[0]))
      expect(calls.some((msg) => msg.includes('2'))).toBe(true)
    })
  })

  // ---- error handling ----------------------------------------------------

  describe('load() — error handling', () => {
    it('re-throws ArenaAuthError (e.g. private channel without token)', async () => {
      mockPaginateContents.mockReturnValue(
        (async function* () {
          throw new ArenaAuthError('Unauthorized', { status: 401 })
        })(),
      )
      const ctx = createMockContext()
      await expect(arenaLoader({ channel: 'private-channel' }).load(ctx)).rejects.toThrow(
        ArenaAuthError,
      )
    })

    it('re-throws ArenaNotFoundError for a non-existent channel', async () => {
      mockPaginateContents.mockReturnValue(
        (async function* () {
          throw new ArenaNotFoundError('Not found', { status: 404 })
        })(),
      )
      const ctx = createMockContext()
      await expect(arenaLoader({ channel: 'does-not-exist' }).load(ctx)).rejects.toThrow(
        ArenaNotFoundError,
      )
    })

    it('re-throws ArenaRateLimitError without swallowing it', async () => {
      mockPaginateContents.mockReturnValue(
        (async function* () {
          throw new ArenaRateLimitError('Rate limited', { status: 429 })
        })(),
      )
      const ctx = createMockContext()
      await expect(arenaLoader({ channel: 'my-channel' }).load(ctx)).rejects.toThrow(
        ArenaRateLimitError,
      )
    })

    it('wraps unexpected errors with a descriptive message', async () => {
      mockPaginateContents.mockReturnValue(
        (async function* () {
          throw new TypeError('fetch failed')
        })(),
      )
      const ctx = createMockContext()
      await expect(arenaLoader({ channel: 'my-channel' }).load(ctx)).rejects.toThrow(/arena/i)
    })
  })

  // ---- schema ------------------------------------------------------------

  describe('schema', () => {
    it('schema is a Zod schema (has parse method)', () => {
      const { schema } = arenaLoader({ channel: 'my-channel' })
      expect(schema).toBeDefined()
      expect(typeof (schema as z.ZodTypeAny).parse).toBe('function')
    })

    it('validates a Text block with content', () => {
      const { schema } = arenaLoader({ channel: 'my-channel' })
      const block = makeTextBlock()
      expect(() => (schema as z.ZodTypeAny).parse(block)).not.toThrow()
      const parsed = (schema as z.ZodTypeAny).parse(block)
      // schema should preserve type discriminant
      expect(parsed.type).toBe('Text')
      expect(parsed.content).toBeDefined()
    })

    it('validates an Image block with image.src', () => {
      const { schema } = arenaLoader({ channel: 'my-channel' })
      const block = makeImageBlock()
      expect(() => (schema as z.ZodTypeAny).parse(block)).not.toThrow()
      const parsed = (schema as z.ZodTypeAny).parse(block)
      expect(parsed.type).toBe('Image')
      expect(parsed.image?.src).toBeDefined()
    })

    it('validates a Link block with source.url', () => {
      const { schema } = arenaLoader({ channel: 'my-channel' })
      const block = makeLinkBlock()
      expect(() => (schema as z.ZodTypeAny).parse(block)).not.toThrow()
      const parsed = (schema as z.ZodTypeAny).parse(block)
      expect(parsed.type).toBe('Link')
      expect(parsed.source?.url).toBeDefined()
    })

    it('rejects an object missing the required id field', () => {
      const { schema } = arenaLoader({ channel: 'my-channel' })
      expect(() => (schema as z.ZodTypeAny).parse({ type: 'Text' })).toThrow()
    })

    it('rejects an object missing the required type field', () => {
      const { schema } = arenaLoader({ channel: 'my-channel' })
      expect(() => (schema as z.ZodTypeAny).parse({ id: 1, content: 'hello' })).toThrow()
    })
  })
})
