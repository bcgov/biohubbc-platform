#!/usr/bin/env bash
#
# Create a new Knex migration.
# Usage: ./scripts/create-migration.sh --migration-name your_migration_name
#

set -e

MIGRATION_NAME=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --migration-name)
      MIGRATION_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 -- --migration-name <migration_name>"
      exit 1
      ;;
  esac
done

if [[ -z "$MIGRATION_NAME" ]]; then
  echo "Error: --migration-name is required"
  echo "Usage: $0 -- --migration-name <migration_name>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DB_DIR"

npx knex migrate:make "$MIGRATION_NAME" --knexfile ./src/knexfile.ts
