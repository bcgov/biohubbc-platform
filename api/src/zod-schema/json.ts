import * as z from 'zod';

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type Literal = z.infer<typeof literalSchema>;

type Json = Literal | { [key: string]: Json } | Json[];

// Defines a Zod Schema for a valid JSON value
// Not safe for massive JSON objects as it may cause a heap out of memory error
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
);

// Defines a Zod Schema for a valid JSON value using shallow validation for use with massive JSON objects.
export const shallowJsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(z.any()), z.record(z.string()), z.record(z.any())])
);