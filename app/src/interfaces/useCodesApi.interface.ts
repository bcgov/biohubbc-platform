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

export interface IFeatureTypeProperties extends CodeSet {
  id: number;
  name: string;
  display_name: string;
  type: string;
}

/**
 * Get all codes response object.
 *
 * @export
 * @interface IGetAllCodeSetsResponse
 */
export interface IGetAllCodeSetsResponse {
  feature_type_with_properties: {
    feature_type: CodeSet<{
      id: number;
      name: string;
    }>;
    feature_type_properties: IFeatureTypeProperties[];
  }[];
}
