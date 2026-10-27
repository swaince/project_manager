<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { FolderKanban, Plus } from "@lucide/vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import { Button } from "@/components/ui/button";
import { useStakeholdersStore } from "@/stores/stakeholders";
import { useProjectsStore } from "@/stores/projects";
import { formatDateOnly } from "@/lib/dates";
import { projectStatusClass } from "@/lib/ui";
import { getProjectStatusLabel } from "@/types/models";

const stakeholderStore = useStakeholdersStore();
const projectsStore = useProjectsStore();

const loading = ref(true);
const error = ref("");

const stats = computed(() => [
  { label: "项目总数", value: projectsStore.items.length },
  {
    label: "进行中项目",
    value: projectsStore.items.filter((project) => project.status === "active")
      .length,
  },
  { label: "干系人数", value: stakeholderStore.items.length },
  {
    label: "已交付项目",
    value: projectsStore.items.filter(
      (project) => project.status === "delivered",
    ).length,
  },
]);

const recentProjects = computed(() => projectsStore.items.slice(0, 5));

onMounted(async () => {
  try {
    await Promise.all([stakeholderStore.fetchAll(), projectsStore.fetchAll()]);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="space-y-6 p-6 lg:p-8">
    <PageHeader
      title="工作台"
      description="跨项目汇总项目、干系人和最近动态。"
    >
      <Button as-child variant="outline">
        <RouterLink to="/projects">
          <Plus class="size-4" />
          新建项目
        </RouterLink>
      </Button>
    </PageHeader>

    <div
      v-if="error"
      class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-xl border border-border bg-card p-5 text-card-foreground"
      >
        <p class="text-sm text-muted-foreground">{{ stat.label }}</p>
        <p class="mt-2 text-3xl font-semibold tabular-nums">{{ stat.value }}</p>
      </div>
    </div>

    <div
      v-if="loading"
      class="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"
    >
      加载中…
    </div>

    <div
      v-else-if="recentProjects.length === 0"
      class="rounded-xl border border-dashed border-border p-10 text-center"
    >
      <FolderKanban class="mx-auto size-8 text-muted-foreground" />
      <p class="mt-3 text-sm font-medium">还没有项目</p>
      <p class="mt-1 text-sm text-muted-foreground">
        先创建干系人，再创建项目并关联干系人。
      </p>
      <Button as-child variant="outline" class="mt-4">
        <RouterLink to="/projects">
          <Plus class="size-4" />
          去创建项目
        </RouterLink>
      </Button>
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-border bg-card">
      <div
        class="flex items-center justify-between border-b border-border px-4 py-3"
      >
        <h2 class="text-sm font-semibold">最近项目</h2>
        <RouterLink
          to="/projects"
          class="text-sm text-primary underline-offset-4 hover:underline"
        >
          查看全部
        </RouterLink>
      </div>
      <ul class="divide-y divide-border">
        <li
          v-for="project in recentProjects"
          :key="project.id"
          class="flex items-center gap-4 px-4 py-3"
        >
          <span
            class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
          >
            {{ project.code }}
          </span>
          <div class="min-w-0 flex-1">
            <RouterLink
              :to="`/projects/${project.id}`"
              class="block truncate text-sm font-medium hover:underline"
            >
              {{ project.name }}
            </RouterLink>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {{
                project.stakeholders.length > 0
                  ? project.stakeholders.map((stakeholder) => stakeholder.name).join("、")
                  : "未指定干系人"
              }}
            </p>
          </div>
          <span
            class="hidden items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex"
            :class="projectStatusClass(project.status)"
          >
            <span class="size-1.5 rounded-full bg-current opacity-70" />
            {{ getProjectStatusLabel(project.status) }}
          </span>
          <span class="hidden text-xs text-muted-foreground md:block">
            {{ formatDateOnly(project.targetDate) }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>
