<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { FolderKanban, Pencil, Plus, Trash2, X } from "@lucide/vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import FormField from "@/components/ui/FormField.vue";
import StakeholderSelect from "@/components/ui/StakeholderSelect.vue";
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
import { useStakeholdersStore } from "@/stores/stakeholders";
import { useProjectsStore } from "@/stores/projects";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import { projectStatusClass } from "@/lib/ui";
import {
  PROJECT_STATUS_OPTIONS,
  getProjectStatusLabel,
  type Project,
  type ProjectInput,
  type ProjectStakeholder,
  type ProjectStatus,
} from "@/types/models";

interface ProjectForm {
  name: string;
  code: string;
  status: ProjectStatus;
  startDate: string;
  targetDate: string;
  stakeholderIds: string[];
  stakeholderRoles: Record<string, string>;
  description: string;
}

const projectStore = useProjectsStore();
const stakeholderStore = useStakeholdersStore();

const loading = ref(false);
const error = ref("");
const dialogOpen = ref(false);
const editing = ref<Project | null>(null);
const saving = ref(false);
const formError = ref("");
const deleteTarget = ref<Project | null>(null);
const deleting = ref(false);

const form = reactive<ProjectForm>({
  name: "",
  code: "",
  status: "active",
  startDate: "",
  targetDate: "",
  stakeholderIds: [],
  stakeholderRoles: {},
  description: "",
});

const deleteMessage = computed(() =>
  deleteTarget.value
    ? `确定删除项目「${deleteTarget.value.name}」吗？此操作不可撤销。`
    : "",
);

onMounted(load);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    await Promise.all([
      projectStore.fetchAll(),
      stakeholderStore.fetchAll(),
    ]);
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  resetForm();
  formError.value = "";
  dialogOpen.value = true;
}

function openEdit(project: Project) {
  editing.value = project;
  form.name = project.name;
  form.code = project.code;
  form.status = project.status;
  form.startDate = project.startDate ?? "";
  form.targetDate = project.targetDate ?? "";
  form.stakeholderIds = project.stakeholders.map(
    (stakeholder) => stakeholder.id,
  );
  form.stakeholderRoles = Object.fromEntries(
    project.stakeholders.map((stakeholder) => [
      stakeholder.id,
      stakeholder.role ?? "",
    ]),
  );
  form.description = project.description;
  formError.value = "";
  dialogOpen.value = true;
}

function resetForm() {
  form.name = "";
  form.code = "";
  form.status = "active";
  form.startDate = "";
  form.targetDate = "";
  form.stakeholderIds = [];
  form.stakeholderRoles = {};
  form.description = "";
}

function updateStakeholderIds(ids: string[]) {
  const roles: Record<string, string> = {};
  for (const id of ids) {
    roles[id] = form.stakeholderRoles[id] ?? "";
  }
  form.stakeholderIds = ids;
  form.stakeholderRoles = roles;
}

function removeStakeholder(id: string) {
  updateStakeholderIds(
    form.stakeholderIds.filter((stakeholderId) => stakeholderId !== id),
  );
}

function selectedStakeholder(id: string) {
  return stakeholderStore.items.find((stakeholder) => stakeholder.id === id);
}

function formatProjectStakeholders(stakeholders: ProjectStakeholder[]): string {
  return stakeholders
    .map((stakeholder) =>
      stakeholder.role
        ? `${stakeholder.name}（${stakeholder.role}）`
        : stakeholder.name,
    )
    .join("、");
}

async function save() {
  formError.value = "";
  const name = form.name.trim();
  const code = form.code.trim().toUpperCase();

  if (!name) {
    formError.value = "项目名称不能为空";
    return;
  }
  if (!code) {
    formError.value = "项目代号不能为空";
    return;
  }
  if (!/^[A-Z][A-Z0-9_-]*$/.test(code)) {
    formError.value = "项目代号需以字母开头，只能包含字母、数字、下划线或连字符";
    return;
  }
  if (form.startDate && form.targetDate && form.startDate > form.targetDate) {
    formError.value = "目标日期不能早于开始日期";
    return;
  }

  saving.value = true;
  try {
    const input: ProjectInput = {
      name,
      code,
      description: form.description.trim(),
      status: form.status,
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
      stakeholders: form.stakeholderIds.map((id) => ({
        id,
        role: form.stakeholderRoles[id]?.trim() || null,
      })),
    };

    if (editing.value) {
      await projectStore.update(editing.value.id, input);
    } else {
      await projectStore.create(input);
    }
    dialogOpen.value = false;
  } catch (cause) {
    formError.value = errorMessage(cause);
  } finally {
    saving.value = false;
  }
}

function askDelete(project: Project) {
  deleteTarget.value = project;
}

async function confirmDelete() {
  const project = deleteTarget.value;
  if (!project) return;

  deleting.value = true;
  error.value = "";
  try {
    await projectStore.remove(project.id);
    deleteTarget.value = null;
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    deleting.value = false;
  }
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
</script>

<template>
  <section class="space-y-6 p-6 lg:p-8">
    <PageHeader title="项目" description="按项目组织需求、沟通记录、版本和变更。">
      <Button @click="openCreate">
        <Plus class="size-4" />
        新建项目
      </Button>
    </PageHeader>

    <div
      v-if="error"
      class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div
      v-if="loading"
      class="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"
    >
      加载中…
    </div>

    <div
      v-else-if="projectStore.items.length === 0"
      class="rounded-xl border border-dashed border-border p-10 text-center"
    >
      <FolderKanban class="mx-auto size-8 text-muted-foreground" />
      <p class="mt-3 text-sm font-medium">暂无项目</p>
      <p class="mt-1 text-sm text-muted-foreground">
        项目创建后会在这里显示干系人、状态和目标日期。
      </p>
      <Button variant="outline" class="mt-4" @click="openCreate">
        <Plus class="size-4" />
        新建项目
      </Button>
    </div>

    <div
      v-else
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"
          >
            <tr>
              <th class="px-4 py-3 font-medium">代号</th>
              <th class="px-4 py-3 font-medium">项目</th>
              <th class="hidden px-4 py-3 font-medium md:table-cell">干系人</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="hidden whitespace-nowrap px-4 py-3 font-medium lg:table-cell">目标日期</th>
              <th class="hidden whitespace-nowrap px-4 py-3 font-medium lg:table-cell">更新时间</th>
              <th class="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="project in projectStore.items"
              :key="project.id"
              class="transition-colors hover:bg-muted/30"
            >
              <td class="px-4 py-3">
                <span
                  class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                >
                  {{ project.code }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
                  >
                    <FolderKanban class="size-4" />
                  </div>
                  <div class="min-w-0">
                    <RouterLink
                      :to="`/projects/${project.id}`"
                      class="block truncate font-medium hover:underline"
                    >
                      {{ project.name }}
                    </RouterLink>
                    <p
                      v-if="project.description"
                      class="mt-0.5 line-clamp-1 text-xs text-muted-foreground"
                    >
                      {{ project.description }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="hidden px-4 py-3 text-muted-foreground md:table-cell">
                <span
                  v-if="project.stakeholders.length > 0"
                  class="line-clamp-2"
                  :title="formatProjectStakeholders(project.stakeholders)"
                >
                  {{ formatProjectStakeholders(project.stakeholders) }}
                </span>
                <span v-else>未指定干系人</span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="projectStatusClass(project.status)"
                >
                  <span class="size-1.5 rounded-full bg-current opacity-70" />
                  {{ getProjectStatusLabel(project.status) }}
                </span>
              </td>
              <td class="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                {{ formatDateOnly(project.targetDate) }}
              </td>
              <td class="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                {{ formatDateTime(project.updatedAt) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="openEdit(project)"
                  >
                    <Pencil class="size-3.5" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    @click="askDelete(project)"
                  >
                    <Trash2 class="size-3.5" />
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppDialog
      :open="dialogOpen"
      :title="editing ? '编辑项目' : '新建项目'"
      :description="
        editing
          ? '修改项目信息。'
          : '项目代号用于后续需求编号，例如 CRM-001。'
      "
      wide
      @close="dialogOpen = false"
    >
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="项目名称" required>
            <Input v-model="form.name" placeholder="例如：CRM 管理系统" />
          </FormField>
          <FormField
            label="项目代号"
            required
            hint="字母开头，用作需求编号前缀"
          >
            <Input
              v-model="form.code"
              class="font-mono uppercase"
              placeholder="例如：CRM"
            />
          </FormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <FormField label="状态">
            <Select
              :model-value="form.status"
              @update:model-value="
                (value) => (form.status = value as ProjectStatus)
              "
            >
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="status in PROJECT_STATUS_OPTIONS"
                  :key="status.value"
                  :value="status.value"
                >
                  {{ status.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="开始日期">
            <DatePicker v-model="form.startDate" placeholder="选择开始日期" />
          </FormField>
          <FormField label="目标日期">
            <DatePicker v-model="form.targetDate" placeholder="选择目标日期" />
          </FormField>
        </div>

        <FormField
          label="干系人"
          hint="搜索并多选；角色按本项目填写"
        >
          <StakeholderSelect
            :model-value="form.stakeholderIds"
            :stakeholders="stakeholderStore.items"
            @update:model-value="updateStakeholderIds"
          />
        </FormField>

        <div v-if="form.stakeholderIds.length > 0" class="space-y-2">
          <div
            v-for="id in form.stakeholderIds"
            :key="id"
            class="flex items-center gap-3 rounded-md border border-border p-2"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ selectedStakeholder(id)?.name }}
              </p>
              <p
                v-if="selectedStakeholder(id)?.company"
                class="truncate text-xs text-muted-foreground"
              >
                {{ selectedStakeholder(id)?.company }}
              </p>
            </div>
            <Input
              v-model="form.stakeholderRoles[id]"
              placeholder="本项目角色，如负责人"
              class="max-w-56"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="移除干系人"
              @click="removeStakeholder(id)"
            >
              <X class="size-4" />
            </Button>
          </div>
        </div>

        <FormField label="项目描述">
          <Textarea
            v-model="form.description"
            class="min-h-24"
            placeholder="项目背景、目标（可选）"
          />
        </FormField>

        <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
      </div>

      <template #footer>
        <Button variant="outline" :disabled="saving" @click="dialogOpen = false">
          取消
        </Button>
        <Button :disabled="saving" @click="save">
          {{ saving ? "保存中…" : editing ? "保存" : "创建" }}
        </Button>
      </template>
    </AppDialog>

    <ConfirmDialog
      :open="deleteTarget !== null"
      title="删除项目"
      :message="deleteMessage"
      :busy="deleting"
      @close="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
