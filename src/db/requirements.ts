import { getDatabase } from "@/db";
import {
  assertSourceRequirementsBelongToProject,
  replaceRequirementSources,
} from "@/db/sourceRequirements";
import { createId } from "@/lib/ids";
import { nowIso } from "@/lib/dates";
import type {
  Requirement,
  RequirementInput,
  RequirementOrigin,
  RequirementPriority,
  RequirementRevision,
  RequirementSnapshot,
  RequirementSource,
  RequirementStatus,
  RequirementType,
} from "@/types/models";

interface RequirementRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  depth: number;
  code: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  design_notes: string;
  type: string;
  source: string;
  origin: string;
  origin_communication_id: string | null;
  priority: number;
  status: string;
  estimate_days: number | null;
  current_revision_no: number;
  confirmed_at: string | null;
  dev_started_at: string | null;
  dev_completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface RevisionRow {
  id: string;
  requirement_id: string;
  revision_no: number;
  snapshot_json: string;
  change_summary: string;
  created_at: string;
}

type Database = Awaited<ReturnType<typeof getDatabase>>;

interface ResolvedOrigin {
  origin: RequirementOrigin;
  originCommunicationId: string | null;
  sourceRequirementIds: string[];
}

const SELECT_REQUIREMENTS = "SELECT * FROM requirements";

function mapRequirement(row: RequirementRow): Requirement {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    depth: row.depth,
    code: row.code,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptance_criteria,
    designNotes: row.design_notes,
    type: row.type as RequirementType,
    source: row.source as RequirementSource,
    origin: row.origin as RequirementOrigin,
    originCommunicationId: row.origin_communication_id,
    priority: row.priority as RequirementPriority,
    status: row.status as RequirementStatus,
    estimateDays: row.estimate_days,
    currentRevisionNo: row.current_revision_no,
    confirmedAt: row.confirmed_at,
    devStartedAt: row.dev_started_at,
    devCompletedAt: row.dev_completed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRevision(row: RevisionRow): RequirementRevision {
  let snapshot: RequirementSnapshot;
  try {
    snapshot = JSON.parse(row.snapshot_json) as RequirementSnapshot;
  } catch {
    throw new Error(`需求 ${row.requirement_id} 的版本 ${row.revision_no} 数据损坏`);
  }
  return {
    id: row.id,
    requirementId: row.requirement_id,
    revisionNo: row.revision_no,
    snapshot,
    changeSummary: row.change_summary,
    createdAt: row.created_at,
  };
}

function snapshotFromInput(input: RequirementInput): RequirementSnapshot {
  return {
    title: input.title,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    designNotes: input.designNotes,
    type: input.type,
    source: input.source,
    priority: input.priority,
    status: input.status,
    estimateDays: input.estimateDays,
  };
}

async function insertRevision(
  db: Awaited<ReturnType<typeof getDatabase>>,
  requirementId: string,
  revisionNo: number,
  snapshot: RequirementSnapshot,
  changeSummary: string,
) {
  await db.execute(
    `INSERT INTO requirement_revisions
       (id, requirement_id, revision_no, snapshot_json, change_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      createId(),
      requirementId,
      revisionNo,
      JSON.stringify(snapshot),
      changeSummary,
      nowIso(),
    ],
  );
}

async function resolveDepth(
  projectId: string,
  parentId: string | null,
): Promise<number> {
  if (!parentId) return 0;
  const db = await getDatabase();
  const rows = await db.select<{ depth: number }[]>(
    "SELECT depth FROM requirements WHERE id = ? AND project_id = ? LIMIT 1",
    [parentId, projectId],
  );
  if (!rows[0]) throw new Error("父需求不存在");
  if (rows[0].depth >= 2) {
    throw new Error("需求最多支持三层：需求 → 模块 → 子功能");
  }
  return rows[0].depth + 1;
}

async function resolveOrigin(
  projectId: string,
  input: RequirementInput,
): Promise<ResolvedOrigin> {
  const origin = input.origin ?? "direct";
  if (origin === "baseline") {
    const sourceRequirementIds = await assertSourceRequirementsBelongToProject(
      projectId,
      input.sourceRequirementIds ?? [],
    );
    if (sourceRequirementIds.length === 0) {
      throw new Error("原始需求来源至少需要关联一条原始需求");
    }
    return {
      origin,
      originCommunicationId: null,
      sourceRequirementIds,
    };
  }

  if (origin === "communication") {
    const originCommunicationId = input.originCommunicationId;
    if (!originCommunicationId) {
      throw new Error("沟通记录来源必须指定一条沟通记录");
    }
    const db = await getDatabase();
    const rows = await db.select<{ id: string }[]>(
      "SELECT id FROM communications WHERE id = ? AND project_id = ? LIMIT 1",
      [originCommunicationId, projectId],
    );
    if (!rows[0]) throw new Error("来源沟通记录不存在或不属于当前项目");
    const sourceRequirementIds = await assertSourceRequirementsBelongToProject(
      projectId,
      input.sourceRequirementIds ?? [],
    );
    return {
      origin,
      originCommunicationId,
      sourceRequirementIds,
    };
  }

  return {
    origin: "direct",
    originCommunicationId: null,
    sourceRequirementIds: [],
  };
}

async function linkOriginCommunication(
  db: Database,
  communicationId: string,
  requirementId: string,
) {
  await db.execute(
    `INSERT OR IGNORE INTO communication_requirements
       (communication_id, requirement_id)
     VALUES (?, ?)`,
    [communicationId, requirementId],
  );
}

export async function listRequirements(
  projectId: string,
): Promise<Requirement[]> {
  const db = await getDatabase();
  const rows = await db.select<RequirementRow[]>(
    `${SELECT_REQUIREMENTS} WHERE project_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [projectId],
  );
  return rows.map(mapRequirement);
}

export async function getRequirement(id: string): Promise<Requirement | null> {
  const db = await getDatabase();
  const rows = await db.select<RequirementRow[]>(
    `${SELECT_REQUIREMENTS} WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRequirement(rows[0]) : null;
}

export async function listRequirementRevisions(
  requirementId: string,
): Promise<RequirementRevision[]> {
  const db = await getDatabase();
  const rows = await db.select<RevisionRow[]>(
    `SELECT * FROM requirement_revisions
     WHERE requirement_id = ?
     ORDER BY revision_no DESC`,
    [requirementId],
  );
  return rows.map(mapRevision);
}

export async function createRequirement(
  projectId: string,
  input: RequirementInput,
): Promise<Requirement> {
  const db = await getDatabase();
  const title = input.title.trim();
  if (!title) throw new Error("需求标题不能为空");

  const projectRows = await db.select<{ code: string; req_seq: number }[]>(
    "SELECT code, req_seq FROM projects WHERE id = ? LIMIT 1",
    [projectId],
  );
  if (!projectRows[0]) throw new Error("项目不存在");

  const depth = await resolveDepth(projectId, input.parentId);
  const seq = Number(projectRows[0].req_seq ?? 0) + 1;
  const code = `${projectRows[0].code}-${String(seq).padStart(3, "0")}`;
  const id = createId();
  const now = nowIso();

  if (input.status === "cancelled" && !input.cancelReason?.trim()) {
    throw new Error("取消需求必须填写原因");
  }

  const devStartedAt =
    input.status === "developing" || input.status === "done" ? now : null;
  const devCompletedAt = input.status === "done" ? now : null;
  const confirmedAt = input.status === "confirmed" ? now : null;
  const cancelledAt = input.status === "cancelled" ? now : null;
  const cancelReason =
    input.status === "cancelled" ? input.cancelReason?.trim() ?? null : null;

  const resolvedOrigin = await resolveOrigin(projectId, input);

  await db.execute(
    `INSERT INTO requirements
       (id, project_id, parent_id, depth, code, title, description,
        acceptance_criteria, design_notes, type, source, origin,
        origin_communication_id, priority, status, estimate_days,
        current_revision_no, confirmed_at, dev_started_at, dev_completed_at,
        cancelled_at, cancel_reason, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      projectId,
      input.parentId,
      depth,
      code,
      title,
      input.description,
      input.acceptanceCriteria,
      input.designNotes,
      input.type,
      input.source,
      resolvedOrigin.origin,
      resolvedOrigin.originCommunicationId,
      input.priority,
      input.status,
      input.estimateDays,
      1,
      confirmedAt,
      devStartedAt,
      devCompletedAt,
      cancelledAt,
      cancelReason,
      0,
      now,
      now,
    ],
  );

  await replaceRequirementSources(
    db,
    id,
    resolvedOrigin.sourceRequirementIds,
  );
  if (resolvedOrigin.originCommunicationId) {
    await linkOriginCommunication(
      db,
      resolvedOrigin.originCommunicationId,
      id,
    );
  }

  await db.execute("UPDATE projects SET req_seq = ?, updated_at = ? WHERE id = ?", [
    seq,
    now,
    projectId,
  ]);
  await insertRevision(
    db,
    id,
    1,
    snapshotFromInput({ ...input, title }),
    "创建需求",
  );

  const created = await getRequirement(id);
  if (!created) throw new Error("需求创建失败");
  return created;
}

export async function updateRequirement(
  id: string,
  input: RequirementInput,
): Promise<Requirement> {
  const db = await getDatabase();
  const existing = await getRequirement(id);
  if (!existing) throw new Error("需求不存在");

  const title = input.title.trim();
  if (!title) throw new Error("需求标题不能为空");
  if (input.status === "cancelled" && !input.cancelReason?.trim()) {
    throw new Error("取消需求必须填写原因");
  }

  const now = nowIso();
  let devStartedAt = existing.devStartedAt;
  let devCompletedAt = existing.devCompletedAt;

  if (input.status === "developing" && !devStartedAt) devStartedAt = now;
  if (input.status === "done") {
    if (!devStartedAt) devStartedAt = now;
    if (existing.status !== "done") devCompletedAt = now;
  } else if (existing.status === "done") {
    devCompletedAt = null;
  }

  const confirmedAt =
    input.status === "confirmed" ? existing.confirmedAt ?? now : existing.confirmedAt;
  let cancelledAt = existing.cancelledAt;
  let cancelReason = input.cancelReason?.trim() || null;
  if (input.status === "cancelled") {
    cancelledAt = existing.cancelledAt ?? now;
  } else {
    cancelledAt = null;
    cancelReason = null;
  }

  const revisionNo = existing.currentRevisionNo + 1;
  const resolvedOrigin = await resolveOrigin(existing.projectId, input);

  await db.execute(
    `UPDATE requirements
     SET title = ?, description = ?, acceptance_criteria = ?, design_notes = ?,
         type = ?, source = ?, origin = ?, origin_communication_id = ?,
         priority = ?, status = ?, estimate_days = ?,
         current_revision_no = ?, confirmed_at = ?, dev_started_at = ?,
         dev_completed_at = ?, cancelled_at = ?, cancel_reason = ?, updated_at = ?
     WHERE id = ?`,
    [
      title,
      input.description,
      input.acceptanceCriteria,
      input.designNotes,
      input.type,
      input.source,
      resolvedOrigin.origin,
      resolvedOrigin.originCommunicationId,
      input.priority,
      input.status,
      input.estimateDays,
      revisionNo,
      confirmedAt,
      devStartedAt,
      devCompletedAt,
      cancelledAt,
      cancelReason,
      now,
      id,
    ],
  );

  await replaceRequirementSources(
    db,
    id,
    resolvedOrigin.sourceRequirementIds,
  );
  if (resolvedOrigin.originCommunicationId) {
    await linkOriginCommunication(
      db,
      resolvedOrigin.originCommunicationId,
      id,
    );
  }

  await db.execute("UPDATE projects SET updated_at = ? WHERE id = ?", [
    now,
    existing.projectId,
  ]);
  await insertRevision(
    db,
    id,
    revisionNo,
    snapshotFromInput({ ...input, title }),
    "更新需求",
  );

  const updated = await getRequirement(id);
  if (!updated) throw new Error("需求不存在");
  return updated;
}
