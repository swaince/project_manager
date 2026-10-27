<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  Archive,
  MessageSquarePlus,
  MessagesSquare,
  Plus,
  RotateCcw,
} from "@lucide/vue";
import RequirementFormDialog from "@/components/requirements/RequirementFormDialog.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  archiveCommunication,
  createCommunicationDraft,
  restoreCommunication,
} from "@/db/communications";
import { useCommunicationsStore } from "@/stores/communications";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import { communicationStatusClass } from "@/lib/ui";
import {
  getCommunicationStatusLabel,
  type Communication,
  type CommunicationSession,
  type CommunicationStatus,
  type Project,
} from "@/types/models";

const props = defineProps<{ project: Project }>();

const router = useRouter();
const store = useCommunicationsStore();

const loading = ref(false);
const error = ref("");
const query = ref("");
const statusFilter = ref<"active" | "all" | CommunicationStatus>("active");
const creating = ref(false);
const archiveTarget = ref<Communication | null>(null);
const archiveBusy = ref(false);
const actionError = ref("");
const requirementTarget = ref<Communication | null>(null);

onMounted(load);
watch(() => props.project.id, load);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    await store.fetchAll(props.project.id);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

async function createCommunication() {
  if (creating.value) return;
  creating.value = true;
  error.value = "";
  try {
    const created = await createCommunicationDraft(props.project.id);
    await router.push(
      `/projects/${props.project.id}/communications/${created.id}`,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    creating.value = false;
  }
}

function latestSession(
  communication: Communication,
): CommunicationSession | null {
  return communication.sessions[communication.sessions.length - 1] ?? null;
}

const filteredItems = computed(() => {
  const text = query.value.trim().toLowerCase();
  return store.items.filter((communication) => {
    if (statusFilter.value === "active") {
      if (communication.status === "archived") return false;
    } else if (
      statusFilter.value !== "all" &&
      communication.status !== statusFilter.value
    ) {
      return false;
    }
    if (!text) return true;
    const sessionText = communication.sessions
      .map(
        (session) =>
          `${session.participants} ${session.summary} ${session.decisions} ${session.followUps}`,
      )
      .join(" ");
    const requirementText = [
      ...communication.requirements.map(
        (requirement) => `${requirement.code} ${requirement.title}`,
      ),
      ...communication.sourceRequirements.map(
        (requirement) => `${requirement.code} ${requirement.title}`,
      ),
    ].join(" ");
    return [
      communication.title,
      sessionText,
      requirementText,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(text));
  });
});

const statusCounts = computed(() => {
  const counts = {
    draft: 0,
    in_progress: 0,
    completed: 0,
    archived: 0,
  };
  for (const item of store.items) counts[item.status] += 1;
  return counts;
});

function requestArchive(communication: Communication) {
  actionError.value = "";
  archiveTarget.value = communication;
}

async function confirmArchive() {
  if (!archiveTarget.value) return;
  archiveBusy.value = true;
  actionError.value = "";
  try {
    if (archiveTarget.value.status === "archived") {
      await restoreCommunication(archiveTarget.value.id);
    } else {
      await archiveCommunication(archiveTarget.value.id);
    }
    archiveTarget.value = null;
    await load();
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    archiveBusy.value = false;
  }
}

function openCreateRequirement(communication: Communication) {
  requirementTarget.value = communication;
}

async function afterRequirementCreated() {
  requirementTarget.value = null;
  await load();
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">沟通记录</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          按沟通主题记录，支持多场次续谈、自动保存和附件。
        </p>
      </div>
      <Button :disabled="creating" @click="createCommunication">
        <Plus class="size-4" />
        {{ creating ? "创建中…" : "新建沟通记录" }}
      </Button>
    </div>

    <div
      v-if="error"
      class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div
      v-if="actionError"
      class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ actionError }}
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="w-full max-w-sm">
        <Input
          v-model="query"
          placeholder="搜索主题、场次内容、参与人、需求编号…"
          class="pl-3"
        />
      </div>

      <Select
        :model-value="statusFilter"
        @update:model-value="
          (value) =>
            (statusFilter = value as 'active' | 'all' | CommunicationStatus)
        "
      >
        <SelectTrigger class="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">全部（不含归档）</SelectItem>
          <SelectItem value="draft">草稿 {{ statusCounts.draft }}</SelectItem>
          <SelectItem value="in_progress">
            进行中 {{ statusCounts.in_progress }}
          </SelectItem>
          <SelectItem value="completed">
            已完成 {{ statusCounts.completed }}
          </SelectItem>
          <SelectItem value="archived">
            已归档 {{ statusCounts.archived }}
          </SelectItem>
          <SelectItem value="all">全部</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div
      v-if="loading"
      class="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"
    >
      加载中…
    </div>

    <div
      v-else-if="store.items.length === 0"
      class="rounded-xl border border-dashed border-border p-10 text-center"
    >
      <MessagesSquare class="mx-auto size-8 text-muted-foreground" />
      <p class="mt-3 text-sm font-medium">还没有沟通记录</p>
      <p class="mt-1 text-sm text-muted-foreground">
        新建一个沟通主题，可以边聊边记，跨天继续补充。
      </p>
      <Button variant="outline" class="mt-4" :disabled="creating" @click="createCommunication">
        <Plus class="size-4" />
        新建沟通记录
      </Button>
    </div>

    <div
      v-else-if="filteredItems.length === 0"
      class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
    >
      没有匹配的沟通记录。
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="communication in filteredItems"
        :key="communication.id"
        class="rounded-xl border border-border bg-card p-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="communicationStatusClass(communication.status)"
              >
                {{ getCommunicationStatusLabel(communication.status) }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ communication.sessions.length }} 场
              </span>
              <span
                v-if="communication.attachments.length > 0"
                class="text-xs text-muted-foreground"
              >
                · {{ communication.attachments.length }} 个附件
              </span>
            </div>

            <RouterLink
              :to="`/projects/${project.id}/communications/${communication.id}`"
              class="block truncate text-base font-semibold hover:underline"
            >
              {{ communication.title }}
            </RouterLink>

            <p class="text-xs text-muted-foreground">
              <template v-if="latestSession(communication)">
                {{ formatDateOnly(latestSession(communication)?.occurredAt) }}
                <template v-if="latestSession(communication)?.participants">
                  · {{ latestSession(communication)?.participants }}
                </template>
              </template>
              <template v-else>还没有场次</template>
              · 更新于 {{ formatDateTime(communication.updatedAt) }}
            </p>

            <p
              v-if="latestSession(communication)?.summary"
              class="line-clamp-2 text-sm text-muted-foreground"
            >
              {{ latestSession(communication)?.summary }}
            </p>
          </div>

          <div class="flex shrink-0 flex-wrap gap-1">
            <Button
              v-if="communication.status !== 'archived'"
              variant="ghost"
              size="sm"
              @click="openCreateRequirement(communication)"
            >
              <MessageSquarePlus class="size-3.5" />
              新建需求
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="requestArchive(communication)"
            >
              <RotateCcw
                v-if="communication.status === 'archived'"
                class="size-3.5"
              />
              <Archive v-else class="size-3.5" />
              {{ communication.status === "archived" ? "恢复" : "归档" }}
            </Button>
            <Button as-child size="sm">
              <RouterLink
                :to="`/projects/${project.id}/communications/${communication.id}`"
              >
                {{ communication.status === "archived" ? "查看" : "继续记录" }}
              </RouterLink>
            </Button>
          </div>
        </div>

        <div
          v-if="
            communication.sourceRequirements.length > 0 ||
            communication.requirements.length > 0
          "
          class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
        >
          <template v-if="communication.sourceRequirements.length > 0">
            <span class="text-xs text-muted-foreground">原始需求</span>
            <Badge
              v-for="requirement in communication.sourceRequirements"
              :key="requirement.id"
              variant="secondary"
            >
              <span class="font-mono text-[0.7rem]">{{ requirement.code }}</span>
              <span class="max-w-40 truncate">{{ requirement.title }}</span>
            </Badge>
          </template>
          <template v-if="communication.requirements.length > 0">
            <span class="ml-2 text-xs text-muted-foreground">开发需求</span>
            <Badge
              v-for="requirement in communication.requirements"
              :key="requirement.id"
              variant="outline"
            >
              <span class="font-mono text-[0.7rem]">{{ requirement.code }}</span>
              <span class="max-w-40 truncate">{{ requirement.title }}</span>
            </Badge>
          </template>
        </div>
      </article>
    </div>

    <ConfirmDialog
      :open="Boolean(archiveTarget)"
      :title="
        archiveTarget?.status === 'archived' ? '恢复沟通记录' : '归档沟通记录'
      "
      :message="
        archiveTarget?.status === 'archived'
          ? '恢复后这条沟通记录会重新出现在默认列表中。'
          : '归档后这条记录会从默认列表隐藏，内容不会删除，可以随时恢复。'
      "
      :confirm-label="archiveTarget?.status === 'archived' ? '恢复' : '归档'"
      :busy="archiveBusy"
      @close="archiveTarget = null"
      @confirm="confirmArchive"
    />

    <RequirementFormDialog
      :open="Boolean(requirementTarget)"
      :project="project"
      preset-origin="communication"
      :preset-origin-communication-id="requirementTarget?.id ?? null"
      @close="requirementTarget = null"
      @saved="afterRequirementCreated"
    />
  </section>
</template>
