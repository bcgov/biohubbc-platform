export interface TarCodesetCode {
  external_id?: string;
  label?: string;
  description?: string;
}

export interface TarCodeset {
  external_id?: string;
  label?: string;
  description?: string;
  codes?: Record<string, TarCodesetCode>;
}

export type TarCodesets = Record<string, TarCodeset>;
