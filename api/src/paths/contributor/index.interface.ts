export interface CreateContributor {
  clientId: string;
  members: {
    system_user_id: number;
  }[];
}
