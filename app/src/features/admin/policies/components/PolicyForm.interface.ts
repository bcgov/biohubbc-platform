import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';

export interface IPolicyFormValues {
  name: string;
  description: string;
  status: PolicyStatus;
}

export type ICreatePolicyFormValues = Pick<IPolicyFormValues, 'name' | 'description'>;
