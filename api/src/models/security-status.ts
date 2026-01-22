import z from 'zod';

export const SecurityStatusZod = z.enum(['pending', 'clean', 'infected', 'error', 'skipped']);

export enum SecurityStatusEnum {
  PENDING = 'pending',
  CLEAN = 'clean',
  INFECTED = 'infected',
  ERROR = 'error',
  SKIPPED = 'skipped'
}
