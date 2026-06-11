import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Block } from '@aredotna/sdk'
import { createArena, ArenaAuthError, ArenaNotFoundError } from '@aredotna/sdk'
import { arenaLiveBlockLoader } from '../arena-live-block-loader.js'

// Keep real error classes, only mock createArena
vi.mock('@aredotna/sdk', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aredotna/sdk')>()
  return { ...original, createArena: vi.fn() }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextBlock(overrides?: Partial<Block>): Block {
  return {
    type: 'Text',
    base_type: 'Block',
    id: 2001,
    title: 'Text Block',
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
    _links: { self: { href: 'https://api.are.na/v3/blocks/2001' } },
    ...overrides,
  } as Block
}

function makeImageBlock(overrides?: Partial<Block>): Block {
  return {
    type: 'Image',
    base_type: 'Block',
    id: 2002,
    title: 'Image Block',
    description: null,
    image: {
      src: 'https://example.com/img.jpg',
      alt_text: null,
      blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
      width: 800,
      height: 600,
      aspect_ratio: 1.33,
      content_type: 'image/jpeg',
      filename: 'img.jpg',
      file_size: 50000,
      updated_at: '2026-01-01T00:00:00Z',
      small: { src: 'https://example.com/img-sm.jpg', src_2x: 'https://example.com/img-sm@2x.jpg', width: 400, height: 300 },
      medium: { src: 'https://example.com/img-md.jpg', src_2x: 'https://example.com/img-md@2x.jpg', width: 800, height: 600 },
      large: { src: 'https://example.com/img-lg.jpg', src_2x: 'https://example.com/img-lg@2x.jpg', width: 1200, height: 900 },
      square: { src: 'https://example.com/img-sq.jpg', src_2x: 'https://example.com/img-sq@2x.jpg', width: 300, height: 300 },
    },
    state: 'available',
    visibility: 'public',
    comment_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    user: { id: 1, type: 'User', name: 'Test', slug: 'test', avatar: null, initials: 'T' },
    source: null,
    metadata: null,
    _links: { self: { href: 'https://api.are.na/v3/blocks/2002' } },
    ...overrides,
  } as Block
}

function makeLinkBlock(overrides?: Partial<Block>): Block {
  return {
    type: 'Link',
    base_type: 'Block',
    id: 2003,
    title: 'Link Block',
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
    _links: { self: { href: 'https://api.are.na/v3/blocks/2003' } },
    ...overrides,
  } as Block
}

async function* pagesOf(...pages: { data: Block[]; meta: object }[]) {
  for (const page of pages) yield page
}

function mockArena(opts: {
  paginateContents?: ReturnType<typeof vi.fn>
  blocksGet?: ReturnType<typeof vi.fn>
}) {
  return {
    channels: { paginateContents: opts.paginateContents ?? vi.fn() },
    blocks: { get: opts.blocksGet ?? vi.fn() },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('arenaLiveBlockLoader', () => {
  let mockPaginateContents: ReturnType<typeof vi.fn>
  let mockBlocksGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockPaginateContents = vi.fn()
    mockBlocksGet = vi.fn()
    vi.mocked(createArena).mockReturnValue(
      mockArena({ paginateContents: mockPaginateContents, blocksGet: mockBlocksGet }) as any,
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ---- Factory / shape ---------------------------------------------------

  describe('factory', () => {
    it('returns an object without throwing', () => {
      expect(() => arenaLiveBlockLoader({ channel: 'my-channel' })).not.toThrow()
    })

    it('has name "arena-live-block-loader"', () => {
      expect(arenaLiveBlockLoader({ channel: 'my-channel' }).name).toBe('arena-live-block-loader')
    })

    it('has a loadCollection method', () => {
      expect(typeof arenaLiveBlockLoader({ channel: 'my-channel' }).loadCollection).toBe('function')
    })

    it('has a loadEntry method', () => {
      expect(typeof arenaLiveBlockLoader({ channel: 'my-channel' }).loadEntry).toBe('function')
    })

    it('accepts a numeric channel ID', () => {
      expect(() => arenaLiveBlockLoader({ channel: 12345 })).not.toThrow()
    })

    it('accepts a token', () => {
      expect(() => arenaLiveBlockLoader({ channel: 'my-channel', token: 'tok_abc' })).not.toThrow()
    })
  })

  // ---- loadCollection() — happy path ------------------------------------

  describe('loadCollection() — happy path', () => {
    it('returns { entries: [] } for an empty channel', async () => {
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [], meta: { has_more_pages: false } }),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({})
      expect(result).toEqual({ entries: [] })
    })

    it('returns one entry per block', async () => {
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [makeTextBlock(), makeImageBlock()], meta: { has_more_pages: false } }),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({})
      expect('entries' in result && result.entries).toHaveLength(2)
    })

    it('each entry id is the string form of the block numeric id', async () => {
      const block = makeTextBlock({ id: 42 })
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [block], meta: { has_more_pages: false } }),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({})
      expect('entries' in result && result.entries[0].id).toBe('42')
    })

    it('each entry data is the full Block object', async () => {
      const block = makeTextBlock()
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [block], meta: { has_more_pages: false } }),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({})
      expect('entries' in result && result.entries[0].data).toEqual(block)
    })

    it('collects blocks across all pages', async () => {
      mockPaginateContents.mockReturnValue(
        pagesOf(
          { data: [makeTextBlock({ id: 1 }), makeTextBlock({ id: 2 })], meta: { has_more_pages: true } },
          { data: [makeTextBlock({ id: 3 })], meta: { has_more_pages: false } },
        ),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({})
      expect('entries' in result && result.entries).toHaveLength(3)
    })

    it('skips Channel items that appear in channel contents', async () => {
      const channelItem = { type: 'Channel', id: 999, base_type: 'Channel', slug: 'sub-channel' }
      const block = makeTextBlock({ id: 1 })
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [block, channelItem as unknown as Block], meta: { has_more_pages: false } }),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({})
      // Only the real block should appear — the embedded channel is filtered out
      expect('entries' in result && result.entries).toHaveLength(1)
      expect('entries' in result && result.entries[0].id).toBe('1')
    })
  })

  // ---- loadCollection() — filtering ------------------------------------

  describe('loadCollection() — filtering', () => {
    it('passes filter.sort to the API call', async () => {
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: [], meta: { has_more_pages: false } }),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      await loader.loadCollection({ filter: { sort: 'created_at_asc' } })
      expect(mockPaginateContents).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sort: 'created_at_asc' }),
      )
    })

    it('returns only Image entries when filter.types is ["Image"]', async () => {
      const blocks = [makeTextBlock({ id: 1 }), makeImageBlock({ id: 2 }), makeLinkBlock({ id: 3 })]
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: blocks, meta: { has_more_pages: false } }),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({ filter: { types: ['Image'] } })
      expect('entries' in result && result.entries).toHaveLength(1)
      expect('entries' in result && result.entries[0].data.type).toBe('Image')
    })

    it('returns multiple types when filter.types has multiple values', async () => {
      const blocks = [makeTextBlock({ id: 1 }), makeImageBlock({ id: 2 }), makeLinkBlock({ id: 3 })]
      mockPaginateContents.mockReturnValue(
        pagesOf({ data: blocks, meta: { has_more_pages: false } }),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({ filter: { types: ['Image', 'Link'] } })
      expect('entries' in result && result.entries).toHaveLength(2)
    })
  })

  // ---- loadCollection() — error handling --------------------------------

  describe('loadCollection() — error handling', () => {
    it('returns { error } for a private channel without token', async () => {
      mockPaginateContents.mockReturnValue(
        (async function* () {
          throw new ArenaAuthError('Unauthorized', { status: 401 })
        })(),
      )
      const loader = arenaLiveBlockLoader({ channel: 'private-channel' })
      const result = await loader.loadCollection({})
      expect(result).toHaveProperty('error')
      expect((result as { error: unknown }).error).toBeInstanceOf(ArenaAuthError)
    })

    it('returns { error } for a non-existent channel', async () => {
      mockPaginateContents.mockReturnValue(
        (async function* () {
          throw new ArenaNotFoundError('Not found', { status: 404 })
        })(),
      )
      const loader = arenaLiveBlockLoader({ channel: 'does-not-exist' })
      const result = await loader.loadCollection({})
      expect(result).toHaveProperty('error')
      expect((result as { error: unknown }).error).toBeInstanceOf(ArenaNotFoundError)
    })

    it('returns { error } on unexpected network failure', async () => {
      mockPaginateContents.mockReturnValue(
        (async function* () {
          throw new TypeError('fetch failed')
        })(),
      )
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadCollection({})
      expect(result).toHaveProperty('error')
    })
  })

  // ---- loadEntry() — happy path ----------------------------------------

  describe('loadEntry() — happy path', () => {
    it('returns undefined for a non-existent block id', async () => {
      mockBlocksGet.mockResolvedValue(null)
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadEntry({ filter: { id: 9999 } })
      expect(result).toBeUndefined()
    })

    it('returns { id, data } for a valid block id', async () => {
      const block = makeTextBlock({ id: 42 })
      mockBlocksGet.mockResolvedValue(block)
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadEntry({ filter: { id: 42 } })
      expect(result).toBeDefined()
      expect(result).toHaveProperty('id', '42')
      expect(result).toHaveProperty('data', block)
    })

    it('returned data includes the type discriminant field', async () => {
      const block = makeImageBlock({ id: 5 })
      mockBlocksGet.mockResolvedValue(block)
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadEntry({ filter: { id: 5 } })
      expect(result && 'data' in result && result.data.type).toBe('Image')
    })

    it('passes block id to blocks.get()', async () => {
      const block = makeTextBlock({ id: 77 })
      mockBlocksGet.mockResolvedValue(block)
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      await loader.loadEntry({ filter: { id: 77 } })
      expect(mockBlocksGet).toHaveBeenCalledWith(77, expect.anything())
    })
  })

  // ---- loadEntry() — error handling ------------------------------------

  describe('loadEntry() — error handling', () => {
    it('returns { error: ArenaAuthError } when token is required but missing', async () => {
      mockBlocksGet.mockRejectedValue(new ArenaAuthError('Unauthorized', { status: 401 }))
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadEntry({ filter: { id: 42 } })
      expect(result).toHaveProperty('error')
      expect((result as { error: unknown }).error).toBeInstanceOf(ArenaAuthError)
    })

    it('returns { error } on network failure', async () => {
      mockBlocksGet.mockRejectedValue(new TypeError('fetch failed'))
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadEntry({ filter: { id: 42 } })
      expect(result).toHaveProperty('error')
    })
  })

  // ---- type narrowing (compile-time) ------------------------------------
  // These tests exist to verify TypeScript narrows the Block union correctly
  // after type guards. If these compile without errors, the types are correct.

  describe('type narrowing', () => {
    it('allows accessing content after narrowing to Text type', async () => {
      const block = makeTextBlock({ id: 1 })
      mockBlocksGet.mockResolvedValue(block)
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadEntry({ filter: { id: 1 } })
      if (result && 'data' in result && result.data.type === 'Text') {
        // TypeScript should allow this without error
        const content = result.data.content
        expect(content).toBeDefined()
      }
    })

    it('allows accessing image after narrowing to Image type', async () => {
      const block = makeImageBlock({ id: 2 })
      mockBlocksGet.mockResolvedValue(block)
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadEntry({ filter: { id: 2 } })
      if (result && 'data' in result && result.data.type === 'Image') {
        // TypeScript should allow this without error
        const image = result.data.image
        expect(image).toBeDefined()
      }
    })

    it('allows accessing source after narrowing to Link type', async () => {
      const block = makeLinkBlock({ id: 3 })
      mockBlocksGet.mockResolvedValue(block)
      const loader = arenaLiveBlockLoader({ channel: 'my-channel' })
      const result = await loader.loadEntry({ filter: { id: 3 } })
      if (result && 'data' in result && result.data.type === 'Link') {
        // TypeScript should allow this without error
        const source = result.data.source
        expect(source).toBeDefined()
      }
    })
  })
})
