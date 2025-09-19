import { z } from 'zod';

export interface CreateContributorCode {
  label: string;
  value: string;
  description?: string;
}

export interface CreateContributorCodeCategory {
  name: string;
  description: string;
  codes: CreateContributorCode[];
}

export interface CreateCodeset {
  clientId: string;
  categories: CreateContributorCodeCategory[];
}

export const GetContributorCode = z.object({
  contributor_code_id: z.number(),
  name: z.string(),
  value: z.string(),
  description: z.string().nullable()
});

export const GetContributorCodeCategory = z.object({
  contributor_code_category_id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
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
  code_value?: string;
  code_name?: string;
}
