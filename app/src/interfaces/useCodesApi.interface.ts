/**
 * A single code value.
 *
 * @export
 * @interface ICode
 */
export interface ICode {
  id: number;
  name: string;
}

/**
 * A code set (an array of ICode values).
 */
export type CodeSet<T extends ICode = ICode> = T[];

/**
 * Get all codes response object.
 *
 * @export
 * @interface IGetAllCodeSetsResponse
 */
export interface IGetAllCodeSetsResponse {
  feature_types: CodeSet;
  feature_type_with_properties: {
    feature_type: CodeSet;
    feature_type_properties: CodeSet<{
      id: number;
      name: string;
      type: string;
    }>[];
  };
}
