export interface IListArtifactsResponse {
  artifacts: Array<{
    artifact_id: number;
    create_date: string;
    create_user: number;
    description: string | null;
    file_name: string;
    file_size: number;
    file_type: string;
    foi_reason_description: string | null;
    key: string;
    revision_count: number;
    security_review_timestamp: string | null;
    submission_id: number;
    title: string | null;
    update_date: string | null;
    update_user: number | null;
    uuid: string;
  }>;
}