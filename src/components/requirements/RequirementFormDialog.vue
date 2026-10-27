<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import CommunicationSelect from "@/components/ui/CommunicationSelect.vue";
import FormField from "@/components/ui/FormField.vue";
import SourceRequirementSelect from "@/components/ui/SourceRequirementSelect.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCommunications } from "@/db/communications";
import { listRequirementRevisions } from "@/db/requirements";
import {
  listRequirementSourceIds,
  listSourceRequirements,
} from "@/db/sourceRequirements";
import { formatDateTime } from "@/lib/dates";
import { requirementStatusClass } from "@/lib/ui";
import { useRequirementsStore } from "@/stores/requirements";
import {
  REQUIREMENT_ORIGIN_OPTIONS,
  REQUIREMENT_PRIORITY_OPTIONS,
  REQUIREMENT_SOURCE_OPTIONS,
  REQUIREMENT_STATUS_OPTIONS,
  REQUIREMENT_TYPE_OPTIONS,
  getRequirementPriorityLabel,
  getRequirementStatusLabel,
  type Communication,
  type Project,
  type Requirement,
  type RequirementInput,
  type RequirementOrigin,
  type RequirementPriority,
  type RequirementRevision,
  type RequirementSource,
  type RequirementStatus,
  type RequirementType,
  type SourceRequirement,
} from "@/types/models";

const props = defineProps<{
  open: boolean;
  project: Project;
  requirement?: Requirement | null;
  parent?: Requirement | null;
  presetOrigin?: RequirementOrigin;
  presetOriginCommunicationId?: string | null;
  presetSourceRequirementIds?: string[];
  presetTitle?: string;
  presetDescription?: string;
}>();

const emit = defineEmits<{ close: []; saved: [requirement: Requirement] }>();

interface RequirementFormState {
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
  estimateDays: string;
  cancelReason: string;
}

const store = useRequirementsStore();

const form = reactive<RequirementFormState>({
  title: "",
  description: "",
  acceptanceCriteria: "",
  designNotes: "",
  type: "feature",
  source: "client",
  origin: "direct",
  originCommunicationId: null,
  sourceRequirementIds: [],
  priority: 1,
  status: "draft",
  estimateDays: "",
  cancelReason: "",
});

const sourceRequirements = ref<SourceRequirement[]>([]);
const communications = ref<Communication[]>([]);
const loadingOptions = ref(false);
const saving = ref(false);
const formError = ref("");
const revisions = ref<RequirementRevision[]>([]);
const selectedRevision = ref<RequirementRevision | null>(null);
const historyError = ref("");

const editing = computed(() => Boolean(props.requirement));
const linkedSourceRequirements = computed(() =>
  sourceRequirements.value.filter((source) =>
    form.sourceRequirementIds.includes(source.id),
  ),
);
const parentId = computed(
  () => props.requirement?.parentId ?? props.parent?.id ?? null,
);
const parentRequirement = computed(() => props.parent ?? null);

const dialogTitle = computed(() => {
  if (editing.value) return `编辑需求 ${props.requirement?.code ?? ""}`;
  return parentRequirement.value ? "新建子需求" : "新建需求";
});

const dialogDescription = computed(() => {
  if (editing.value) return "修改需求内容；保存后会生成一个新的版本记录。";
  if (parentRequirement.value) {
    return `父需求：${parentRequirement.value.code} ${parentRequirement.value.title}`;
  }
  return "需求编号会根据项目代号自动生成。";
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    resetForm();
  },
  { immediate: true },
);

function resetForm() {
  const requirement = props.requirement;
  form.title = requirement?.title ?? props.presetTitle ?? "";
  form.description =
    requirement?.description ?? props.presetDescription ?? "";
  form.acceptanceCriteria = requirement?.acceptanceCriteria ?? "";
  form.designNotes = requirement?.designNotes ?? "";
  form.type = requirement?.type ?? "feature";
  form.source = requirement?.source ?? "client";
  form.origin = requirement?.origin ?? props.presetOrigin ?? "direct";
  form.originCommunicationId =
    requirement?.originCommunicationId ??
    props.presetOriginCommunicationId ??
    null;
  form.sourceRequirementIds = requirement
    ? []
    : (props.presetSourceRequirementIds ?? []);
  form.priority = requirement?.priority ?? 1;
  form.status = requirement?.status ?? "draft";
  form.estimateDays =
    requirement?.estimateDays != null ? String(requirement.estimateDays) : "";
  form.cancelReason = requirement?.cancelReason ?? "";
  formError.value = "";
  selectedRevision.value = null;
  historyError.value = "";
  revisions.value = [];
  void loadOptions();
  if (requirement) {
    void loadRevisions(requirement.id);
    void loadOriginLinks(requirement.id);
  }
}

async function loadOptions() {
  loadingOptions.value = true;
  try {
    const [sourceItems, communicationItems] = await Promise.all([
      listSourceRequirements(props.project.id),
      listCommunications(props.project.id),
    ]);
    sourceRequirements.value = sourceItems;
    communications.value = communicationItems.filter(
      (communication) => communication.status !== "archived",
    );
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loadingOptions.value = false;
  }
}

async function loadOriginLinks(requirementId: string) {
  try {
    form.sourceRequirementIds = await listRequirementSourceIds(requirementId);
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : String(cause);
  }
}

function handleOriginChange(value: string) {
  const origin = value as RequirementOrigin;
  form.origin = origin;
  formError.value = "";
  if (origin !== "communication") form.originCommunicationId = null;
  if (origin === "direct") form.sourceRequirementIds = [];
}

async function loadRevisions(requirementId: string) {
  try {
    revisions.value = await listRequirementRevisions(requirementId);
    selectedRevision.value = revisions.value[0] ?? null;
  } catch (cause) {
    historyError.value = cause instanceof Error ? cause.message : String(cause);
  }
}

async function save() {
  formError.value = "";
  const title = form.title.trim();
  if (!title) {
    formError.value = "需求标题不能为空";
    return;
  }
  if (form.status === "cancelled" && !form.cancelReason.trim()) {
    formError.value = "取消需求必须填写原因";
    return;
  }
  if (form.origin === "baseline" && form.sourceRequirementIds.length === 0) {
    formError.value = "原始需求来源至少需要关联一条原始需求";
    return;
  }
  if (form.origin === "communication" && !form.originCommunicationId) {
    formError.value = "沟通记录来源必须指定一条沟通记录";
    return;
  }

  let estimateDays: number | null = null;
  if (form.estimateDays.trim()) {
    const parsed = Number(form.estimateDays);
    if (!Number.isFinite(parsed) || parsed < 0) {
      formError.value = "预估人天必须是非负数字";
      return;
    }
    estimateDays = parsed;
  }

  const input: RequirementInput = {
    parentId: parentId.value,
    title,
    description: form.description.trim(),
    acceptanceCriteria: form.acceptanceCriteria.trim(),
    designNotes: form.designNotes.trim(),
    type: form.type,
    source: form.source,
    origin: form.origin,
    originCommunicationId:
      form.origin === "communication" ? form.originCommunicationId : null,
    sourceRequirementIds:
      form.origin === "direct" ? [] : form.sourceRequirementIds,
    priority: form.priority,
    status: form.status,
    estimateDays,
    cancelReason:
      form.status === "cancelled" ? form.cancelReason.trim() : null,
  };

  saving.value = true;
  try {
    const saved = props.requirement
      ? await store.update(props.requirement.id, input)
      : await store.create(props.project.id, input);
    emit("saved", saved);
    emit("close");
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppDialog
    :open="open"
    :title="dialogTitle"
    :description="dialogDescription"
    wide
    @close="emit('close')"
  >
    <div class="space-y-5">
      <FormField label="需求标题" required>
        <Input v-model="form.title" placeholder="一句话说清要做什么" />
      </FormField>

      <div class="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="需求来源" required>
            <Select
              :model-value="form.origin"
              @update:model-value="(value) => handleOriginChange(String(value))"
            >
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in REQUIREMENT_ORIGIN_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            v-if="form.origin === 'communication'"
            label="来源沟通记录"
            required
          >
            <CommunicationSelect
              v-model="form.originCommunicationId"
              :communications="communications"
            />
          </FormField>
        </div>

        <FormField
          v-if="form.origin === 'baseline'"
          label="关联原始需求"
          required
          hint="可以关联多条原始需求；一条原始需求也可以拆成多个开发需求。"
        >
          <SourceRequirementSelect
            v-model="form.sourceRequirementIds"
            :requirements="sourceRequirements"
          />
        </FormField>

        <FormField
          v-else-if="form.origin === 'communication'"
          label="关联原始需求（可选）"
          hint="如果这次沟通补充的内容属于原合同范围，可以关联对应原始需求。"
        >
          <SourceRequirementSelect
            v-model="form.sourceRequirementIds"
            :requirements="sourceRequirements"
          />
        </FormField>

        <p v-else class="text-sm text-muted-foreground">
          直接创建的需求不强制关联原始需求或沟通记录，适合内部改进、技术任务等场景。
        </p>

        <div
          v-if="linkedSourceRequirements.length > 0"
          class="space-y-3 rounded-md border border-border bg-background p-3"
        >
          <p class="text-xs font-medium text-muted-foreground">
            原始需求参考（只读）
          </p>
          <div
            v-for="source in linkedSourceRequirements"
            :key="source.id"
            class="space-y-1.5 border-b border-border pb-3 last:border-b-0 last:pb-0"
          >
            <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span class="font-mono">{{ source.code }}</span>
              <span v-if="source.moduleName">{{ source.moduleName }}</span>
              <span v-if="source.sourceRow > 0">第 {{ source.sourceRow }} 行</span>
              <span v-else>手工录入</span>
            </div>
            <p class="text-sm font-medium">{{ source.title }}</p>
            <p
              class="max-h-48 overflow-y-auto whitespace-pre-wrap pr-1 text-sm text-muted-foreground"
            >
              {{ source.description || "（原表没有描述）" }}
            </p>
          </div>
        </div>

        <p v-if="loadingOptions" class="text-xs text-muted-foreground">
          正在加载来源选项…
        </p>
      </div>

      <FormField label="需求描述">
        <Textarea
          v-model="form.description"
          class="min-h-24"
          placeholder="背景、目标、使用场景"
        />
      </FormField>

      <FormField label="验收标准">
        <Textarea
          v-model="form.acceptanceCriteria"
          class="min-h-20"
          placeholder="客户认可完成的条件，建议逐条列出"
        />
      </FormField>

      <FormField label="设计说明">
        <Textarea
          v-model="form.designNotes"
          class="min-h-20"
          placeholder="功能设计、交互说明、技术方案（可选）"
        />
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="类型">
          <Select
            :model-value="form.type"
            @update:model-value="
              (value) => (form.type = value as RequirementType)
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in REQUIREMENT_TYPE_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="提出方">
          <Select
            :model-value="form.source"
            @update:model-value="
              (value) => (form.source = value as RequirementSource)
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in REQUIREMENT_SOURCE_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="优先级">
          <Select
            :model-value="String(form.priority)"
            @update:model-value="
              (value) =>
                (form.priority = Number(value) as RequirementPriority)
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in REQUIREMENT_PRIORITY_OPTIONS"
                :key="option.value"
                :value="String(option.value)"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="状态">
          <Select
            :model-value="form.status"
            @update:model-value="
              (value) => (form.status = value as RequirementStatus)
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in REQUIREMENT_STATUS_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="预估人天">
          <Input
            v-model="form.estimateDays"
            type="number"
            min="0"
            step="0.5"
            placeholder="可选，例如 3"
          />
        </FormField>
      </div>

      <FormField v-if="form.status === 'cancelled'" label="取消原因" required>
        <Textarea
          v-model="form.cancelReason"
          class="min-h-16"
          placeholder="为什么取消这条需求"
        />
      </FormField>

      <div v-if="editing" class="space-y-3 border-t border-border pt-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold">版本历史</h3>
          <span class="text-xs text-muted-foreground">
            当前 v{{ props.requirement?.currentRevisionNo }}
          </span>
        </div>

        <p v-if="historyError" class="text-sm text-destructive">
          {{ historyError }}
        </p>
        <p
          v-else-if="revisions.length === 0"
          class="text-sm text-muted-foreground"
        >
          还没有版本记录。
        </p>

        <div v-else class="space-y-2">
          <div class="max-h-44 space-y-1 overflow-y-auto pr-1">
            <Button
              v-for="revision in revisions"
              :key="revision.id"
              variant="ghost"
              class="h-auto w-full justify-between gap-3 px-3 py-2 text-left"
              @click="selectedRevision = revision"
            >
              <span class="flex min-w-0 flex-col items-start">
                <span class="text-sm font-medium">
                  v{{ revision.revisionNo }} · {{ revision.changeSummary }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ formatDateTime(revision.createdAt) }}
                </span>
              </span>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs"
                :class="requirementStatusClass(revision.snapshot.status)"
              >
                {{ getRequirementStatusLabel(revision.snapshot.status) }}
              </span>
            </Button>
          </div>

          <div
            v-if="selectedRevision"
            class="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-sm"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">
                v{{ selectedRevision.revisionNo }} 快照
              </span>
              <span
                class="rounded-full px-2 py-0.5 text-xs"
                :class="requirementStatusClass(selectedRevision.snapshot.status)"
              >
                {{ getRequirementStatusLabel(selectedRevision.snapshot.status) }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ getRequirementPriorityLabel(selectedRevision.snapshot.priority) }}优先级
                · 预估
                {{ selectedRevision.snapshot.estimateDays ?? "—" }} 人天
              </span>
            </div>
            <p class="font-medium">{{ selectedRevision.snapshot.title }}</p>
            <p
              v-if="selectedRevision.snapshot.description"
              class="whitespace-pre-wrap text-muted-foreground"
            >
              {{ selectedRevision.snapshot.description }}
            </p>
            <p
              v-if="selectedRevision.snapshot.acceptanceCriteria"
              class="whitespace-pre-wrap text-muted-foreground"
            >
              验收标准：{{ selectedRevision.snapshot.acceptanceCriteria }}
            </p>
          </div>
        </div>
      </div>

      <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
    </div>

    <template #footer>
      <Button variant="outline" :disabled="saving" @click="emit('close')">
        取消
      </Button>
      <Button :disabled="saving" @click="save">
        {{ saving ? "保存中…" : editing ? "保存" : "创建" }}
      </Button>
    </template>
  </AppDialog>
</template>
