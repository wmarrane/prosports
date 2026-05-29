-- Renames the existing enum value in-place; preserves any User row that already has this role.
-- Requires PostgreSQL >= 10 (we use 16+).
ALTER TYPE "Role" RENAME VALUE 'DELEGACAO' TO 'PARTICIPANTE';
