import { OpenAPIV3 } from 'openapi-types';

/**
 * Response schema for a single gallery record (used by GET /gallery/{galleryId},
 * POST /gallery, PUT /gallery/{galleryId}, and as the item shape of the list).
 *
 * `record_end_date` is intentionally absent — every gallery read filters to active
 * rows, so an active gallery's `record_end_date` is always null and never surfaces.
 */
export const GalleryResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['gallery_id', 'name', 'slug', 'visibility', 'description', 'create_date'],
  properties: {
    gallery_id: {
      type: 'integer',
      description: 'The gallery ID. A Postgres integer, unlike the uuid string download_id.'
    },
    name: { type: 'string', description: 'The gallery display name. May be renamed; not a stable identifier.' },
    slug: {
      type: 'string',
      description: 'The short, stable, URL-safe key for the gallery. Unique among active galleries.'
    },
    visibility: {
      type: 'string',
      enum: ['public', 'private'],
      description: 'Whether the gallery is surfaced on public reads. Private galleries are admin-only.'
    },
    description: { type: 'string', nullable: true, description: 'Optional gallery description.' },
    create_date: { type: 'string', description: 'When the gallery was created.' }
  }
};

/**
 * Item-array variant of `GalleryResponseSchema`. The list route wraps it in a
 * `{ galleries: [...] }` envelope (mirroring `TicketListResponseSchema`).
 */
export const GalleryListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'array',
  items: GalleryResponseSchema
};

/**
 * Request body schema for POST /gallery (create) and PUT /gallery/{galleryId}
 * (update). `additionalProperties: false` rejects unknown keys at the boundary so
 * a stray frontend field surfaces as a 400 rather than flowing into a gallery.
 */
export const CreateGalleryRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'slug'],
  properties: {
    name: { type: 'string', minLength: 1, description: 'The gallery display name. Must be non-empty.' },
    slug: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      description: 'The short, stable, URL-safe key. Kebab-case; unique among active galleries.'
    },
    visibility: {
      type: 'string',
      enum: ['public', 'private'],
      description: 'Whether the gallery is surfaced on public reads. Defaults to public when omitted.'
    },
    description: { type: 'string', nullable: true, description: 'Optional gallery description.' }
  }
};
