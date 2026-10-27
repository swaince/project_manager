<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  FileSpreadsheet,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  Upload,
} from "@lucide/vue";
import ImportSourceDialog from "@/components/source/ImportSourceDialog.vue";
import ManualSourceRequirementDialog from "@/components/source/ManualSourceRequirementDialog.vue";
import SourceRequirementDetailDialog from "@/components/source/SourceRequirementDetailDialog.vue";
import RequirementFormDialog from "@/components/requirements/RequirementFormDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCommunicationDraft, listCommunications } from "@/db/communications";
import {
  listSourceDocuments,
  listSourceRequirements,
} from "@/db/sourceRequirements";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import { requirementStatusClass } from "@/lib/ui";
import {
  getRequirementStatusLabel,
  type Communication,
  type Project,
  type SourceDocument,
  type SourceRequirement,
} from "@/types/models";

const props = defineProps<{ project: Project }>();
const router = useRouter();

const documents = ref<SourceDocument[]>([]);
const items = ref<SourceRequirement[]>([]);
const communications = ref<Communication[]>([]);
const selectedDocumentId = ref("all");
const selectionInitialized = ref(false);
const loading = ref(false);
const error = ref("");

const importOpen = ref(false);
const manualOpen = ref(false);
const detailOpen = ref(false);
const detailItem = ref<SourceRequirement | null>(null);
const refineOpen = ref(false);
const refineSourceIds = ref<string[]>([]);
const refineTitle = ref("");
const refineDescription = ref("");
const communicationBusy = ref(false);

onMounted(load);
watch(
  () => props.project.id,
  () => {
    selectionInitialized.value = false;
    selectedDocumentId.value = "all";
    load();
  },
);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    const [documentItems, sourceItems, communicationItems] = await Promise.all([
      listSourceDocuments(props.project.id),
      listSourceRequirements(props.project.id),
      listCommunications(props.project.id),
    ]);
    documents.value = documentItems;
    items.value = sourceItems;
    communications.value = communicationItems;
    if (!selectionInitialized.value && documentItems.length > 0) {
      selectedDocumentId.value = documentItems[0].id;
      selectionInitialized.value = true;
    }
    if (
      selectedDocumentId.value !== "all" &&
      !documentItems.some(
        (document) => document.id === selectedDocumentId.value,
      )
    ) {
      selectedDocumentId.value = "all";
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

const filteredItems = computed(() =>
  selectedDocumentId.value === "all"
    ? items.value
    : items.value.filter(
        (item) => item.documentId === selectedDocumentId.value,
      ),
);

const selectedDocument = computed(
  () =>
    documents.value.find(
      (document) => document.id === selectedDocumentId.value,
    ) ?? null,
);

const groups = computed(() => {
  const map = new Map<string, SourceRequirement[]>();
  for (const item of filteredItems.value) {
    const key = item.moduleName || "未分组";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()].map(([moduleName, moduleItems]) => ({
    moduleName,
    items: moduleItems,
  }));
});

const stats = computed(() => {
  const total = filteredItems.value.length;
  const covered = filteredItems.value.filter(
    (item) => item.linkedRequirements.length > 0,
  ).length;
  return { total, covered, uncovered: total - covered };
});

const communicationsBySource = computed(() => {
  const map = new Map<string, Communication[]>();
  for (const communication of communications.value) {
    if (communication.status === "archived") continue;
    for (const link of communication.sourceRequirements) {
      const list = map.get(link.id) ?? [];
      list.push(communication);
      map.set(link.id, list);
    }
  }
  return map;
});

function existingCommunications(item: SourceRequirement): Communication[] {
  return communicationsBySource.value.get(item.id) ?? [];
}

const expandedSourceIds = ref<string[]>([]);

function toggleCommunications(item: SourceRequirement) {
  expandedSourceIds.value = expandedSourceIds.value.includes(item.id)
    ? expandedSourceIds.value.filter((value) => value !== item.id)
    : [...expandedSourceIds.value, item.id];
}

function openCommunicationDetail(communication: Communication) {
  void router.push(
    `/projects/${props.project.id}/communications/${communication.id}`,
  );
}

function openDetail(item: SourceRequirement) {
  detailItem.value = item;
  detailOpen.value = true;
}

function openRefine(item: SourceRequirement) {
  refineSourceIds.value = [item.id];
  refineTitle.value = item.title;
  refineDescription.value = item.description;
  detailOpen.value = false;
  refineOpen.value = true;
}

function openCommunication(item: SourceRequirement) {
  if (communicationBusy.value) return;
  detailOpen.value = false;
  const existing = existingCommunications(item)[0];
  if (existing) {
    void router.push(
      `/projects/${props.project.id}/communications/${existing.id}`,
    );
    return;
  }
  communicationBusy.value = true;
  void createCommunicationDraft(props.project.id, {
    title: `关于「${item.title}」的沟通`,
    sourceRequirementIds: [item.id],
  })
    .then((created) => {
      return router.push(
        `/projects/${props.project.id}/communications/${created.id}`,
      );
    })
    .catch((cause) => {
      error.value = cause instanceof Error ? cause.message : String(cause);
    })
    .finally(() => {
      communicationBusy.value = false;
    });
}

function onImported() {
  importOpen.value = false;
  selectionInitialized.value = false;
  load();
}

function onManualSaved() {
  manualOpen.value = false;
  selectionInitialized.value = false;
  load();
}

function onRefined() {
  refineOpen.value = false;
  load();
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">原始需求</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Excel 导入或手工新建的合同范围基线；细化出开发需求后自动计算覆盖状态。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="manualOpen = true">
          <Plus class="size-4" />
          新建原始需求
        </Button>
        <Button @click="importOpen = true">
          <Upload class="size-4" />
          导入 Excel
        </Button>
      </div>
    </div>

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
      v-else-if="documents.length === 0"
      class="rounded-xl border border-dashed border-border p-10 text-center"
    >
      <FileSpreadsheet class="mx-auto size-8 text-muted-foreground" />
      <p class="mt-3 text-sm font-medium">还没有导入原始需求</p>
      <p class="mt-1 text-sm text-muted-foreground">
        导入客户 Excel，或直接新建原始需求，作为后续沟通记录和细化的基线。
      </p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="outline" @click="manualOpen = true">
          <Plus class="size-4" />
          新建原始需求
        </Button>
        <Button variant="outline" @click="importOpen = true">
          <Upload class="size-4" />
          导入 Excel
        </Button>
      </div>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="selectedDocumentId">
          <SelectTrigger class="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源文件</SelectItem>
            <SelectItem
              v-for="document in documents"
              :key="document.id"
              :value="document.id"
            >
              {{ document.title }}
              <span v-if="document.version">（{{ document.version }}）</span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="outline">共 {{ stats.total }} 条</Badge>
        <Badge variant="secondary">已细化 {{ stats.covered }}</Badge>
        <Badge variant="outline">未细化 {{ stats.uncovered }}</Badge>
      </div>

      <div
        v-if="selectedDocument"
        class="rounded-lg border border-border bg-muted/20 p-4 text-sm"
      >
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span class="font-medium">{{ selectedDocument.title }}</span>
          <span v-if="selectedDocument.version" class="text-muted-foreground">
            {{ selectedDocument.version }}
          </span>
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock class="size-3.5" />
            已锁定
          </span>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          <template v-if="selectedDocument.isManual">
            手工录入 · 创建于
            {{ formatDateTime(selectedDocument.importedAt) }}
          </template>
          <template v-else>
            {{ selectedDocument.fileName }} · 工作表
            {{ selectedDocument.sheetName }} · 导入于
            {{ formatDateTime(selectedDocument.importedAt) }}
          </template>
        </p>
        <p v-if="selectedDocument.note" class="mt-1 text-xs text-muted-foreground">
          {{ selectedDocument.note }}
        </p>
      </div>

      <div
        v-if="filteredItems.length === 0"
        class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
      >
        这个来源文件下没有原始需求。
      </div>

      <div v-else class="space-y-4">
        <section
          v-for="group in groups"
          :key="group.moduleName"
          class="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div
            class="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5"
          >
            <h3 class="text-sm font-semibold">{{ group.moduleName }}</h3>
            <span class="text-xs text-muted-foreground">
              {{ group.items.length }} 条
            </span>
          </div>

          <div class="divide-y divide-border">
            <article
              v-for="item in group.items"
              :key="item.id"
              class="p-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-xs text-muted-foreground">
                      {{ item.code }}
                    </span>
                    <span class="text-xs text-muted-foreground">
                      <template v-if="item.sourceRow > 0">
                        第 {{ item.sourceRow }} 行
                      </template>
                      <template v-else>手工录入</template>
                    </span>
                    <span
                      v-if="item.linkedRequirements.length > 0"
                      class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    >
                      已细化 {{ item.linkedRequirements.length }}
                    </span>
                    <span
                      v-else
                      class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      未细化
                    </span>
                    <button
                      v-if="existingCommunications(item).length > 0"
                      type="button"
                      class="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50"
                      @click="toggleCommunications(item)"
                    >
                      已沟通 {{ existingCommunications(item).length }} 次 ·
                      {{ expandedSourceIds.includes(item.id) ? "收起" : "查看" }}
                    </button>
                  </div>
                  <button
                    class="mt-1 block max-w-full truncate text-left text-sm font-medium hover:underline"
                    @click="openDetail(item)"
                  >
                    {{ item.title }}
                  </button>
                  <p
                    v-if="item.description"
                    class="mt-1 line-clamp-2 text-sm text-muted-foreground"
                  >
                    {{ item.description }}
                  </p>
                </div>

                <div class="flex shrink-0 flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    :disabled="communicationBusy"
                    @click="openCommunication(item)"
                  >
                    <MessageSquare
                      v-if="existingCommunications(item).length > 0"
                      class="size-3.5"
                    />
                    <MessageSquarePlus v-else class="size-3.5" />
                    {{
                      existingCommunications(item).length > 0
                        ? "继续沟通"
                        : "新建沟通记录"
                    }}
                  </Button>
                  <Button variant="outline" size="sm" @click="openRefine(item)">
                    细化
                  </Button>
                </div>
              </div>

              <div
                v-if="item.linkedRequirements.length > 0"
                class="mt-3 flex flex-wrap items-center gap-2"
              >
                <span class="text-xs text-muted-foreground">开发需求</span>
                <Badge
                  v-for="linked in item.linkedRequirements"
                  :key="linked.id"
                  variant="outline"
                >
                  <span class="font-mono text-[0.7rem]">{{ linked.code }}</span>
                  <span
                    class="rounded-full px-1.5 py-0.5 text-[0.7rem]"
                    :class="requirementStatusClass(linked.status)"
                  >
                    {{ getRequirementStatusLabel(linked.status) }}
                  </span>
                </Badge>
              </div>

              <div
                v-if="expandedSourceIds.includes(item.id)"
                class="mt-3 space-y-3 rounded-lg border border-border bg-muted/20 p-3"
              >
                <div
                  v-for="communication in existingCommunications(item)"
                  :key="communication.id"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      class="text-sm font-medium hover:underline"
                      @click="openCommunicationDetail(communication)"
                    >
                      {{ communication.title }}
                    </button>
                    <span class="text-xs text-muted-foreground">
                      {{ communication.sessions.length }} 场 · 更新于
                      {{ formatDateTime(communication.updatedAt) }}
                    </span>
                  </div>
                  <ul class="mt-1 space-y-1">
                    <li
                      v-for="(session, index) in communication.sessions"
                      :key="session.id"
                      class="line-clamp-2 text-xs text-muted-foreground"
                    >
                      第 {{ index + 1 }} 场 ·
                      {{ formatDateOnly(session.occurredAt) }}
                      <template v-if="session.decisions">
                        · 结论：{{ session.decisions }}
                      </template>
                      <template v-if="session.followUps">
                        · 待办：{{ session.followUps }}
                      </template>
                      <template v-if="!session.decisions && !session.followUps">
                        · {{ session.summary || "（未填写摘要）" }}
                      </template>
                    </li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </template>

    <ImportSourceDialog
      :open="importOpen"
      :project="project"
      @close="importOpen = false"
      @saved="onImported"
    />

    <ManualSourceRequirementDialog
      :open="manualOpen"
      :project-id="project.id"
      @close="manualOpen = false"
      @saved="onManualSaved"
    />

    <SourceRequirementDetailDialog
      :open="detailOpen"
      :requirement="detailItem"
      :communication-count="
        detailItem ? existingCommunications(detailItem).length : 0
      "
      @close="detailOpen = false"
      @communicate="detailItem && openCommunication(detailItem)"
      @refine="detailItem && openRefine(detailItem)"
    />

    <RequirementFormDialog
      :open="refineOpen"
      :project="project"
      preset-origin="baseline"
      :preset-source-requirement-ids="refineSourceIds"
      :preset-title="refineTitle"
      :preset-description="refineDescription"
      @close="refineOpen = false"
      @saved="onRefined"
    />
  </section>
</template>
