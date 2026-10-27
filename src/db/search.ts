import { getDatabase } from "@/db";

export type GlobalSearchKind =
  | "project"
  | "requirement"
  | "sourceRequirement"
  | "communication";

export interface GlobalSearchResult {
  kind: GlobalSearchKind;
  id: string;
  projectId: string;
  projectName: string;
  code: string;
  title: string;
}

interface ProjectSearchRow {
  id: string;
  name: string;
  code: string;
}

interface RequirementSearchRow {
  id: string;
  project_id: string;
  project_name: string;
  code: string;
  title: string;
}

interface CommunicationSearchRow {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
}

export async function globalSearch(
  term: string,
  limit = 5,
): Promise<GlobalSearchResult[]> {
  const text = term.trim();
  if (!text) return [];
  const db = await getDatabase();
  const [projects, requirements, sourceRequirements, communications] =
    await Promise.all([
      db.select<ProjectSearchRow[]>(
        `SELECT id, name, code FROM projects
         WHERE instr(lower(name), lower(?)) > 0
            OR instr(lower(code), lower(?)) > 0
         ORDER BY updated_at DESC
         LIMIT ?`,
        [text, text, limit],
      ),
      db.select<RequirementSearchRow[]>(
        `SELECT r.id, r.project_id, p.name AS project_name, r.code, r.title
         FROM requirements r
         JOIN projects p ON p.id = r.project_id
         WHERE instr(lower(r.code), lower(?)) > 0
            OR instr(lower(r.title), lower(?)) > 0
         ORDER BY r.updated_at DESC
         LIMIT ?`,
        [text, text, limit],
      ),
      db.select<RequirementSearchRow[]>(
        `SELECT s.id, s.project_id, p.name AS project_name, s.code, s.title
         FROM source_requirements s
         JOIN projects p ON p.id = s.project_id
         WHERE instr(lower(s.code), lower(?)) > 0
            OR instr(lower(s.title), lower(?)) > 0
         ORDER BY s.code
         LIMIT ?`,
        [text, text, limit],
      ),
      db.select<CommunicationSearchRow[]>(
        `SELECT c.id, c.project_id, p.name AS project_name, c.title
         FROM communications c
         JOIN projects p ON p.id = c.project_id
         WHERE instr(lower(c.title), lower(?)) > 0
         ORDER BY c.updated_at DESC
         LIMIT ?`,
        [text, limit],
      ),
    ]);

  return [
    ...projects.map((row) => ({
      kind: "project" as const,
      id: row.id,
      projectId: row.id,
      projectName: row.name,
      code: row.code,
      title: row.name,
    })),
    ...requirements.map((row) => ({
      kind: "requirement" as const,
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      code: row.code,
      title: row.title,
    })),
    ...sourceRequirements.map((row) => ({
      kind: "sourceRequirement" as const,
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      code: row.code,
      title: row.title,
    })),
    ...communications.map((row) => ({
      kind: "communication" as const,
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      code: "",
      title: row.title,
    })),
  ];
}
