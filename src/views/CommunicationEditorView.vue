<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { onBeforeRouteLeave, RouterLink, useRouter } from "vue-router";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  MessageSquarePlus,
  Mic,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Upload,
} from "@lucide/vue";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";
import AttachmentGrid from "@/components/communications/AttachmentGrid.vue";
import RequirementFormDialog from "@/components/requirements/RequirementFormDialog.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import FormField from "@/components/ui/FormField.vue";
import RequirementSelect from "@/components/ui/RequirementSelect.vue";
import SourceRequirementSelect from "@/components/ui/SourceRequirementSelect.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addCommunicationAttachment,
  addCommunicationSession,
  archiveCommunication,
  completeCommunication,
  getCommunication,
  removeCommunicationAttachment,
  reopenCommunication,
  restoreCommunication,
  updateCommunicationMeta,
  updateCommunicationSession,
} from "@/db/communications";
import { getProject } from "@/db/projects";
import { listRequirements } from "@/db/requirements";
import { listSourceRequirements } from "@/db/sourceRequirements";
import {
  copyAttachmentFromPath,
  pastedImageFileName,
  pickAttachmentPaths,
  readAttachmentDataUrl,
  readFileAsBase64,
  saveAttachmentBytes,
} from "@/lib/attachments";
import { formatDateOnly, formatDateTime, todayDateOnly } from "@/lib/dates";
import { createId } from "@/lib/ids";
import {
  communicationChannelClass,
  communicationStatusClass,
} from "@/lib/ui";
import {
  COMMUNICATION_CHANNEL_OPTIONS,
  getCommunicationChannelLabel,
  getCommunicationStatusLabel,
  type Communication,
  type CommunicationAttachment,
  type CommunicationChannel,
  type CommunicationSession,
  type CommunicationSessionInput,
  type CommunicationSessionTodo,
  type CommunicationStatus,
  type Project,
  type Requirement,
  type SourceRequirement,
} from "@/types/models";

const props = defineProps<{
  projectId: string;
  communicationId: string;
}>();

const router = useRouter();

const project = ref<Project | null>(null);
const communication = ref<Communication | null>(null);
const loading = ref(true);
const loadError = ref("");

const title = ref("");
const status = ref<CommunicationStatus>("draft");
const requirementIds = ref<string[]>([]);
const sourceRequirementIds = ref<string[]>([]);
const requirementOptions = ref<Requirement[]>([]);
const sourceRequirementOptions = ref<SourceRequirement[]>([]);

const sessions = ref<CommunicationSession[]>([]);
const attachments = ref<CommunicationAttachment[]>([]);
const activeSessionId = ref("");
const sessionForm = reactive<CommunicationSessionInput>({
  occurredAt: todayDateOnly(),
  channel: "meeting",
  participants: "",
  summary: "",
  decisions: "",
  followUps: "",
  todos: [],
});

const saving = ref(false);
const savedAt = ref<Date | null>(null);
const saveError = ref("");
const dirty = ref(false);
const hydrating = ref(true);

const uploading = ref(0);
const attachmentError = ref("");
const dragActive = ref(false);

const recording = ref(false);
const recordSeconds = ref(0);
let recorder: MediaRecorder | null = null;
let recorderSessionId: string | null = null;
let recorderMimeType = "";
let recordChunks: Blob[] = [];
let recordTimer: ReturnType<typeof setInterval> | null = null;

const previewAttachment = ref<CommunicationAttachment | null>(null);
const previewUrl = ref("");
const previewLoading = ref(false);
const pendingRemoveAttachment = ref<CommunicationAttachment | null>(null);
const removeBusy = ref(false);
const archiveOpen = ref(false);
const archiveBusy = ref(false);
const requirementOpen = ref(false);
const requirementPresetTitle = ref("");
const requirementPresetSourceIds = ref<string[]>([]);
const todoDraft = ref("");
const todoPendingRequirement = ref<CommunicationSessionTodo | null>(null);
const completeConfirmOpen = ref(false);
const completeBusy = ref(false);

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savingPromise: Promise<void> | null = null;
let unlistenDrag: UnlistenFn | null = null;

const isArchived = computed(() => status.value === "archived");
const isCompleted = computed(() => status.value === "completed");
const activeSession = computed(
  () => sessions.value.find((session) => session.id === activeSessionId.value) ?? null,
);
const themeAttachments = computed(() =>
  attachments.value.filter((attachment) => attachment.sessionId === null),
);
const activeSessionAttachments = computed(() =>
  attachments.value.filter(
    (attachment) => attachment.sessionId === activeSessionId.value,
  ),
);
const linkedSourceRequirements = computed(() =>
  sourceRequirementOptions.value.filter((source) =>
    sourceRequirementIds.value.includes(source.id),
  ),
);
const unrefinedSources = computed(() =>
  linkedSourceRequirements.value.filter(
    (source) => source.linkedRequirements.length === 0,
  ),
);
const completeWarning = computed(() => {
  const codes = unrefinedSources.value.map((source) => source.code).join("、");
  return `还有 ${unrefinedSources.value.length} 条关联原始需求尚未细化为开发需求：${codes}。可以先在原始需求页生成开发需求，或确认现在完成。`;
});
const saveLabel = computed(() => {
  if (saving.value) return "保存中…";
  if (saveError.value) return "保存失败";
  if (dirty.value) return "有未保存的修改";
  if (savedAt.value) {
    return `已自动保存 ${savedAt.value.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  }
  return "尚未保存";
});
const recordElapsed = computed(
  () =>
    `${Math.floor(recordSeconds.value / 60)}:${String(recordSeconds.value % 60).padStart(2, "0")}`,
);

onMounted(async () => {
  await load();
  window.addEventListener("paste", handlePaste);
  window.addEventListener("beforeunload", handleBeforeUnload);
  try {
    unlistenDrag = await getCurrentWebview().onDragDropEvent(handleDragDrop);
  } catch {
    unlistenDrag = null;
  }
});

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  if (recordTimer) clearInterval(recordTimer);
  if (recorder) {
    recorder.onstop = null;
    recorder.stream.getTracks().forEach((track) => track.stop());
    recorder.stop();
    recorder = null;
  }
  window.removeEventListener("paste", handlePaste);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  unlistenDrag?.();
});

onBeforeRouteLeave(async () => {
  try {
    await flushSave();
    return true;
  } catch {
    return false;
  }
});

watch(
  [title, requirementIds, sourceRequirementIds],
  () => {
    scheduleSave();
  },
  { deep: true },
);

watch(
  () => ({ ...sessionForm }),
  () => {
    scheduleSave();
  },
  { deep: true },
);

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [projectData, requirementItems, sourceItems, communicationData] =
      await Promise.all([
        getProject(props.projectId),
        listRequirements(props.projectId),
        listSourceRequirements(props.projectId),
        getCommunication(props.communicationId),
      ]);
    if (!projectData) throw new Error("项目不存在或已被删除");
    if (!communicationData) throw new Error("沟通记录不存在或已被删除");
    project.value = projectData;
    requirementOptions.value = requirementItems;
    sourceRequirementOptions.value = sourceItems;
    hydrate(communicationData);
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

function hydrate(value: Communication) {
  hydrating.value = true;
  communication.value = value;
  title.value = value.title;
  status.value = value.status;
  requirementIds.value = value.requirements.map((item) => item.id);
  sourceRequirementIds.value = value.sourceRequirements.map((item) => item.id);
  sessions.value = [...value.sessions].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  attachments.value = [...value.attachments];
  activeSessionId.value =
    sessions.value.find((session) => session.id === activeSessionId.value)?.id ??
    sessions.value[0]?.id ??
    "";
  applySessionForm(activeSession.value);
  savedAt.value = value.updatedAt ? new Date(value.updatedAt) : null;
  dirty.value = false;
  saveError.value = "";
  nextTick(() => {
    hydrating.value = false;
  });
}

function applySessionForm(session: CommunicationSession | null) {
  hydrating.value = true;
  if (session) {
    sessionForm.occurredAt = session.occurredAt;
    sessionForm.channel = session.channel;
    sessionForm.participants = session.participants;
    sessionForm.summary = session.summary;
    sessionForm.decisions = session.decisions;
    sessionForm.followUps = session.followUps;
    sessionForm.todos = session.todos.map((todo) => ({ ...todo }));
  } else {
    sessionForm.occurredAt = todayDateOnly();
    sessionForm.channel = "meeting";
    sessionForm.participants = "";
    sessionForm.summary = "";
    sessionForm.decisions = "";
    sessionForm.followUps = "";
    sessionForm.todos = [];
  }
  nextTick(() => {
    hydrating.value = false;
  });
}

function scheduleSave() {
  if (hydrating.value || loading.value || isArchived.value) return;
  dirty.value = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveAll().catch(() => {
      // 错误已显示在页面上，等待用户重试。
    });
  }, 700);
}

async function saveAll(): Promise<void> {
  if (!communication.value || isArchived.value) return;
  if (savingPromise) {
    await savingPromise;
    if (!dirty.value) return;
  }
  if (!dirty.value) return;

  dirty.value = false;
  saving.value = true;
  saveError.value = "";
  const communicationId = communication.value.id;
  const sessionSnapshot = activeSession.value;
  const formSnapshot: CommunicationSessionInput = { ...sessionForm };

  savingPromise = (async () => {
    const meta = await updateCommunicationMeta(communicationId, {
      title: title.value,
      requirementIds: requirementIds.value,
      sourceRequirementIds: sourceRequirementIds.value,
    });
    if (communication.value?.id === communicationId) {
      communication.value.title = meta.title;
      communication.value.status = meta.status;
      communication.value.requirements = meta.requirements;
      communication.value.sourceRequirements = meta.sourceRequirements;
      communication.value.updatedAt = meta.updatedAt;
      status.value = meta.status;
    }

    if (sessionSnapshot) {
      const updated = await updateCommunicationSession(
        sessionSnapshot.id,
        formSnapshot,
      );
      const index = sessions.value.findIndex(
        (session) => session.id === updated.id,
      );
      if (index >= 0) sessions.value[index] = updated;
      if (communication.value?.id === communicationId) {
        communication.value.updatedAt = updated.updatedAt;
      }
    }
    savedAt.value = new Date();
  })()
    .catch((cause) => {
      dirty.value = true;
      saveError.value = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    })
    .finally(() => {
      saving.value = false;
      savingPromise = null;
    });

  await savingPromise;
  if (dirty.value && !saveError.value) scheduleSave();
}

async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (savingPromise) await savingPromise;
  if (dirty.value) await saveAll();
  if (savingPromise) await savingPromise;
  if (saveError.value) throw new Error(saveError.value);
}

async function retrySave() {
  saveError.value = "";
  await saveAll().catch(() => {
    // 错误会重新显示。
  });
}

async function selectSession(sessionId: string) {
  if (sessionId === activeSessionId.value) return;
  try {
    await flushSave();
  } catch {
    return;
  }
  activeSessionId.value = sessionId;
  applySessionForm(activeSession.value);
}

async function addSession() {
  if (!communication.value) return;
  try {
    await flushSave();
    const created = await addCommunicationSession(communication.value.id);
    sessions.value.push(created);
    activeSessionId.value = created.id;
    applySessionForm(created);
    if (status.value === "draft") status.value = "in_progress";
    savedAt.value = new Date();
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : String(cause);
  }
}

async function completeRecord() {
  if (!communication.value) return;
  if (unrefinedSources.value.length > 0) {
    completeConfirmOpen.value = true;
    return;
  }
  await confirmCompleteRecord();
}

async function confirmCompleteRecord() {
  if (!communication.value) return;
  completeBusy.value = true;
  try {
    await flushSave();
    const updated = await completeCommunication(communication.value.id);
    status.value = updated.status;
    communication.value.status = updated.status;
    communication.value.completedAt = updated.completedAt;
    savedAt.value = new Date();
    completeConfirmOpen.value = false;
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    completeBusy.value = false;
  }
}

async function reopenRecord() {
  if (!communication.value) return;
  try {
    await flushSave();
    const updated = await reopenCommunication(communication.value.id);
    status.value = updated.status;
    communication.value.status = updated.status;
    communication.value.completedAt = updated.completedAt;
    savedAt.value = new Date();
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : String(cause);
  }
}

async function confirmArchive() {
  if (!communication.value) return;
  archiveBusy.value = true;
  try {
    await flushSave();
    await archiveCommunication(communication.value.id);
    archiveOpen.value = false;
    await router.push(`/projects/${props.projectId}?tab=communications`);
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    archiveBusy.value = false;
  }
}

async function restoreRecord() {
  if (!communication.value) return;
  try {
    const updated = await restoreCommunication(communication.value.id);
    status.value = updated.status;
    communication.value.status = updated.status;
    communication.value.completedAt = updated.completedAt;
    communication.value.archivedAt = updated.archivedAt;
    savedAt.value = new Date();
  } catch (cause) {
    saveError.value = cause instanceof Error ? cause.message : String(cause);
  }
}

function openRequirementDialog(todo?: CommunicationSessionTodo) {
  todoPendingRequirement.value = todo ?? null;
  requirementPresetTitle.value = todo?.content ?? "";
  requirementPresetSourceIds.value = [...sourceRequirementIds.value];
  requirementOpen.value = true;
}

function addTodo() {
  const content = todoDraft.value.trim();
  if (!content) return;
  sessionForm.todos.push({
    id: createId(),
    content,
    done: false,
    requirementId: null,
  });
  todoDraft.value = "";
}

function removeTodo(index: number) {
  sessionForm.todos.splice(index, 1);
}

function requirementCode(requirementId: string | null): string {
  if (!requirementId) return "";
  return (
    requirementOptions.value.find((item) => item.id === requirementId)?.code ??
    ""
  );
}

async function afterRequirementCreated(created?: Requirement) {
  requirementOpen.value = false;
  const todo = todoPendingRequirement.value;
  todoPendingRequirement.value = null;
  if (todo && created) {
    todo.requirementId = created.id;
  }
  if (!communication.value) return;
  try {
    const [refreshed, requirementItems, sourceItems] = await Promise.all([
      getCommunication(communication.value.id),
      listRequirements(props.projectId),
      listSourceRequirements(props.projectId),
    ]);
    requirementOptions.value = requirementItems;
    sourceRequirementOptions.value = sourceItems;
    if (!refreshed) return;
    communication.value.requirements = refreshed.requirements;
    requirementIds.value = refreshed.requirements.map((item) => item.id);
  } catch {
    // 刷新失败不阻断编辑，稍后重新进入即可看到关联。
  }
}

async function uploadSelected(sessionId: string | null) {
  if (!communication.value || isArchived.value) return;
  try {
    const paths = await pickAttachmentPaths();
    if (paths.length === 0) return;
    await uploadPaths(paths, sessionId, "file");
  } catch (cause) {
    attachmentError.value =
      cause instanceof Error ? cause.message : String(cause);
  }
}

async function uploadPaths(
  paths: string[],
  sessionId: string | null,
  source: string,
) {
  if (!communication.value || isArchived.value || paths.length === 0) return;
  attachmentError.value = "";
  uploading.value += paths.length;
  try {
    for (const path of paths) {
      const saved = await copyAttachmentFromPath(
        props.projectId,
        communication.value.id,
        path,
      );
      const attachment = await addCommunicationAttachment(
        communication.value.id,
        {
          sessionId,
          fileName: saved.fileName,
          filePath: saved.filePath,
          mimeType: saved.mimeType,
          fileSize: saved.fileSize,
          source,
        },
      );
      attachments.value.push(attachment);
      savedAt.value = new Date();
    }
  } catch (cause) {
    attachmentError.value =
      cause instanceof Error ? cause.message : String(cause);
  } finally {
    uploading.value -= paths.length;
  }
}

async function uploadPastedImage(file: File, sessionId: string | null) {
  if (!communication.value || isArchived.value) return;
  attachmentError.value = "";
  uploading.value += 1;
  try {
    const dataBase64 = await readFileAsBase64(file);
    const saved = await saveAttachmentBytes(
      props.projectId,
      communication.value.id,
      pastedImageFileName(file),
      dataBase64,
    );
    const attachment = await addCommunicationAttachment(
      communication.value.id,
      {
        sessionId,
        fileName: saved.fileName,
        filePath: saved.filePath,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        source: "paste",
      },
    );
    attachments.value.push(attachment);
    savedAt.value = new Date();
  } catch (cause) {
    attachmentError.value =
      cause instanceof Error ? cause.message : String(cause);
  } finally {
    uploading.value -= 1;
  }
}

async function startRecording(sessionId: string | null) {
  if (!communication.value || isArchived.value || recording.value) return;
  attachmentError.value = "";
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioStream = stream;
    recorderMimeType =
      ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      ) ?? "";
    recorder = new MediaRecorder(
      audioStream,
      recorderMimeType ? { mimeType: recorderMimeType } : undefined,
    );
    recordChunks = [];
    recorderSessionId = sessionId;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordChunks.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorderMimeType || "audio/webm";
      const blob = new Blob(recordChunks, { type });
      recordChunks = [];
      audioStream.getTracks().forEach((track) => track.stop());
      void saveRecording(blob, type);
    };
    recorder.start();
    recordSeconds.value = 0;
    recording.value = true;
    recordTimer = setInterval(() => (recordSeconds.value += 1), 1000);
  } catch (cause) {
    stream?.getTracks().forEach((track) => track.stop());
    attachmentError.value = `无法开始录音：${
      cause instanceof Error ? cause.message : String(cause)
    }`;
  }
}

function stopRecording() {
  if (!recorder) return;
  if (recordTimer) clearInterval(recordTimer);
  recordTimer = null;
  recording.value = false;
  // onstop 里保存，这里只负责收尾
  recorder.stop();
  recorder = null;
}

async function saveRecording(blob: Blob, mimeType: string) {
  if (!communication.value) return;
  const sessionId = recorderSessionId;
  recorderSessionId = null;
  attachmentError.value = "";
  uploading.value += 1;
  try {
    const extension = mimeType.includes("mp4") ? "m4a" : "webm";
    const fileName = `录音-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.${extension}`;
    const dataBase64 = await readFileAsBase64(
      new File([blob], fileName, { type: mimeType }),
    );
    const saved = await saveAttachmentBytes(
      props.projectId,
      communication.value.id,
      fileName,
      dataBase64,
    );
    const attachment = await addCommunicationAttachment(
      communication.value.id,
      {
        sessionId,
        fileName: saved.fileName,
        filePath: saved.filePath,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        source: "record",
      },
    );
    attachments.value.push(attachment);
    savedAt.value = new Date();
  } catch (cause) {
    attachmentError.value =
      cause instanceof Error ? cause.message : String(cause);
  } finally {
    uploading.value -= 1;
  }
}

function handlePaste(event: ClipboardEvent) {
  if (isArchived.value) return;
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return;
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (text.trim()) return;
  const file = imageItem.getAsFile();
  if (!file) return;
  event.preventDefault();
  void uploadPastedImage(file, activeSessionId.value || null);
}

function handleDragDrop(event: { payload: DragDropEvent }) {
  const payload = event.payload;
  if (payload.type === "enter" || payload.type === "over") {
    dragActive.value = true;
    return;
  }
  if (payload.type === "leave") {
    dragActive.value = false;
    return;
  }
  if (payload.type === "drop") {
    dragActive.value = false;
    if (isArchived.value) return;
    void uploadPaths(
      payload.paths,
      activeSessionId.value || null,
      "drag",
    );
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value || saveError.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}

function sessionAttachments(sessionId: string) {
  return attachments.value.filter(
    (attachment) => attachment.sessionId === sessionId,
  );
}

async function previewImage(attachment: CommunicationAttachment) {
  previewAttachment.value = attachment;
  previewUrl.value = "";
  previewLoading.value = true;
  try {
    previewUrl.value = await readAttachmentDataUrl(attachment.filePath);
  } catch (cause) {
    attachmentError.value =
      cause instanceof Error ? cause.message : String(cause);
    previewAttachment.value = null;
  } finally {
    previewLoading.value = false;
  }
}

function requestRemoveAttachment(attachment: CommunicationAttachment) {
  pendingRemoveAttachment.value = attachment;
}

async function confirmRemoveAttachment() {
  if (!pendingRemoveAttachment.value) return;
  removeBusy.value = true;
  try {
    await removeCommunicationAttachment(pendingRemoveAttachment.value.id);
    attachments.value = attachments.value.filter(
      (attachment) => attachment.id !== pendingRemoveAttachment.value?.id,
    );
    pendingRemoveAttachment.value = null;
  } catch (cause) {
    attachmentError.value =
      cause instanceof Error ? cause.message : String(cause);
  } finally {
    removeBusy.value = false;
  }
}
</script>

<template>
  <section class="space-y-5 p-6 lg:p-8">
    <Button variant="ghost" size="sm" as-child class="-ml-2 w-fit">
      <RouterLink :to="`/projects/${projectId}?tab=communications`">
        <ArrowLeft class="size-4" />
        返回沟通记录
      </RouterLink>
    </Button>

    <div
      v-if="loading"
      class="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"
    >
      加载中…
    </div>

    <div
      v-else-if="loadError || !communication"
      class="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive"
    >
      {{ loadError || "沟通记录不存在" }}
    </div>

    <template v-else>
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <Input
              v-model="title"
              :disabled="isArchived"
              placeholder="沟通主题"
              class="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
            />
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="communicationStatusClass(status)"
            >
              {{ getCommunicationStatusLabel(status) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground">
            {{ project?.name }} · 最近更新
            {{ formatDateTime(communication.updatedAt) }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span
            class="text-xs"
            :class="saveError ? 'text-destructive' : 'text-muted-foreground'"
          >
            {{ saveLabel }}
          </span>
          <Button
            v-if="saveError"
            variant="outline"
            size="sm"
            @click="retrySave"
          >
            重试保存
          </Button>
          <Button
            v-if="isArchived"
            variant="outline"
            size="sm"
            @click="restoreRecord"
          >
            <RotateCcw class="size-4" />
            恢复
          </Button>
          <template v-else>
            <Button
              v-if="isCompleted"
              variant="outline"
              size="sm"
              @click="reopenRecord"
            >
              <RotateCcw class="size-4" />
              重新打开
            </Button>
            <Button v-else size="sm" @click="completeRecord">
              <CheckCircle2 class="size-4" />
              完成记录
            </Button>
            <Button variant="ghost" size="sm" @click="archiveOpen = true">
              <Archive class="size-4" />
              归档
            </Button>
          </template>
          <Button
            v-if="!isArchived"
            variant="ghost"
            size="sm"
            @click="openRequirementDialog()"
          >
            <MessageSquarePlus class="size-4" />
            新建开发需求
          </Button>
        </div>
      </header>

      <div
        v-if="isArchived"
        class="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      >
        这条沟通记录已归档，内容为只读；需要继续补充时点击上方“恢复”。
      </div>

      <div
        v-if="saveError"
        class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        自动保存失败：{{ saveError }}。内容仍保留在当前页面，请点击“重试保存”或检查数据库。
      </div>

      <div
        v-if="attachmentError"
        class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {{ attachmentError }}
      </div>

      <div class="space-y-4">
        <section
          class="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-2"
          :class="isArchived ? 'pointer-events-none opacity-60' : ''"
        >
          <FormField label="涉及原始需求">
            <SourceRequirementSelect
              v-model="sourceRequirementIds"
              :requirements="sourceRequirementOptions"
            />
          </FormField>
          <FormField label="关联开发需求">
            <RequirementSelect
              v-model="requirementIds"
              :requirements="requirementOptions"
            />
          </FormField>
        </section>

        <section
          v-if="linkedSourceRequirements.length > 0"
          class="rounded-xl border border-border bg-card p-4"
        >
          <div class="mb-3">
            <h2 class="text-sm font-semibold">原始需求参考</h2>
            <p class="mt-0.5 text-xs text-muted-foreground">
              沟通时随时对照客户最初提供的范围描述。
            </p>
          </div>
          <div class="space-y-4">
            <div
              v-for="source in linkedSourceRequirements"
              :key="source.id"
              class="space-y-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span class="font-mono">{{ source.code }}</span>
                <span v-if="source.moduleName">{{ source.moduleName }}</span>
                <span v-if="source.sourceRow > 0">第 {{ source.sourceRow }} 行</span>
                <span v-else>手工录入</span>
              </div>
              <p class="text-sm font-medium">{{ source.title }}</p>
              <p
                class="max-h-64 overflow-y-auto whitespace-pre-wrap pr-1 text-sm text-muted-foreground"
              >
                {{ source.description || "（原表没有描述）" }}
              </p>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-border bg-card p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-semibold">主题附件</h2>
              <p class="mt-0.5 text-xs text-muted-foreground">
                不归属于某一场次的资料，例如整体会议纪要、合同截图。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              :disabled="uploading > 0 || isArchived"
              @click="uploadSelected(null)"
            >
              <Upload class="size-4" />
              上传附件
            </Button>
          </div>
          <AttachmentGrid
            :attachments="themeAttachments"
            :readonly="isArchived"
            class="mt-3"
            @remove="requestRemoveAttachment"
            @preview="previewImage"
            @error="attachmentError = $event"
          />
          <p
            v-if="themeAttachments.length === 0"
            class="mt-3 rounded-md border border-dashed border-border px-4 py-3 text-xs text-muted-foreground"
          >
            使用上方按钮上传主题附件；场次内支持 Ctrl+V 粘贴截图和拖拽文件。
          </p>
        </section>

        <div class="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside class="space-y-2">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold">沟通场次</h2>
              <span class="text-xs text-muted-foreground">
                {{ sessions.length }} 场
              </span>
            </div>

            <button
              v-for="(session, index) in sessions"
              :key="session.id"
              class="w-full rounded-lg border p-3 text-left transition-colors"
              :class="
                session.id === activeSessionId
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card hover:bg-muted/40'
              "
              @click="selectSession(session.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium">第 {{ index + 1 }} 场</span>
                <span
                  class="rounded-full px-1.5 py-0.5 text-[0.7rem]"
                  :class="communicationChannelClass(session.channel)"
                >
                  {{ getCommunicationChannelLabel(session.channel) }}
                </span>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ formatDateOnly(session.occurredAt) }}
                <template v-if="session.participants"> · {{ session.participants }}</template>
              </p>
              <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {{ session.summary || "未填写摘要" }}
              </p>
              <p
                v-if="sessionAttachments(session.id).length > 0"
                class="mt-1 text-[0.7rem] text-muted-foreground"
              >
                {{ sessionAttachments(session.id).length }} 个附件
              </p>
            </button>

            <Button
              variant="outline"
              class="w-full"
              :disabled="isArchived"
              @click="addSession"
            >
              <Plus class="size-4" />
              新增场次
            </Button>
            <p class="text-xs text-muted-foreground">
              今天没聊完时，新增一场继续记录，上一场内容会保留。
            </p>
          </aside>

          <section v-if="activeSession" class="space-y-4 rounded-xl border border-border bg-card p-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <FormField label="沟通日期" required>
                <DatePicker v-model="sessionForm.occurredAt" :disabled="isArchived" />
              </FormField>
              <FormField label="沟通方式">
                <Select
                  :model-value="sessionForm.channel"
                  :disabled="isArchived"
                  @update:model-value="
                    (value) => (sessionForm.channel = value as CommunicationChannel)
                  "
                >
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in COMMUNICATION_CHANNEL_OPTIONS"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="参与人">
              <Input
                v-model="sessionForm.participants"
                :disabled="isArchived"
                placeholder="例如：张三、李四"
              />
            </FormField>

            <FormField label="沟通摘要">
              <Textarea
                v-model="sessionForm.summary"
                :disabled="isArchived"
                class="min-h-32"
                placeholder="这一场主要聊了什么；可以边聊边记，自动保存"
              />
            </FormField>

            <div class="grid gap-4 sm:grid-cols-2">
              <FormField label="达成的结论">
                <Textarea
                  v-model="sessionForm.decisions"
                  :disabled="isArchived"
                  class="min-h-24"
                  placeholder="确认了哪些范围、方案或时间点"
                />
              </FormField>
              <FormField label="后续待办">
                <Textarea
                  v-model="sessionForm.followUps"
                  :disabled="isArchived"
                  class="min-h-24"
                  placeholder="下一步谁需要做什么"
                />
              </FormField>
            </div>

            <div class="rounded-lg border border-border p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">待办事项</h3>
                <span class="text-xs text-muted-foreground">
                  勾选表示已完成；需要落成需求时直接生成。
                </span>
              </div>
              <ul
                v-if="sessionForm.todos.length > 0"
                class="mt-2 space-y-1.5"
              >
                <li
                  v-for="(todo, index) in sessionForm.todos"
                  :key="todo.id"
                  class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <Checkbox v-model="todo.done" :disabled="isArchived" />
                  <span
                    class="min-w-0 flex-1 text-sm"
                    :class="todo.done ? 'text-muted-foreground line-through' : ''"
                  >
                    {{ todo.content }}
                  </span>
                  <span
                    v-if="todo.requirementId"
                    class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  >
                    已生成 {{ requirementCode(todo.requirementId) || "开发需求" }}
                  </span>
                  <Button
                    v-else
                    variant="ghost"
                    size="xs"
                    :disabled="isArchived"
                    @click="openRequirementDialog(todo)"
                  >
                    生成需求
                  </Button>
                  <Button
                    v-if="!isArchived"
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-destructive"
                    aria-label="删除待办"
                    @click="removeTodo(index)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </li>
              </ul>
              <div v-if="!isArchived" class="mt-2 flex gap-2">
                <Input
                  v-model="todoDraft"
                  placeholder="新增一条待办，例如：周五前给出报价"
                  @keyup.enter="addTodo"
                />
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!todoDraft.trim()"
                  @click="addTodo"
                >
                  添加
                </Button>
              </div>
            </div>

            <div class="border-t border-border pt-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="text-sm font-semibold">本场附件</h3>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    支持录音、多选、Ctrl+V 粘贴截图和拖拽文件。
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    :class="recording ? 'text-destructive' : ''"
                    :disabled="uploading > 0 || isArchived"
                    @click="
                      recording
                        ? stopRecording()
                        : startRecording(activeSessionId)
                    "
                  >
                    <Square v-if="recording" class="size-4" />
                    <Mic v-else class="size-4" />
                    {{ recording ? `停止录音 ${recordElapsed}` : "录音" }}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="uploading > 0 || isArchived"
                    @click="uploadSelected(activeSessionId)"
                  >
                    <Upload class="size-4" />
                    上传附件
                  </Button>
                </div>
              </div>
              <AttachmentGrid
                :attachments="activeSessionAttachments"
                :readonly="isArchived"
                class="mt-3"
                @remove="requestRemoveAttachment"
                @preview="previewImage"
              />
              <p
                v-if="activeSessionAttachments.length === 0"
                class="mt-3 rounded-md border border-dashed border-border px-4 py-3 text-xs text-muted-foreground"
              >
                微信截图、会议纪要、现场照片都可以直接拖进来，或按 Ctrl+V 粘贴截图。
              </p>
            </div>
          </section>

          <section
            v-else
            class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
          >
            还没有沟通场次，点击左侧“新增场次”开始记录。
          </section>
        </div>
      </div>

      <div
        v-if="uploading > 0"
        class="fixed bottom-4 right-4 z-40 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg"
      >
        正在上传 {{ uploading }} 个附件…
      </div>

      <div
        v-if="dragActive"
        class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm"
      >
        <div class="rounded-xl border-2 border-dashed border-primary bg-card px-10 py-8 text-center shadow-xl">
          <Upload class="mx-auto size-8 text-primary" />
          <p class="mt-3 text-sm font-semibold">松开以上传附件</p>
          <p class="mt-1 text-xs text-muted-foreground">
            将上传到当前沟通场次
          </p>
        </div>
      </div>

      <ConfirmDialog
        :open="Boolean(pendingRemoveAttachment)"
        title="移除附件"
        :message="
          pendingRemoveAttachment
            ? `确定从沟通记录中移除“${pendingRemoveAttachment.fileName || '未命名附件'}”吗？文件会保留在本地，但不再显示。`
            : ''
        "
        confirm-label="移除"
        :busy="removeBusy"
        @close="pendingRemoveAttachment = null"
        @confirm="confirmRemoveAttachment"
      />

      <ConfirmDialog
        :open="archiveOpen"
        title="归档沟通记录"
        message="归档后这条记录会从默认列表隐藏，内容不会删除，可以随时恢复。"
        confirm-label="归档"
        :busy="archiveBusy"
        @close="archiveOpen = false"
        @confirm="confirmArchive"
      />

      <ConfirmDialog
        :open="completeConfirmOpen"
        title="关联原始需求尚未细化"
        :message="completeWarning"
        confirm-label="仍然完成"
        :busy="completeBusy"
        @close="completeConfirmOpen = false"
        @confirm="confirmCompleteRecord"
      />

      <AppDialog
        :open="Boolean(previewAttachment)"
        :title="previewAttachment?.fileName ?? '附件预览'"
        wide
        @close="previewAttachment = null"
      >
        <div class="flex min-h-40 items-center justify-center">
          <p v-if="previewLoading" class="text-sm text-muted-foreground">
            加载图片…
          </p>
          <img
            v-else-if="previewUrl"
            :src="previewUrl"
            :alt="previewAttachment?.fileName"
            class="max-h-[70vh] max-w-full object-contain"
          />
          <p v-else class="text-sm text-muted-foreground">无法预览这张图片。</p>
        </div>
      </AppDialog>

      <RequirementFormDialog
        v-if="project"
        :open="requirementOpen"
        :project="project"
        preset-origin="communication"
        :preset-origin-communication-id="communicationId"
        :preset-title="requirementPresetTitle"
        :preset-source-requirement-ids="requirementPresetSourceIds"
        @close="requirementOpen = false"
        @saved="afterRequirementCreated"
      />
    </template>
  </section>
</template>
