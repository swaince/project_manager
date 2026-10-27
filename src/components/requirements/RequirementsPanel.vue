<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Pencil,
  Plus,
} from "@lucide/vue";
import RequirementFormDialog from "@/components/requirements/RequirementFormDialog.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRequirementsStore } from "@/stores/requirements";
import { formatDateTime } from "@/lib/dates";
import { requirementStatusClass } from "@/lib/ui";
import {
  REQUIREMENT_ORIGIN_OPTIONS,
  REQUIREMENT_PRIORITY_OPTIONS,
  REQUIREMENT_STATUS_OPTIONS,
  REQUIREMENT_TYPE_OPTIONS,
  getRequirementOriginLabel,
  getRequirementPriorityLabel,
  getRequirementStatusLabel,
  getRequirementTypeLabel,
  type Project,
  type Requirement,
  type RequirementOrigin,
  type RequirementStatus,
  type RequirementType,
} from "@/types/models";

const props = defineProps<{ project: Project }>();

const store = useRequirementsStore();

const loading = ref(false);
const error = ref("");
const query = ref("");
const statusFilter = ref<"all" | RequirementStatus>("all");
const typeFilter = ref<"all" | RequirementType>("all");
const originFilter = ref<"all" | RequirementOrigin>("all");
const priorityFilter = ref<"all" | string>("all");
const collapsed = ref<Set<string>>(new Set());
const dialogOpen = ref(false);
const editing = ref<Requirement | null>(null);
const parentForNew = ref<Requirement | null>(null);

onMounted(load);
watch(() => props.project.id, load);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    await store.fetchAll(props.project.id);
    collapsed.value = new Set();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  parentForNew.value = null;
  dialogOpen.value = true;
}

function openCreateChild(parent: Requirement) {
  editing.value = null;
  parentForNew.value = parent;
  dialogOpen.value = true;
}

function openEdit(requirement: Requirement) {
  editing.value = requirement;
  parentForNew.value = requirement.parentId
    ? store.items.find((item) => item.id === requirement.parentId) ?? null
    : null;
  dialogOpen.value = true;
}

function toggleCollapse(id: string) {
  const next = new Set(collapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsed.value = next;
}

const filteredItems = computed(() => {
  const text = query.value.trim().toLowerCase();
  const matches = store.items.filter((item) => {
    if (statusFilter.value !== "all" && item.status !== statusFilter.value) {
      return false;
    }
    if (typeFilter.value !== "all" && item.type !== typeFilter.value) {
      return false;
    }
    if (originFilter.value !== "all" && item.origin !== originFilter.value) {
      return false;
    }
    if (
      priorityFilter.value !== "all" &&
      item.priority !== Number(priorityFilter.value)
    ) {
      return false;
    }
    if (!text) return true;
    return [item.code, item.title, item.description, item.acceptanceCriteria]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(text));
  });

  if (!text && statusFilter.value === "all" && typeFilter.value === "all" && originFilter.value === "all" && priorityFilter.value === "all") {
    return store.items;
  }

  const byId = new Map(store.items.map((item) => [item.id, item]));
  const include = new Set(matches.map((item) => item.id));
  for (const item of matches) {
    let parentId = item.parentId;
    while (parentId) {
      include.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }
  return store.items.filter((item) => include.has(item.id));
});

const childrenMap = computed(() => {
  const map = new Map<string | null, Requirement[]>();
  for (const item of filteredItems.value) {
    const list = map.get(item.parentId) ?? [];
    list.push(item);
    map.set(item.parentId, list);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }
  return map;
});

const rows = computed(() => {
  const result: { item: Requirement; hasChildren: boolean }[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null) => {
    for (const item of childrenMap.value.get(parentId) ?? []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const children = childrenMap.value.get(item.id) ?? [];
      result.push({ item, hasChildren: children.length > 0 });
      if (!collapsed.value.has(item.id)) walk(item.id);
    }
  };
  walk(null);
  for (const item of filteredItems.value) {
    if (!seen.has(item.id)) {
      result.push({ item, hasChildren: false });
    }
  }
  return result;
});

function formatActualDate(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">需求台账</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          共 {{ store.items.length }} 条需求
        </p>
      </div>
      <Button @click="openCreate">
        <Plus class="size-4" />
        新建需求
      </Button>
    </div>

    <div
      v-if="error"
      class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="relative w-full max-w-sm">
        <Input
          v-model="query"
          placeholder="搜索编号、标题、描述…"
          class="pl-3"
        />
      </div>

      <Select
        :model-value="statusFilter"
        @update:model-value="
          (value) => (statusFilter = value as 'all' | RequirementStatus)
        "
      >
        <SelectTrigger class="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem
            v-for="option in REQUIREMENT_STATUS_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        :model-value="typeFilter"
        @update:model-value="
          (value) => (typeFilter = value as 'all' | RequirementType)
        "
      >
        <SelectTrigger class="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部类型</SelectItem>
          <SelectItem
            v-for="option in REQUIREMENT_TYPE_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        :model-value="originFilter"
        @update:model-value="
          (value) => (originFilter = value as 'all' | RequirementOrigin)
        "
      >
        <SelectTrigger class="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部来源</SelectItem>
          <SelectItem
            v-for="option in REQUIREMENT_ORIGIN_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        :model-value="priorityFilter"
        @update:model-value="(value) => (priorityFilter = String(value))"
      >
        <SelectTrigger class="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部优先级</SelectItem>
          <SelectItem
            v-for="option in REQUIREMENT_PRIORITY_OPTIONS"
            :key="option.value"
            :value="String(option.value)"
          >
            {{ option.label }}
          </SelectItem>
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
      <CornerDownRight class="mx-auto size-8 text-muted-foreground" />
      <p class="mt-3 text-sm font-medium">还没有需求</p>
      <p class="mt-1 text-sm text-muted-foreground">
        从一条需求开始，后续可以拆分模块和子功能。
      </p>
      <Button variant="outline" class="mt-4" @click="openCreate">
        <Plus class="size-4" />
        新建需求
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
              <th class="whitespace-nowrap px-3 py-3 font-medium">编号</th>
              <th class="px-3 py-3 font-medium">标题</th>
              <th class="hidden whitespace-nowrap px-3 py-3 font-medium md:table-cell">来源</th>
              <th class="hidden whitespace-nowrap px-3 py-3 font-medium lg:table-cell">类型</th>
              <th class="hidden whitespace-nowrap px-3 py-3 font-medium lg:table-cell">优先级</th>
              <th class="whitespace-nowrap px-3 py-3 font-medium">状态</th>
              <th class="hidden whitespace-nowrap px-3 py-3 font-medium xl:table-cell">预估</th>
              <th class="hidden whitespace-nowrap px-3 py-3 font-medium xl:table-cell">开发开始</th>
              <th class="hidden whitespace-nowrap px-3 py-3 font-medium xl:table-cell">完成</th>
              <th class="hidden whitespace-nowrap px-3 py-3 font-medium 2xl:table-cell">更新时间</th>
              <th class="px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="row in rows"
              :key="row.item.id"
              class="cursor-pointer transition-colors hover:bg-muted/30"
              @click="openEdit(row.item)"
            >
              <td class="whitespace-nowrap px-3 py-3">
                <span class="font-mono text-xs text-muted-foreground">
                  {{ row.item.code }}
                </span>
              </td>
              <td class="px-3 py-3">
                <div
                  class="flex items-center gap-1"
                  :style="{ paddingLeft: `${row.item.depth * 16}px` }"
                >
                  <Button
                    v-if="row.hasChildren"
                    variant="ghost"
                    size="icon-xs"
                    :aria-label="collapsed.has(row.item.id) ? '展开子需求' : '折叠子需求'"
                    @click.stop="toggleCollapse(row.item.id)"
                  >
                    <ChevronRight
                      v-if="collapsed.has(row.item.id)"
                      class="size-3.5"
                    />
                    <ChevronDown v-else class="size-3.5" />
                  </Button>
                  <span v-else class="inline-block size-6" />
                  <span class="truncate font-medium">{{ row.item.title }}</span>
                </div>
              </td>
              <td class="hidden whitespace-nowrap px-3 py-3 md:table-cell">
                <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {{ getRequirementOriginLabel(row.item.origin) }}
                </span>
              </td>
              <td class="hidden whitespace-nowrap px-3 py-3 text-muted-foreground lg:table-cell">
                {{ getRequirementTypeLabel(row.item.type) }}
              </td>
              <td class="hidden whitespace-nowrap px-3 py-3 text-muted-foreground lg:table-cell">
                {{ getRequirementPriorityLabel(row.item.priority) }}
              </td>
              <td class="whitespace-nowrap px-3 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="requirementStatusClass(row.item.status)"
                >
                  {{ getRequirementStatusLabel(row.item.status) }}
                </span>
              </td>
              <td class="hidden whitespace-nowrap px-3 py-3 text-muted-foreground xl:table-cell">
                {{ row.item.estimateDays ?? "—" }}
              </td>
              <td class="hidden whitespace-nowrap px-3 py-3 text-muted-foreground xl:table-cell">
                {{ formatActualDate(row.item.devStartedAt) }}
              </td>
              <td class="hidden whitespace-nowrap px-3 py-3 text-muted-foreground xl:table-cell">
                {{ formatActualDate(row.item.devCompletedAt) }}
              </td>
              <td class="hidden whitespace-nowrap px-3 py-3 text-muted-foreground 2xl:table-cell">
                {{ formatDateTime(row.item.updatedAt) }}
              </td>
              <td class="px-3 py-3">
                <div class="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    @click.stop="openEdit(row.item)"
                  >
                    <Pencil class="size-3.5" />
                    编辑
                  </Button>
                  <Button
                    v-if="row.item.depth < 2"
                    variant="ghost"
                    size="sm"
                    @click.stop="openCreateChild(row.item)"
                  >
                    <Plus class="size-3.5" />
                    子需求
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <RequirementFormDialog
      :open="dialogOpen"
      :project="project"
      :requirement="editing"
      :parent="parentForNew"
      @close="dialogOpen = false"
      @saved="dialogOpen = false"
    />
  </section>
</template>
