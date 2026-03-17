import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/**
 * Schema for a team member with user details.
 */
export const TeamMemberSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamMember',
  type: 'object',
  required: ['team_member_id', 'system_user_id', 'user_identifier', 'email'],
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
    user_identifier: {
      type: 'string',
      description: 'Username or identifier from identity provider'
    },
    email: {
      type: 'string',
      nullable: true,
      description: 'Email for the user'
    }
  }
};

/**
 * Schema for paginated team member list response.
 */
export const TeamMembersListResponseSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamMembersListResponse',
  type: 'object',
  required: ['members', 'pagination'],
  properties: {
    members: {
      type: 'array',
      items: TeamMemberSchema,
      description: 'List of members for the team'
    },
    pagination: paginationResponseSchema
  }
};

/**
 * Schema for add/remove team member by system user id.
 */
export const TeamMemberByUserRequestSchema: OpenAPIV3.SchemaObject = {
  title: 'TeamMemberByUserRequest',
  type: 'object',
  required: ['system_user_id'],
  properties: {
    system_user_id: {
      type: 'integer',
      description: 'System user ID to add/remove as a team member'
    }
  }
};

/**
 * Schema for an available user (for team membership selection).
 */
export const AvailableUserSchema: OpenAPIV3.SchemaObject = {
  title: 'AvailableUser',
  type: 'object',
  required: ['system_user_id', 'user_identifier'],
  properties: {
    system_user_id: {
      type: 'integer',
      description: 'Unique identifier for the system user'
    },
    user_identifier: {
      type: 'string',
      description: 'Username or identifier from identity provider'
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
