import z from 'zod';

export const ProcessStatusStatusZod = z.enum(['draft', 'blocked', 'pending', 'completed', 'failed']);

export enum ProcessStatusStatusEnum {
  DRAFT = 'draft',
  BLOCKED = 'blocked',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
