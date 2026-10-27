import { getDatabase } from "@/db";
import { createId } from "@/lib/ids";
import { nowIso } from "@/lib/dates";
import type {
  Stakeholder,
  StakeholderContact,
  StakeholderContactType,
  StakeholderInput,
} from "@/types/models";

interface StakeholderRow {
  id: string;
  name: string;
  company: string | null;
  notes: string;
  project_count: number;
  created_at: string;
  updated_at: string;
}

interface ContactRow {
  id: string;
  stakeholder_id: string;
  type: string;
  value: string;
  sort_order: number;
}

const SELECT_STAKEHOLDERS = `
  SELECT
    s.id,
    s.name,
    s.company,
    s.notes,
    s.created_at,
    s.updated_at,
    (SELECT COUNT(*) FROM project_stakeholders ps WHERE ps.stakeholder_id = s.id) AS project_count
  FROM stakeholders s
`;

function mapContact(row: ContactRow): StakeholderContact {
  return {
    id: row.id,
    type: row.type as StakeholderContactType,
    value: row.value,
    sortOrder: row.sort_order,
  };
}

async function loadContacts(
  stakeholderId?: string,
): Promise<Map<string, StakeholderContact[]>> {
  const db = await getDatabase();
  const rows = await db.select<ContactRow[]>(
    stakeholderId
      ? `SELECT id, stakeholder_id, type, value, sort_order
         FROM stakeholder_contacts
         WHERE stakeholder_id = ?
         ORDER BY sort_order ASC, created_at ASC`
      : `SELECT id, stakeholder_id, type, value, sort_order
         FROM stakeholder_contacts
         ORDER BY sort_order ASC, created_at ASC`,
    stakeholderId ? [stakeholderId] : [],
  );

  const contacts = new Map<string, StakeholderContact[]>();
  for (const row of rows) {
    const list = contacts.get(row.stakeholder_id) ?? [];
    list.push(mapContact(row));
    contacts.set(row.stakeholder_id, list);
  }
  return contacts;
}

function mapStakeholder(
  row: StakeholderRow,
  contacts: Map<string, StakeholderContact[]>,
): Stakeholder {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    contacts: contacts.get(row.id) ?? [],
    notes: row.notes,
    projectCount: row.project_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listStakeholders(): Promise<Stakeholder[]> {
  const db = await getDatabase();
  const rows = await db.select<StakeholderRow[]>(
    `${SELECT_STAKEHOLDERS} ORDER BY s.name COLLATE NOCASE ASC`,
  );
  const contacts = await loadContacts();
  return rows.map((row) => mapStakeholder(row, contacts));
}

export async function getStakeholder(id: string): Promise<Stakeholder | null> {
  const db = await getDatabase();
  const rows = await db.select<StakeholderRow[]>(
    `${SELECT_STAKEHOLDERS} WHERE s.id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const contacts = await loadContacts(id);
  return mapStakeholder(rows[0], contacts);
}

async function replaceContacts(
  stakeholderId: string,
  contacts: StakeholderInput["contacts"],
) {
  const db = await getDatabase();
  await db.execute(
    "DELETE FROM stakeholder_contacts WHERE stakeholder_id = ?",
    [stakeholderId],
  );

  const validContacts = contacts
    .map((contact) => ({ type: contact.type, value: contact.value.trim() }))
    .filter((contact) => contact.value.length > 0);

  if (validContacts.length === 0) return;

  const now = nowIso();
  const placeholders = validContacts.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
  const values = validContacts.flatMap((contact, index) => [
    createId(),
    stakeholderId,
    contact.type,
    contact.value,
    index,
    now,
  ]);

  await db.execute(
    `INSERT INTO stakeholder_contacts
       (id, stakeholder_id, type, value, sort_order, created_at)
     VALUES ${placeholders}`,
    values,
  );
}

export async function createStakeholder(
  input: StakeholderInput,
): Promise<Stakeholder> {
  const db = await getDatabase();
  const id = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO stakeholders (id, name, company, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.company, input.notes, now, now],
  );

  await replaceContacts(id, input.contacts);

  const stakeholder = await getStakeholder(id);
  if (!stakeholder) throw new Error("干系人创建失败");
  return stakeholder;
}

export async function updateStakeholder(
  id: string,
  input: StakeholderInput,
): Promise<Stakeholder> {
  const db = await getDatabase();
  const now = nowIso();

  const result = await db.execute(
    `UPDATE stakeholders
     SET name = ?, company = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [input.name, input.company, input.notes, now, id],
  );

  if (result.rowsAffected === 0) throw new Error("干系人不存在或已被删除");

  await replaceContacts(id, input.contacts);

  const stakeholder = await getStakeholder(id);
  if (!stakeholder) throw new Error("干系人不存在或已被删除");
  return stakeholder;
}

export async function deleteStakeholder(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "DELETE FROM stakeholder_contacts WHERE stakeholder_id = ?",
    [id],
  );
  const linkResult = await db.execute(
    "DELETE FROM project_stakeholders WHERE stakeholder_id = ?",
    [id],
  );
  const stakeholderResult = await db.execute(
    "DELETE FROM stakeholders WHERE id = ?",
    [id],
  );

  if (stakeholderResult.rowsAffected === 0) {
    throw new Error(
      `删除失败：未找到干系人 ${id}（已移除 ${linkResult.rowsAffected} 条项目关联）`,
    );
  }
}
