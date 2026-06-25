/**
 * OpenAPI schemas for Team-Policy endpoints.
 *
 * These schemas define the API contract for team-policy association management.
 */

import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for a team-policy association with names for display.
 */
export const TeamPolicyDetailsSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamPolicyDetails',
  type: 'object',
  required: ['team_policy_id', 'team_id', 'policy_id', 'record_end_date', 'team_name', 'policy_name'],
  properties: {
    team_policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the team-policy association'
    },
    team_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the team'
    },
    policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the policy'
    },
    record_end_date: {
      type: 'string',
      nullable: true,
      description: 'Soft-delete timestamp for the team-policy association'
    },
    team_name: {
      type: 'string',
      description: 'Name of the team'
    },
    policy_name: {
      type: 'string',
      description: 'Name of the policy'
    }
  }
};

/**
 * Schema for team-policies list response.
 */
export const TeamPoliciesResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamPoliciesResponse',
  type: 'object',
  required: ['team_policies', 'pagination'],
  properties: {
    team_policies: {
      type: 'array',
      items: TeamPolicyDetailsSchema,
      description: 'List of team-policy associations with names'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for policy-scoped teams list response.
 */
export const PolicyTeamsResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'PolicyTeamsResponse',
  type: 'object',
  required: ['teams', 'pagination'],
  properties: {
    teams: {
      type: 'array',
      items: TeamPolicyDetailsSchema,
      description: 'List of teams associated with the policy'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for create team-policy request body.
 */
export const CreateTeamPolicyRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateTeamPolicyRequest',
  type: 'object',
  required: ['team_id'],
  properties: {
    team_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the team to associate'
    }
  }
};

/**
 * Schema for create team-policies batch request body.
 */
export const CreateTeamPoliciesRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateTeamPoliciesRequest',
  type: 'object',
  required: ['policies'],
  properties: {
    policies: {
      type: 'array',
      items: {
        type: 'string',
        format: 'uuid'
      },
      description: 'List of policy IDs to associate with a team'
    }
  }
};

/**
 * Schema for created team-policy response (basic, without names).
 */
export const TeamPolicySchema: OpenAPIV3.SchemaObject = {
  title: 'TeamPolicy',
  type: 'object',
  required: ['team_policy_id', 'team_id', 'policy_id', 'record_end_date'],
  properties: {
    team_policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the team-policy association'
    },
    team_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the team'
    },
    policy_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID of the policy'
    },
    record_end_date: {
      type: 'string',
      nullable: true,
      description: 'Soft-delete timestamp for the team-policy association'
    }
  }
};

/**
 * Schema for create team-policies batch response.
 */
export const TeamPoliciesSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamPoliciesBatch',
  type: 'object',
  required: ['team_policies'],
  properties: {
    team_policies: {
      type: 'array',
      items: TeamPolicySchema,
      description: 'Processed team-policy associations for this request'
    }
  }
};
