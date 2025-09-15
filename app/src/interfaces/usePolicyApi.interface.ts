export interface IPolicyStatementConditions {
  action: 'allow';
  name: string;
}

export interface IPolicyStatement {
  name: string;
  conditions: IPolicyStatementConditions;
  feature_urn: string;
}
export interface IPolicy {
  name: string;
  description: string;
  statements: IPolicyStatement[];
}
