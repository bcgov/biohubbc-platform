import z from 'zod';

export const ProcessStatusStatusZod = z.enum(['draft', 'pending', 'completed', 'failed']);

export enum ProcessStatusStatusEnum {
  DRAFT = 'draft',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
