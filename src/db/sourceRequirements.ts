import { getDatabase } from "@/db";
import { createId } from "@/lib/ids";
import { nowIso } from "@/lib/dates";
import type {
  ManualSourceRequirementInput,
  RequirementStatus,
  SourceDocument,
  SourceDocumentInput,
  SourceRequirement,
  SourceRequirementLink,
} from "@/types/models";

type Database = Awaited<ReturnType<typeof getDatabase>>;

interface SourceDocumentRow {
  id: string;
  project_id: string;
  doc_no: number;
  title: string;
  version: string;
  file_name: string;
  file_path: string;
  sheet_name: string;
  note: string;
  imported_at: string;
  is_manual: number;
  item_count: number;
}

interface SourceRequirementRow {
  id: string;
  project_id: string;
  document_id: string;
  document_title: string;
  document_version: string;
  document_is_manual: number;
  doc_no: number;
  module_name: string;
  code: string;
  title: string;
  description: string;
  source_row: number;
  sort_order: number;
}

interface RequirementLinkRow {
  source_requirement_id: string;
  requirement_id: string;
  code: string;
  title: string;
  status: string;
}

function mapSourceDocument(row: SourceDocumentRow): SourceDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    docNo: row.doc_no,
    title: row.title,
    version: row.version,
    fileName: row.file_name,
    filePath: row.file_path,
    sheetName: row.sheet_name,
    note: row.note,
    importedAt: row.imported_at,
    isManual: Boolean(row.is_manual),
    itemCount: Number(row.item_count ?? 0),
  };
}

function mapSourceRequirement(
  row: SourceRequirementRow,
  linkedRequirements: SourceRequirementLink[],
): SourceRequirement {
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    documentVersion: row.document_version,
    documentIsManual: Boolean(row.document_is_manual),
    docNo: row.doc_no,
    moduleName: row.module_name,
    code: row.code,
    title: row.title,
    description: row.description,
    sourceRow: row.source_row,
    sortOrder: row.sort_order,
    linkedRequirements,
  };
}

async function loadRequirementLinks(
  projectId: string,
): Promise<Map<string, SourceRequirementLink[]>> {
  const db = await getDatabase();
  const rows = await db.select<RequirementLinkRow[]>(
    `SELECT rs.source_requirement_id, r.id AS requirement_id, r.code, r.title, r.status
     FROM requirement_sources rs
     JOIN requirements r ON r.id = rs.requirement_id
     WHERE r.project_id = ?
     ORDER BY r.code ASC`,
    [projectId],
  );
  const result = new Map<string, SourceRequirementLink[]>();
  for (const row of rows) {
    const list = result.get(row.source_requirement_id) ?? [];
    list.push({
      id: row.requirement_id,
      code: row.code,
      title: row.title,
      moduleName: "",
      status: row.status as RequirementStatus,
    });
    result.set(row.source_requirement_id, list);
  }
  return result;
}

export async function listSourceDocuments(
  projectId: string,
): Promise<SourceDocument[]> {
  const db = await getDatabase();
  const rows = await db.select<SourceDocumentRow[]>(
    `SELECT sd.*, COUNT(sr.id) AS item_count
     FROM source_documents sd
     LEFT JOIN source_requirements sr ON sr.document_id = sd.id
     WHERE sd.project_id = ?
     GROUP BY sd.id
     ORDER BY sd.doc_no DESC`,
    [projectId],
  );
  return rows.map(mapSourceDocument);
}

export async function listSourceRequirements(
  projectId: string,
): Promise<SourceRequirement[]> {
  const db = await getDatabase();
  const rows = await db.select<SourceRequirementRow[]>(
    `SELECT sr.*, sd.title AS document_title, sd.version AS document_version,
            sd.is_manual AS document_is_manual, sd.doc_no
     FROM source_requirements sr
     JOIN source_documents sd ON sd.id = sr.document_id
     WHERE sr.project_id = ?
     ORDER BY sd.doc_no ASC, sr.sort_order ASC`,
    [projectId],
  );
  const links = await loadRequirementLinks(projectId);
  return rows.map((row) =>
    mapSourceRequirement(row, links.get(row.id) ?? []),
  );
}

export async function createSourceDocument(
  projectId: string,
  input: SourceDocumentInput,
): Promise<SourceDocument> {
  const title = input.title.trim();
  if (!title) throw new Error("来源文件标题不能为空");
  if (input.items.length === 0) throw new Error("没有可导入的原始需求");

  const db = await getDatabase();
  const maxRows = await db.select<{ max_no: number | null }[]>(
    "SELECT MAX(doc_no) AS max_no FROM source_documents WHERE project_id = ?",
    [projectId],
  );
  const docNo = Number(maxRows[0]?.max_no ?? 0) + 1;
  const docId = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO source_documents
       (id, project_id, doc_no, title, version, file_name, file_path, sheet_name,
        note, imported_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      docId,
      projectId,
      docNo,
      title,
      input.version.trim(),
      input.fileName,
      input.filePath,
      input.sheetName,
      input.note.trim(),
      now,
      now,
    ],
  );

  try {
    const moduleIndexes = new Map<string, number>();
    const itemCounts = new Map<string, number>();
    let sortOrder = 0;

    for (const item of input.items) {
      const moduleName = item.moduleName.trim() || "未分组";
      const itemTitle = item.title.trim() || "未命名原始需求";
      if (!moduleIndexes.has(moduleName)) {
        moduleIndexes.set(moduleName, moduleIndexes.size + 1);
        itemCounts.set(moduleName, 0);
      }
      const moduleIndex = moduleIndexes.get(moduleName) ?? 1;
      const itemIndex = (itemCounts.get(moduleName) ?? 0) + 1;
      itemCounts.set(moduleName, itemIndex);
      const code = `SRC-${String(docNo).padStart(2, "0")}-${String(moduleIndex).padStart(2, "0")}-${String(itemIndex).padStart(2, "0")}`;

      await db.execute(
        `INSERT INTO source_requirements
           (id, project_id, document_id, module_name, code, title, description,
            source_row, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createId(),
          projectId,
          docId,
          moduleName,
          code,
          itemTitle,
          item.description.trim(),
          item.sourceRow,
          sortOrder,
          now,
        ],
      );
      sortOrder += 1;
    }
  } catch (cause) {
    await db.execute("DELETE FROM source_documents WHERE id = ?", [docId]);
    throw cause;
  }

  const documents = await listSourceDocuments(projectId);
  const created = documents.find((document) => document.id === docId);
  if (!created) throw new Error("原始需求导入失败");
  return created;
}

export async function createManualSourceRequirement(
  projectId: string,
  input: ManualSourceRequirementInput,
): Promise<SourceRequirement> {
  const title = input.title.trim();
  if (!title) throw new Error("原始需求标题不能为空");
  const moduleName = input.moduleName.trim() || "未分组";

  const db = await getDatabase();
  const now = nowIso();
  const documentRows = await db.select<SourceDocumentRow[]>(
    `SELECT sd.*,
            (SELECT COUNT(*) FROM source_requirements sr WHERE sr.document_id = sd.id) AS item_count
     FROM source_documents sd
     WHERE sd.project_id = ? AND sd.is_manual = 1
     ORDER BY sd.doc_no ASC
     LIMIT 1`,
    [projectId],
  );

  let document = documentRows[0];
  if (!document) {
    const maxRows = await db.select<{ max_no: number | null }[]>(
      "SELECT MAX(doc_no) AS max_no FROM source_documents WHERE project_id = ?",
      [projectId],
    );
    const docNo = Number(maxRows[0]?.max_no ?? 0) + 1;
    const docId = createId();
    const documentTitle = "手工录入原始需求";
    await db.execute(
      `INSERT INTO source_documents
         (id, project_id, doc_no, title, version, file_name, file_path, sheet_name,
          note, imported_at, created_at, is_manual)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        docId,
        projectId,
        docNo,
        documentTitle,
        "",
        "",
        "",
        "",
        "手工录入",
        now,
        now,
      ],
    );
    document = {
      id: docId,
      project_id: projectId,
      doc_no: docNo,
      title: documentTitle,
      version: "",
      file_name: "",
      file_path: "",
      sheet_name: "",
      note: "手工录入",
      imported_at: now,
      is_manual: 1,
      item_count: 0,
    };
  }

  const existingRows = await db.select<
    { module_name: string; sort_order: number }[]
  >(
    `SELECT module_name, sort_order FROM source_requirements
     WHERE document_id = ?
     ORDER BY sort_order ASC`,
    [document.id],
  );

  const moduleIndexes = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  let maxSortOrder = -1;
  for (const row of existingRows) {
    if (!moduleIndexes.has(row.module_name)) {
      moduleIndexes.set(row.module_name, moduleIndexes.size + 1);
      itemCounts.set(row.module_name, 0);
    }
    itemCounts.set(
      row.module_name,
      (itemCounts.get(row.module_name) ?? 0) + 1,
    );
    maxSortOrder = Math.max(maxSortOrder, row.sort_order);
  }

  if (!moduleIndexes.has(moduleName)) {
    moduleIndexes.set(moduleName, moduleIndexes.size + 1);
    itemCounts.set(moduleName, 0);
  }
  const moduleIndex = moduleIndexes.get(moduleName) ?? 1;
  const itemIndex = (itemCounts.get(moduleName) ?? 0) + 1;
  const code = `SRC-${String(document.doc_no).padStart(2, "0")}-${String(moduleIndex).padStart(2, "0")}-${String(itemIndex).padStart(2, "0")}`;
  const id = createId();
  const description = input.description.trim();
  const sortOrder = maxSortOrder + 1;

  await db.execute(
    `INSERT INTO source_requirements
       (id, project_id, document_id, module_name, code, title, description,
        source_row, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      projectId,
      document.id,
      moduleName,
      code,
      title,
      description,
      0,
      sortOrder,
      now,
    ],
  );

  return {
    id,
    projectId,
    documentId: document.id,
    documentTitle: document.title,
    documentVersion: document.version,
    documentIsManual: true,
    docNo: document.doc_no,
    moduleName,
    code,
    title,
    description,
    sourceRow: 0,
    sortOrder,
    linkedRequirements: [],
  };
}

export async function listRequirementSourceIds(
  requirementId: string,
): Promise<string[]> {  const db = await getDatabase();
  const rows = await db.select<{ source_requirement_id: string }[]>(
    `SELECT source_requirement_id FROM requirement_sources
     WHERE requirement_id = ?
     ORDER BY source_requirement_id`,
    [requirementId],
  );
  return rows.map((row) => row.source_requirement_id);
}

export async function assertSourceRequirementsBelongToProject(
  projectId: string,
  sourceRequirementIds: string[],
): Promise<string[]> {
  const uniqueIds = [...new Set(sourceRequirementIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const db = await getDatabase();
  const placeholders = uniqueIds.map(() => "?").join(", ");
  const rows = await db.select<{ id: string }[]>(
    `SELECT id FROM source_requirements
     WHERE project_id = ? AND id IN (${placeholders})`,
    [projectId, ...uniqueIds],
  );
  if (rows.length !== uniqueIds.length) {
    throw new Error("关联的原始需求不存在或不属于当前项目");
  }
  return uniqueIds;
}

export async function replaceRequirementSources(
  db: Database,
  requirementId: string,
  sourceRequirementIds: string[],
) {
  await db.execute(
    "DELETE FROM requirement_sources WHERE requirement_id = ?",
    [requirementId],
  );
  const uniqueIds = [...new Set(sourceRequirementIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const placeholders = uniqueIds.map(() => "(?, ?)").join(", ");
  const values = uniqueIds.flatMap((sourceRequirementId) => [
    requirementId,
    sourceRequirementId,
  ]);
  await db.execute(
    `INSERT INTO requirement_sources (requirement_id, source_requirement_id)
     VALUES ${placeholders}`,
    values,
  );
}
