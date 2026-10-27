import { getDatabase } from "@/db";
import { createId } from "@/lib/ids";
import { nowIso } from "@/lib/dates";
import type {
  Project,
  ProjectInput,
  ProjectStakeholder,
  ProjectStakeholderInput,
  ProjectStatus,
} from "@/types/models";

interface ProjectRow {
  id: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

interface StakeholderLinkRow {
  project_id: string;
  stakeholder_id: string;
  stakeholder_name: string;
  stakeholder_company: string | null;
  role: string | null;
}

const SELECT_PROJECTS = `
  SELECT
    p.id,
    p.name,
    p.code,
    p.description,
    p.lifecycle_status AS status,
    p.start_date,
    p.target_date,
    p.created_at,
    p.updated_at
  FROM projects p
`;

async function loadStakeholderLinks(
  projectId?: string,
): Promise<Map<string, ProjectStakeholder[]>> {
  const db = await getDatabase();
  const rows = await db.select<StakeholderLinkRow[]>(
    projectId
      ? `SELECT ps.project_id, ps.stakeholder_id, ps.role,
                s.name AS stakeholder_name, s.company AS stakeholder_company
         FROM project_stakeholders ps
         JOIN stakeholders s ON s.id = ps.stakeholder_id
         WHERE ps.project_id = ?`
      : `SELECT ps.project_id, ps.stakeholder_id, ps.role,
                s.name AS stakeholder_name, s.company AS stakeholder_company
         FROM project_stakeholders ps
         JOIN stakeholders s ON s.id = ps.stakeholder_id`,
    projectId ? [projectId] : [],
  );

  const links = new Map<string, ProjectStakeholder[]>();
  for (const row of rows) {
    const entry = links.get(row.project_id) ?? [];
    entry.push({
      id: row.stakeholder_id,
      name: row.stakeholder_name,
      company: row.stakeholder_company,
      role: row.role,
    });
    links.set(row.project_id, entry);
  }
  return links;
}

function mapProject(
  row: ProjectRow,
  links: Map<string, ProjectStakeholder[]>,
): Project {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    targetDate: row.target_date,
    stakeholders: links.get(row.id) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDatabase();
  const rows = await db.select<ProjectRow[]>(
    `${SELECT_PROJECTS} ORDER BY p.updated_at DESC`,
  );
  const links = await loadStakeholderLinks();
  return rows.map((row) => mapProject(row, links));
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase();
  const rows = await db.select<ProjectRow[]>(
    `${SELECT_PROJECTS} WHERE p.id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const links = await loadStakeholderLinks(id);
  return mapProject(rows[0], links);
}

async function assertCodeAvailable(code: string, excludeId?: string) {
  const db = await getDatabase();
  const rows = await db.select<{ id: string }[]>(
    excludeId
      ? "SELECT id FROM projects WHERE code = ? AND id <> ? LIMIT 1"
      : "SELECT id FROM projects WHERE code = ? LIMIT 1",
    excludeId ? [code, excludeId] : [code],
  );
  if (rows.length > 0) throw new Error(`项目代号 ${code} 已被使用`);
}

async function setProjectStakeholders(
  projectId: string,
  stakeholders: ProjectStakeholderInput[],
) {
  const db = await getDatabase();
  await db.execute(
    "DELETE FROM project_stakeholders WHERE project_id = ?",
    [projectId],
  );

  const unique = new Map<string, ProjectStakeholderInput>();
  for (const stakeholder of stakeholders) {
    unique.set(stakeholder.id, stakeholder);
  }
  const list = Array.from(unique.values());
  if (list.length === 0) return;

  const placeholders = list.map(() => "(?, ?, ?)").join(", ");
  const values = list.flatMap((stakeholder) => [
    projectId,
    stakeholder.id,
    stakeholder.role,
  ]);
  await db.execute(
    `INSERT INTO project_stakeholders (project_id, stakeholder_id, role)
     VALUES ${placeholders}`,
    values,
  );
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const db = await getDatabase();
  const id = createId();
  const now = nowIso();
  const code = input.code.trim().toUpperCase();

  await assertCodeAvailable(code);

  await db.execute(
    `INSERT INTO projects
       (id, name, code, description, lifecycle_status, start_date, target_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      code,
      input.description,
      input.status,
      input.startDate,
      input.targetDate,
      now,
      now,
    ],
  );

  await setProjectStakeholders(id, input.stakeholders);

  const project = await getProject(id);
  if (!project) throw new Error("项目创建失败");
  return project;
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<Project> {
  const db = await getDatabase();
  const now = nowIso();
  const code = input.code.trim().toUpperCase();

  await assertCodeAvailable(code, id);

  const result = await db.execute(
    `UPDATE projects
     SET name = ?, code = ?, description = ?, lifecycle_status = ?,
         start_date = ?, target_date = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.name,
      code,
      input.description,
      input.status,
      input.startDate,
      input.targetDate,
      now,
      id,
    ],
  );

  if (result.rowsAffected === 0) throw new Error("项目不存在或已被删除");

  await setProjectStakeholders(id, input.stakeholders);

  const project = await getProject(id);
  if (!project) throw new Error("项目不存在或已被删除");
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase();
  const linkResult = await db.execute(
    "DELETE FROM project_stakeholders WHERE project_id = ?",
    [id],
  );
  const projectResult = await db.execute(
    "DELETE FROM projects WHERE id = ?",
    [id],
  );

  if (projectResult.rowsAffected === 0) {
    throw new Error(
      `删除失败：未找到项目 ${id}（已清理 ${linkResult.rowsAffected} 条干系人关联）`,
    );
  }
}
