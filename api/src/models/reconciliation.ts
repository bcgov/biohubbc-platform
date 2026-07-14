import { z } from 'zod';

/**
 * Classifications stored by the submission feature reconciliation enum.
 */
export const ReconciliationType = z.enum(['new', 'unchanged', 'superseded', 'conflict']);

export type ReconciliationType = z.infer<typeof ReconciliationType>;
