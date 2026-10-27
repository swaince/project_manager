export type ProjectStatus =
  | "negotiating"
  | "pending_start"
  | "active"
  | "paused"
  | "delivered"
  | "archived";

export type StakeholderContactType = "phone" | "wechat" | "email" | "other";

export const STAKEHOLDER_CONTACT_TYPE_OPTIONS: {
  value: StakeholderContactType;
  label: string;
}[] = [
  { value: "phone", label: "电话" },
  { value: "wechat", label: "微信" },
  { value: "email", label: "邮箱" },
  { value: "other", label: "其他" },
];

export function getStakeholderContactTypeLabel(
  type: StakeholderContactType | null | undefined,
): string {
  if (!type) return "其他";
  return (
    STAKEHOLDER_CONTACT_TYPE_OPTIONS.find((option) => option.value === type)
      ?.label ?? type
  );
}

export interface StakeholderContact {
  id: string;
  type: StakeholderContactType;
  value: string;
  sortOrder: number;
}

export interface StakeholderContactInput {
  type: StakeholderContactType;
  value: string;
}

export interface Stakeholder {
  id: string;
  name: string;
  company: string | null;
  contacts: StakeholderContact[];
  notes: string;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StakeholderInput {
  name: string;
  company: string | null;
  contacts: StakeholderContactInput[];
  notes: string;
}

export interface ProjectStakeholder {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
}

export interface ProjectStakeholderInput {
  id: string;
  role: string | null;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  stakeholders: ProjectStakeholder[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  stakeholders: ProjectStakeholderInput[];
}

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "negotiating", label: "洽谈中" },
  { value: "pending_start", label: "待启动" },
  { value: "active", label: "进行中" },
  { value: "paused", label: "暂停" },
  { value: "delivered", label: "已交付" },
  { value: "archived", label: "已归档" },
];

export function getProjectStatusLabel(status: ProjectStatus): string {
  return (
    PROJECT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

export type RequirementStatus =
  | "draft"
  | "clarifying"
  | "confirmed"
  | "designing"
  | "developing"
  | "done"
  | "on_hold"
  | "cancelled";

export type RequirementType =
  | "feature"
  | "non_functional"
  | "bug"
  | "improvement"
  | "other";

export type RequirementSource =
  | "client"
  | "self"
  | "operation"
  | "tech"
  | "other";

export type RequirementPriority = 0 | 1 | 2;

export type RequirementOrigin = "baseline" | "communication" | "direct";

export const REQUIREMENT_ORIGIN_OPTIONS: {
  value: RequirementOrigin;
  label: string;
}[] = [
  { value: "baseline", label: "原始需求" },
  { value: "communication", label: "沟通记录" },
  { value: "direct", label: "直接创建" },
];

export function getRequirementOriginLabel(origin: RequirementOrigin): string {
  return (
    REQUIREMENT_ORIGIN_OPTIONS.find((option) => option.value === origin)?.label ??
    origin
  );
}

export const REQUIREMENT_STATUS_OPTIONS: {
  value: RequirementStatus;
  label: string;
}[] = [
  { value: "draft", label: "草稿" },
  { value: "clarifying", label: "澄清中" },
  { value: "confirmed", label: "已确认" },
  { value: "designing", label: "设计中" },
  { value: "developing", label: "开发中" },
  { value: "done", label: "已完成" },
  { value: "on_hold", label: "暂缓" },
  { value: "cancelled", label: "已取消" },
];

export const REQUIREMENT_TYPE_OPTIONS: {
  value: RequirementType;
  label: string;
}[] = [
  { value: "feature", label: "功能" },
  { value: "non_functional", label: "非功能" },
  { value: "bug", label: "缺陷" },
  { value: "improvement", label: "优化" },
  { value: "other", label: "其他" },
];

export const REQUIREMENT_SOURCE_OPTIONS: {
  value: RequirementSource;
  label: string;
}[] = [
  { value: "client", label: "客户" },
  { value: "self", label: "自己" },
  { value: "operation", label: "运营" },
  { value: "tech", label: "技术" },
  { value: "other", label: "其他" },
];

export const REQUIREMENT_PRIORITY_OPTIONS: {
  value: RequirementPriority;
  label: string;
}[] = [
  { value: 2, label: "高" },
  { value: 1, label: "中" },
  { value: 0, label: "低" },
];

export function getRequirementStatusLabel(status: RequirementStatus): string {
  return (
    REQUIREMENT_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  );
}

export function getRequirementTypeLabel(type: RequirementType): string {
  return (
    REQUIREMENT_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    type
  );
}

export function getRequirementSourceLabel(source: RequirementSource): string {
  return (
    REQUIREMENT_SOURCE_OPTIONS.find((option) => option.value === source)?.label ??
    source
  );
}

export function getRequirementPriorityLabel(
  priority: RequirementPriority,
): string {
  return (
    REQUIREMENT_PRIORITY_OPTIONS.find((option) => option.value === priority)
      ?.label ?? String(priority)
  );
}

export interface RequirementSnapshot {
  title: string;
  description: string;
  acceptanceCriteria: string;
  designNotes: string;
  type: RequirementType;
  source: RequirementSource;
  priority: RequirementPriority;
  status: RequirementStatus;
  estimateDays: number | null;
}

export interface Requirement {
  id: string;
  projectId: string;
  parentId: string | null;
  depth: number;
  code: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  designNotes: string;
  type: RequirementType;
  source: RequirementSource;
  origin: RequirementOrigin;
  originCommunicationId: string | null;
  priority: RequirementPriority;
  status: RequirementStatus;
  estimateDays: number | null;
  currentRevisionNo: number;
  confirmedAt: string | null;
  devStartedAt: string | null;
  devCompletedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementInput {
  parentId: string | null;
  title: string;
  description: string;
  acceptanceCriteria: string;
  designNotes: string;
  type: RequirementType;
  source: RequirementSource;
  origin: RequirementOrigin;
  originCommunicationId: string | null;
  sourceRequirementIds: string[];
  priority: RequirementPriority;
  status: RequirementStatus;
  estimateDays: number | null;
  cancelReason: string | null;
}

export interface SourceRequirementLink {
  id: string;
  code: string;
  title: string;
  moduleName: string;
  status: RequirementStatus;
}

export interface SourceRequirement {
  id: string;
  projectId: string;
  documentId: string;
  documentTitle: string;
  documentVersion: string;
  documentIsManual: boolean;
  docNo: number;
  moduleName: string;
  code: string;
  title: string;
  description: string;
  sourceRow: number;
  sortOrder: number;
  linkedRequirements: SourceRequirementLink[];
}

export interface ManualSourceRequirementInput {
  moduleName: string;
  title: string;
  description: string;
}

export interface SourceRequirementInput {
  moduleName: string;
  title: string;
  description: string;
  sourceRow: number;
}

export interface SourceDocument {
  id: string;
  projectId: string;
  docNo: number;
  title: string;
  version: string;
  fileName: string;
  filePath: string;
  sheetName: string;
  note: string;
  importedAt: string;
  isManual: boolean;
  itemCount: number;
}

export interface SourceDocumentInput {
  title: string;
  version: string;
  fileName: string;
  filePath: string;
  sheetName: string;
  note: string;
  items: SourceRequirementInput[];
}

export interface RequirementRevision {
  id: string;
  requirementId: string;
  revisionNo: number;
  snapshot: RequirementSnapshot;
  changeSummary: string;
  createdAt: string;
}

export type CommunicationChannel =
  | "wechat"
  | "meeting"
  | "phone"
  | "email"
  | "other";

export const COMMUNICATION_CHANNEL_OPTIONS: {
  value: CommunicationChannel;
  label: string;
}[] = [
  { value: "wechat", label: "微信" },
  { value: "meeting", label: "会议" },
  { value: "phone", label: "电话" },
  { value: "email", label: "邮件" },
  { value: "other", label: "其他" },
];

export function getCommunicationChannelLabel(
  channel: CommunicationChannel,
): string {
  return (
    COMMUNICATION_CHANNEL_OPTIONS.find((option) => option.value === channel)
      ?.label ?? channel
  );
}

export type CommunicationStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "archived";

export const COMMUNICATION_STATUS_OPTIONS: {
  value: CommunicationStatus;
  label: string;
}[] = [
  { value: "draft", label: "草稿" },
  { value: "in_progress", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "archived", label: "已归档" },
];

export function getCommunicationStatusLabel(
  status: CommunicationStatus,
): string {
  return (
    COMMUNICATION_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  );
}

export interface CommunicationRequirement {
  id: string;
  code: string;
  title: string;
}

export interface CommunicationSession {
  id: string;
  communicationId: string;
  occurredAt: string;
  channel: CommunicationChannel;
  participants: string;
  summary: string;
  decisions: string;
  followUps: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationSessionInput {
  occurredAt: string;
  channel: CommunicationChannel;
  participants: string;
  summary: string;
  decisions: string;
  followUps: string;
}

export interface CommunicationAttachment {
  id: string;
  communicationId: string;
  sessionId: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  source: string;
  createdAt: string;
}

export interface CommunicationAttachmentInput {
  sessionId: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  source: string;
}

export interface Communication {
  id: string;
  projectId: string;
  title: string;
  status: CommunicationStatus;
  completedAt: string | null;
  archivedAt: string | null;
  requirements: CommunicationRequirement[];
  sourceRequirements: SourceRequirementLink[];
  sessions: CommunicationSession[];
  attachments: CommunicationAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationDraftInput {
  title?: string;
  requirementIds?: string[];
  sourceRequirementIds?: string[];
}

export interface CommunicationMetaInput {
  title: string;
  requirementIds: string[];
  sourceRequirementIds: string[];
}

