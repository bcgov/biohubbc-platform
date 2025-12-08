/**
 * OpenAPI schemas for Team endpoints.
 *
 * These schemas define the API contract for team management operations.
 */

import { OpenAPIV3 } from 'openapi-types';

/**
 * Schema for a team member with user details.
 */
export const TeamMemberWithUserSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamMemberWithUser',
  type: 'object',
  required: ['team_member_id', 'system_user_id', 'display_name'],
  properties: {
    team_member_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the team membership'
    },
    system_user_id: {
      type: 'integer',
      description: 'The system user ID of the team member'
    },
    display_name: {
      type: 'string',
      description: 'Display name of the user'
    },
    email: {
      type: 'string',
      nullable: true,
      description: 'Email address of the user'
    }
  }
};

/**
 * Schema for a team (without members).
 */
export const TeamSchema: OpenAPIV3.SchemaObject = {
  title: 'Team',
  type: 'object',
  required: ['team_id', 'name'],
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
    }
  }
};

/**
 * Schema for a team with its members.
 */
export const TeamWithMembersSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamWithMembers',
  type: 'object',
  required: ['team_id', 'name', 'members'],
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
    members: {
      type: 'array',
      items: TeamMemberWithUserSchema,
      description: 'List of team members with user details'
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
      items: TeamWithMembersSchema,
      description: 'List of teams with members'
    },
    pagination: {
      type: 'object',
      required: ['total', 'page', 'limit'],
      properties: {
        total: {
          type: 'integer',
          description: 'Total number of teams'
        },
        page: {
          type: 'integer',
          description: 'Current page number (0-indexed)'
        },
        limit: {
          type: 'integer',
          description: 'Number of items per page'
        }
      }
    }
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
    member_user_ids: {
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
    member_user_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Complete list of system user IDs (replaces existing members)'
    }
  }
};

/**
 * Schema for an available user (for team membership selection).
 */
export const AvailableUserSchema: OpenAPIV3.SchemaObject = {
  title: 'AvailableUser',
  type: 'object',
  required: ['system_user_id', 'display_name'],
  properties: {
    system_user_id: {
      type: 'integer',
      description: 'Unique identifier for the system user'
    },
    user_identifier: {
      type: 'string',
      description: 'Username or identifier from identity provider'
    },
    display_name: {
      type: 'string',
      description: 'Display name of the user'
    },
    email: {
      type: 'string',
      nullable: true,
      description: 'Email address of the user'
    }
  }
};

/**
 * Schema for available users list response.
 */
export const AvailableUsersListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'AvailableUsersListResponse',
  type: 'object',
  required: ['users'],
  properties: {
    users: {
      type: 'array',
      items: AvailableUserSchema,
      description: 'List of available users for team membership'
    }
  }
};
