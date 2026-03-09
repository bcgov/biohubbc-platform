/**
 * OpenAPI schemas for Team endpoints.
 *
 * These schemas define the API contract for team management operations.
 */

import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for a team.
 */
export const TeamSchema: OpenAPIV3.SchemaObject = {
  title: 'Team',
  type: 'object',
  required: ['team_id', 'name', 'member_count'],
  properties: {
    team_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the team'
    },
    name: {
      type: 'string',
      maxLength: 250,
      description: 'Name of the team'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      nullable: true,
      description: 'Description of the team'
    },
    member_count: {
      type: 'integer',
      description: 'Number of active members in the team'
    }
  }
};

/**
 * Schema for paginated teams list response.
 */
export const TeamsListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamsListResponse',
  type: 'object',
  required: ['teams', 'pagination'],
  properties: {
    teams: {
      type: 'array',
      items: TeamSchema,
      description: 'List of teams with member counts'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for create team request body.
 */
export const CreateTeamRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'CreateTeamRequest',
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      maxLength: 250,
      description: 'Name of the team'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      description: 'Description of the team'
    },
    system_user_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'System user IDs to add as team members'
    }
  }
};

/**
 * Schema for update team request body.
 */
export const UpdateTeamRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'UpdateTeamRequest',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      maxLength: 250,
      description: 'Name of the team'
    },
    description: {
      type: 'string',
      maxLength: 1000,
      description: 'Description of the team'
    },
    system_user_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Complete list of system user IDs (replaces existing members)'
    }
  }
};
