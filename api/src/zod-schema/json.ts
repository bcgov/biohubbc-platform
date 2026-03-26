import * as z from 'zod';

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type Literal = z.infer<typeof literalSchema>;

export type JsonValue = Literal | { [key: string]: JsonValue } | JsonValue[];

// Defines a Zod Schema for a valid JSON value
// Not safe for massive JSON objects as it may cause a heap out of memory error
export const jsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
);
