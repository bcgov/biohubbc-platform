import { z } from 'zod';

interface CreateContributorCode {
  name: string;
  value: string;
  description?: string;
}

export interface CreateContributorCodeCategory {
  name: string;
  description: string;
  codes: CreateContributorCode[];
}

export interface CreateCodeset {
  contributor_id: number;
  categories: CreateContributorCodeCategory[];
}

const GetContributorCode = z.object({
  code_name: z.string(),
  description: z.string().nullable()
});

const GetContributorCodeCategory = z.object({
  name: z.string(),
  codes: z.array(GetContributorCode)
});

export const GetCodeset = z.object({
  categories: z.array(GetContributorCodeCategory)
});

export type GetContributorCodeCategory = z.infer<typeof GetContributorCodeCategory>;

export type GetCodeset = z.infer<typeof GetCodeset>;

export interface CodesetFilters {
  contributor_id?: number;
  code_category_name?: string;
}
