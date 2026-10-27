import { getDatabase } from "@/db";
import { createId } from "@/lib/ids";
import { nowIso, todayDateOnly } from "@/lib/dates";
import type {
  Communication,
  CommunicationAttachment,
  CommunicationAttachmentInput,
  CommunicationChannel,
  CommunicationDraftInput,
  CommunicationMetaInput,
  CommunicationRequirement,
  CommunicationSession,
  CommunicationSessionInput,
  CommunicationSessionTodo,
  CommunicationStatus,
  SourceRequirementLink,
} from "@/types/models";

interface CommunicationRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  communication_id: string;
  occurred_at: string;
  channel: string;
  participants: string;
  summary: string;
  decisions: string;
  follow_ups: string;
  todos: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface AttachmentRow {
  id: string;
  communication_id: string;
  session_id: string | null;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  source: string;
  created_at: string;
}

interface LinkRow {
  communication_id: string;
  requirement_id: string;
  code: string;
  title: string;
}

interface SourceLinkRow {
  communication_id: string;
  source_requirement_id: string;
  code: string;
  module_name: string;
  title: string;
}

type Database = Awaited<ReturnType<typeof getDatabase>>;

const SELECT_COMMUNICATIONS =
  "SELECT id, project_id, title, status, completed_at, archived_at, created_at, updated_at FROM communications";

function parseSessionTodos(raw: string | null): CommunicationSessionTodo[] {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value)
      ? value.filter(
          (item) =>
            typeof item?.id === "string" && typeof item?.content === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function mapSession(row: SessionRow): CommunicationSession {
  return {
    id: row.id,
    communicationId: row.communication_id,
    occurredAt: row.occurred_at,
    channel: row.channel as CommunicationChannel,
    participants: row.participants,
    summary: row.summary,
    decisions: row.decisions,
    followUps: row.follow_ups,
    todos: parseSessionTodos(row.todos),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttachment(row: AttachmentRow): CommunicationAttachment {
  return {
    id: row.id,
    communicationId: row.communication_id,
    sessionId: row.session_id,
    fileName: row.file_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size ?? 0),
    source: row.source,
    createdAt: row.created_at,
  };
}

function mapCommunication(
  row: CommunicationRow,
  requirements: CommunicationRequirement[],
  sourceRequirements: SourceRequirementLink[],
  sessions: CommunicationSession[],
  attachments: CommunicationAttachment[],
): Communication {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status as CommunicationStatus,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    requirements,
    sourceRequirements,
    sessions,
    attachments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadRequirementLinks(
  communicationIds: string[],
): Promise<Map<string, CommunicationRequirement[]>> {
  const result = new Map<string, CommunicationRequirement[]>();
  if (communicationIds.length === 0) return result;

  const db = await getDatabase();
  const placeholders = communicationIds.map(() => "?").join(", ");
  const rows = await db.select<LinkRow[]>(
    `SELECT cr.communication_id, r.id AS requirement_id, r.code, r.title
     FROM communication_requirements cr
     JOIN requirements r ON r.id = cr.requirement_id
     WHERE cr.communication_id IN (${placeholders})
     ORDER BY r.code ASC`,
    communicationIds,
  );

  for (const row of rows) {
    const list = result.get(row.communication_id) ?? [];
    list.push({ id: row.requirement_id, code: row.code, title: row.title });
    result.set(row.communication_id, list);
  }
  return result;
}

async function loadSourceRequirementLinks(
  communicationIds: string[],
): Promise<Map<string, SourceRequirementLink[]>> {
  const result = new Map<string, SourceRequirementLink[]>();
  if (communicationIds.length === 0) return result;

  const db = await getDatabase();
  const placeholders = communicationIds.map(() => "?").join(", ");
  const rows = await db.select<SourceLinkRow[]>(
    `SELECT csr.communication_id, sr.id AS source_requirement_id, sr.code,
            sr.module_name, sr.title
     FROM communication_source_requirements csr
     JOIN source_requirements sr ON sr.id = csr.source_requirement_id
     WHERE csr.communication_id IN (${placeholders})
     ORDER BY sr.code ASC`,
    communicationIds,
  );

  for (const row of rows) {
    const list = result.get(row.communication_id) ?? [];
    list.push({
      id: row.source_requirement_id,
      code: row.code,
      title: row.title,
      moduleName: row.module_name,
      status: "draft",
    });
    result.set(row.communication_id, list);
  }
  return result;
}

async function loadSessions(
  communicationIds: string[],
): Promise<Map<string, CommunicationSession[]>> {
  const result = new Map<string, CommunicationSession[]>();
  if (communicationIds.length === 0) return result;

  const db = await getDatabase();
  const placeholders = communicationIds.map(() => "?").join(", ");
  const rows = await db.select<SessionRow[]>(
    `SELECT * FROM communication_sessions
     WHERE communication_id IN (${placeholders})
     ORDER BY sort_order ASC, occurred_at ASC`,
    communicationIds,
  );
  for (const row of rows) {
    const list = result.get(row.communication_id) ?? [];
    list.push(mapSession(row));
    result.set(row.communication_id, list);
  }
  return result;
}

async function loadAttachments(
  communicationIds: string[],
): Promise<Map<string, CommunicationAttachment[]>> {
  const result = new Map<string, CommunicationAttachment[]>();
  if (communicationIds.length === 0) return result;

  const db = await getDatabase();
  const placeholders = communicationIds.map(() => "?").join(", ");
  const rows = await db.select<AttachmentRow[]>(
    `SELECT * FROM communication_attachments
     WHERE communication_id IN (${placeholders}) AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    communicationIds,
  );
  for (const row of rows) {
    const list = result.get(row.communication_id) ?? [];
    list.push(mapAttachment(row));
    result.set(row.communication_id, list);
  }
  return result;
}

async function getCommunicationWithDetails(
  id: string,
): Promise<Communication | null> {
  const db = await getDatabase();
  const rows = await db.select<CommunicationRow[]>(
    `${SELECT_COMMUNICATIONS} WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const ids = [id];
  const [requirements, sourceRequirements, sessions, attachments] =
    await Promise.all([
      loadRequirementLinks(ids),
      loadSourceRequirementLinks(ids),
      loadSessions(ids),
      loadAttachments(ids),
    ]);
  return mapCommunication(
    rows[0],
    requirements.get(id) ?? [],
    sourceRequirements.get(id) ?? [],
    sessions.get(id) ?? [],
    attachments.get(id) ?? [],
  );
}

async function replaceRequirementLinks(
  db: Database,
  communicationId: string,
  requirementIds: string[],
) {
  const originRows = await db.select<{ id: string }[]>(
    "SELECT id FROM requirements WHERE origin_communication_id = ?",
    [communicationId],
  );
  const uniqueIds = [
    ...new Set([
      ...requirementIds.filter(Boolean),
      ...originRows.map((row) => row.id),
    ]),
  ];

  await db.execute(
    "DELETE FROM communication_requirements WHERE communication_id = ?",
    [communicationId],
  );
  if (uniqueIds.length === 0) return;

  const placeholders = uniqueIds.map(() => "(?, ?)").join(", ");
  const values = uniqueIds.flatMap((requirementId) => [
    communicationId,
    requirementId,
  ]);
  await db.execute(
    `INSERT INTO communication_requirements (communication_id, requirement_id)
     VALUES ${placeholders}`,
    values,
  );
}

async function replaceSourceRequirementLinks(
  db: Database,
  communicationId: string,
  sourceRequirementIds: string[],
) {
  await db.execute(
    "DELETE FROM communication_source_requirements WHERE communication_id = ?",
    [communicationId],
  );
  const uniqueIds = [...new Set(sourceRequirementIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const placeholders = uniqueIds.map(() => "(?, ?)").join(", ");
  const values = uniqueIds.flatMap((sourceRequirementId) => [
    communicationId,
    sourceRequirementId,
  ]);
  await db.execute(
    `INSERT INTO communication_source_requirements
       (communication_id, source_requirement_id)
     VALUES ${placeholders}`,
    values,
  );
}

export async function listCommunications(
  projectId: string,
): Promise<Communication[]> {
  const db = await getDatabase();
  const rows = await db.select<CommunicationRow[]>(
    `${SELECT_COMMUNICATIONS}
     WHERE project_id = ?
     ORDER BY CASE status WHEN 'archived' THEN 1 ELSE 0 END ASC,
              updated_at DESC`,
    [projectId],
  );
  const ids = rows.map((row) => row.id);
  const [requirements, sourceRequirements, sessions, attachments] =
    await Promise.all([
      loadRequirementLinks(ids),
      loadSourceRequirementLinks(ids),
      loadSessions(ids),
      loadAttachments(ids),
    ]);
  return rows.map((row) =>
    mapCommunication(
      row,
      requirements.get(row.id) ?? [],
      sourceRequirements.get(row.id) ?? [],
      sessions.get(row.id) ?? [],
      attachments.get(row.id) ?? [],
    ),
  );
}

export async function listCommunicationsForRequirement(
  requirementId: string,
): Promise<Communication[]> {
  const db = await getDatabase();
  const rows = await db.select<CommunicationRow[]>(
    `${SELECT_COMMUNICATIONS}
     WHERE id IN (
       SELECT communication_id FROM communication_requirements
       WHERE requirement_id = ?
     )
     ORDER BY updated_at DESC`,
    [requirementId],
  );
  const ids = rows.map((row) => row.id);
  const [requirements, sourceRequirements, sessions, attachments] =
    await Promise.all([
      loadRequirementLinks(ids),
      loadSourceRequirementLinks(ids),
      loadSessions(ids),
      loadAttachments(ids),
    ]);
  return rows.map((row) =>
    mapCommunication(
      row,
      requirements.get(row.id) ?? [],
      sourceRequirements.get(row.id) ?? [],
      sessions.get(row.id) ?? [],
      attachments.get(row.id) ?? [],
    ),
  );
}

export async function getCommunication(
  id: string,
): Promise<Communication | null> {
  return getCommunicationWithDetails(id);
}

export async function createCommunicationDraft(
  projectId: string,
  input: CommunicationDraftInput = {},
): Promise<Communication> {
  const db = await getDatabase();
  const id = createId();
  const sessionId = createId();
  const now = nowIso();
  const today = todayDateOnly();
  const title = input.title?.trim() || `沟通记录 ${today}`;

  await db.execute(
    `INSERT INTO communications
       (id, project_id, occurred_at, channel, participants, summary, decisions,
        follow_ups, created_at, updated_at, title, status, completed_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, NULL)`,
    [id, projectId, today, "meeting", "", "", "", "", now, now, title],
  );
  await db.execute(
    `INSERT INTO communication_sessions
       (id, communication_id, occurred_at, channel, participants, summary,
        decisions, follow_ups, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', '', '', '', 0, ?, ?)`,
    [sessionId, id, today, "meeting", now, now],
  );

  await replaceRequirementLinks(db, id, input.requirementIds ?? []);
  await replaceSourceRequirementLinks(
    db,
    id,
    input.sourceRequirementIds ?? [],
  );

  const created = await getCommunicationWithDetails(id);
  if (!created) throw new Error("沟通记录创建失败");
  return created;
}

export async function updateCommunicationMeta(
  id: string,
  input: CommunicationMetaInput,
): Promise<Communication> {
  const existing = await getCommunicationWithDetails(id);
  if (!existing) throw new Error("沟通记录不存在");
  const db = await getDatabase();
  const now = nowIso();
  const title = input.title.trim() || existing.title || "未命名沟通主题";
  const status = existing.status === "draft" ? "in_progress" : existing.status;

  await db.execute(
    `UPDATE communications
     SET title = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [title, status, now, id],
  );
  await replaceRequirementLinks(db, id, input.requirementIds);
  await replaceSourceRequirementLinks(db, id, input.sourceRequirementIds);

  const updated = await getCommunicationWithDetails(id);
  if (!updated) throw new Error("沟通记录不存在");
  return updated;
}

export async function updateCommunicationSession(
  sessionId: string,
  input: CommunicationSessionInput,
): Promise<CommunicationSession> {
  if (!input.occurredAt) throw new Error("沟通日期不能为空");
  const db = await getDatabase();
  const rows = await db.select<SessionRow[]>(
    "SELECT * FROM communication_sessions WHERE id = ? LIMIT 1",
    [sessionId],
  );
  if (!rows[0]) throw new Error("沟通场次不存在");
  const now = nowIso();
  const todos = (input.todos ?? [])
    .map((todo) => ({
      id: todo.id,
      content: todo.content.trim(),
      done: Boolean(todo.done),
      requirementId: todo.requirementId,
    }))
    .filter((todo) => todo.content);

  await db.execute(
    `UPDATE communication_sessions
     SET occurred_at = ?, channel = ?, participants = ?, summary = ?,
         decisions = ?, follow_ups = ?, todos = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.occurredAt,
      input.channel,
      input.participants.trim(),
      input.summary.trim(),
      input.decisions.trim(),
      input.followUps.trim(),
      JSON.stringify(todos),
      now,
      sessionId,
    ],
  );
  await db.execute(
    `UPDATE communications
     SET status = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END,
         updated_at = ?
     WHERE id = ?`,
    [now, rows[0].communication_id],
  );

  const updated = await db.select<SessionRow[]>(
    "SELECT * FROM communication_sessions WHERE id = ? LIMIT 1",
    [sessionId],
  );
  if (!updated[0]) throw new Error("沟通场次不存在");
  return mapSession(updated[0]);
}

export async function addCommunicationSession(
  communicationId: string,
  occurredAt?: string,
): Promise<CommunicationSession> {
  const db = await getDatabase();
  const communicationRows = await db.select<CommunicationRow[]>(
    `${SELECT_COMMUNICATIONS} WHERE id = ? LIMIT 1`,
    [communicationId],
  );
  if (!communicationRows[0]) throw new Error("沟通记录不存在");

  const lastRows = await db.select<SessionRow[]>(
    `SELECT * FROM communication_sessions
     WHERE communication_id = ?
     ORDER BY sort_order DESC
     LIMIT 1`,
    [communicationId],
  );
  const last = lastRows[0];
  const id = createId();
  const now = nowIso();
  const date = occurredAt ?? todayDateOnly();
  const channel = last?.channel ?? "meeting";
  const participants = last?.participants ?? "";
  const sortOrder = (last?.sort_order ?? -1) + 1;

  await db.execute(
    `INSERT INTO communication_sessions
       (id, communication_id, occurred_at, channel, participants, summary,
        decisions, follow_ups, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', '', '', ?, ?, ?)`,
    [id, communicationId, date, channel, participants, sortOrder, now, now],
  );
  await db.execute(
    `UPDATE communications
     SET status = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END,
         updated_at = ?
     WHERE id = ?`,
    [now, communicationId],
  );

  const created = await db.select<SessionRow[]>(
    "SELECT * FROM communication_sessions WHERE id = ? LIMIT 1",
    [id],
  );
  if (!created[0]) throw new Error("沟通场次创建失败");
  return mapSession(created[0]);
}

async function setCommunicationStatus(
  id: string,
  status: CommunicationStatus,
): Promise<Communication> {
  const existing = await getCommunicationWithDetails(id);
  if (!existing) throw new Error("沟通记录不存在");
  const db = await getDatabase();
  const now = nowIso();
  let completedAt = existing.completedAt;
  let archivedAt = existing.archivedAt;

  if (status === "completed") {
    completedAt = now;
    archivedAt = null;
  } else if (status === "in_progress") {
    completedAt = null;
    archivedAt = null;
  } else if (status === "archived") {
    archivedAt = now;
  }

  await db.execute(
    `UPDATE communications
     SET status = ?, completed_at = ?, archived_at = ?, updated_at = ?
     WHERE id = ?`,
    [status, completedAt, archivedAt, now, id],
  );
  const updated = await getCommunicationWithDetails(id);
  if (!updated) throw new Error("沟通记录不存在");
  return updated;
}

export async function completeCommunication(
  id: string,
): Promise<Communication> {
  return setCommunicationStatus(id, "completed");
}

export async function reopenCommunication(
  id: string,
): Promise<Communication> {
  return setCommunicationStatus(id, "in_progress");
}

export async function archiveCommunication(
  id: string,
): Promise<Communication> {
  return setCommunicationStatus(id, "archived");
}

export async function restoreCommunication(
  id: string,
): Promise<Communication> {
  const existing = await getCommunicationWithDetails(id);
  if (!existing) throw new Error("沟通记录不存在");
  return setCommunicationStatus(
    id,
    existing.completedAt ? "completed" : "in_progress",
  );
}

export async function addCommunicationAttachment(
  communicationId: string,
  input: CommunicationAttachmentInput,
): Promise<CommunicationAttachment> {
  const db = await getDatabase();
  const communicationRows = await db.select<CommunicationRow[]>(
    `${SELECT_COMMUNICATIONS} WHERE id = ? LIMIT 1`,
    [communicationId],
  );
  if (!communicationRows[0]) throw new Error("沟通记录不存在");
  if (input.sessionId) {
    const sessionRows = await db.select<{ id: string }[]>(
      "SELECT id FROM communication_sessions WHERE id = ? AND communication_id = ? LIMIT 1",
      [input.sessionId, communicationId],
    );
    if (!sessionRows[0]) throw new Error("沟通场次不存在");
  }

  const id = createId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO communication_attachments
       (id, communication_id, session_id, file_name, file_path, mime_type,
        file_size, source, deleted_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      id,
      communicationId,
      input.sessionId,
      input.fileName,
      input.filePath,
      input.mimeType,
      input.fileSize,
      input.source,
      now,
    ],
  );
  await db.execute("UPDATE communications SET updated_at = ? WHERE id = ?", [
    now,
    communicationId,
  ]);
  if (input.sessionId) {
    await db.execute(
      "UPDATE communication_sessions SET updated_at = ? WHERE id = ?",
      [now, input.sessionId],
    );
  }

  return {
    id,
    communicationId,
    sessionId: input.sessionId,
    fileName: input.fileName,
    filePath: input.filePath,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    source: input.source,
    createdAt: now,
  };
}

export async function removeCommunicationAttachment(
  attachmentId: string,
): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<AttachmentRow[]>(
    "SELECT * FROM communication_attachments WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [attachmentId],
  );
  if (!rows[0]) throw new Error("附件不存在");
  const now = nowIso();
  await db.execute(
    "UPDATE communication_attachments SET deleted_at = ? WHERE id = ?",
    [now, attachmentId],
  );
  await db.execute("UPDATE communications SET updated_at = ? WHERE id = ?", [
    now,
    rows[0].communication_id,
  ]);
}
