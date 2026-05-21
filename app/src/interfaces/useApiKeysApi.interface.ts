/**
 * Public view of a BioHub API key as returned by the API.
 * The plaintext key and key_hash are never included.
 */
export interface IAccessKeyView {
  access_key_id: string;
  system_user_id: number;
  name: string;
  key_prefix: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  record_end_date: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

/**
 * Response body for the POST /api/api-key endpoint.
 * The plaintext_key is shown exactly once and cannot be recovered.
 */
export interface ICreateAccessKeyResponse {
  access_key: IAccessKeyView;
  plaintext_key: string;
}
