import { MaterializedViewDefinition } from '../types';

export function buildCommentsSQL(definition: MaterializedViewDefinition): string[] {
  const { schema, name, comments } = definition;

  if (!comments) return [];

  return Object.entries(comments).map(
    ([column, comment]) => `COMMENT ON COLUMN ${schema}.${name}.${column} IS '${comment}';`
  );
}
