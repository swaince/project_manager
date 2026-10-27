<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ArrowLeft } from "@lucide/vue";
import CommunicationsPanel from "@/components/communications/CommunicationsPanel.vue";
import RequirementsPanel from "@/components/requirements/RequirementsPanel.vue";
import SourceRequirementsPanel from "@/components/source/SourceRequirementsPanel.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProject } from "@/db/projects";
import { formatDateOnly, formatDateTime } from "@/lib/dates";
import { projectStatusClass } from "@/lib/ui";
import { getProjectStatusLabel, type Project } from "@/types/models";

const props = defineProps<{ id: string }>();
const route = useRoute();

const project = ref<Project | null>(null);
const loading = ref(true);
const error = ref("");
const requestedTab = route.query.tab;
const activeTab = ref<
  "overview" | "source" | "requirements" | "communications"
>(
  requestedTab === "communications" ||
    requestedTab === "requirements" ||
    requestedTab === "source" ||
    requestedTab === "overview"
    ? requestedTab
    : "source",
);

watch(
  () => route.query.tab,
  (tab) => {
    if (
      tab === "communications" ||
      tab === "requirements" ||
      tab === "source" ||
      tab === "overview"
    ) {
      activeTab.value = tab;
    }
  },
);

onMounted(load);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    project.value = await getProject(props.id);
    if (!project.value) error.value = "项目不存在或已被删除";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="space-y-6 p-6 lg:p-8">
    <Button variant="ghost" size="sm" as-child class="-ml-2 w-fit">
      <RouterLink to="/projects">
        <ArrowLeft class="size-4" />
        返回项目
      </RouterLink>
    </Button>

    <div
      v-if="loading"
      class="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"
    >
      加载中…
    </div>

    <div
      v-else-if="error || !project"
      class="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive"
    >
      {{ error || "项目不存在" }}
    </div>

    <template v-else>
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <span
              class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {{ project.code }}
            </span>
            <h1 class="text-2xl font-semibold tracking-tight">
              {{ project.name }}
            </h1>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="projectStatusClass(project.status)"
            >
              {{ getProjectStatusLabel(project.status) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground">
            <span v-if="project.stakeholders.length > 0">
              干系人：
              {{
                project.stakeholders
                  .map((stakeholder) =>
                    stakeholder.role
                      ? `${stakeholder.name}（${stakeholder.role}）`
                      : stakeholder.name,
                  )
                  .join("、")
              }}
            </span>
            <span v-else>暂未关联干系人</span>
          </p>
        </div>

        <div class="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          <Button
            :variant="activeTab === 'overview' ? 'secondary' : 'ghost'"
            size="sm"
            @click="activeTab = 'overview'"
          >
            概览
          </Button>
          <Button
            :variant="activeTab === 'source' ? 'secondary' : 'ghost'"
            size="sm"
            @click="activeTab = 'source'"
          >
            原始需求
          </Button>
          <Button
            :variant="activeTab === 'requirements' ? 'secondary' : 'ghost'"
            size="sm"
            @click="activeTab = 'requirements'"
          >
            开发需求
          </Button>
          <Button
            :variant="activeTab === 'communications' ? 'secondary' : 'ghost'"
            size="sm"
            @click="activeTab = 'communications'"
          >
            沟通记录
          </Button>
        </div>
      </header>

      <div v-if="activeTab === 'overview'" class="grid gap-4 lg:grid-cols-3">
        <section
          class="space-y-4 rounded-xl border border-border bg-card p-5 lg:col-span-2"
        >
          <h2 class="text-sm font-semibold">项目信息</h2>
          <p
            v-if="project.description"
            class="whitespace-pre-wrap text-sm text-muted-foreground"
          >
            {{ project.description }}
          </p>
          <p v-else class="text-sm text-muted-foreground">暂无项目描述。</p>

          <dl class="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-muted-foreground">项目代号</dt>
              <dd class="mt-0.5 font-mono">{{ project.code }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">状态</dt>
              <dd class="mt-0.5">{{ getProjectStatusLabel(project.status) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">开始日期</dt>
              <dd class="mt-0.5">{{ formatDateOnly(project.startDate) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">目标日期</dt>
              <dd class="mt-0.5">{{ formatDateOnly(project.targetDate) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">创建时间</dt>
              <dd class="mt-0.5">{{ formatDateTime(project.createdAt) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">更新时间</dt>
              <dd class="mt-0.5">{{ formatDateTime(project.updatedAt) }}</dd>
            </div>
          </dl>
        </section>

        <section class="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 class="text-sm font-semibold">干系人与本项目角色</h2>
          <div v-if="project.stakeholders.length > 0" class="space-y-2">
            <div
              v-for="stakeholder in project.stakeholders"
              :key="stakeholder.id"
              class="rounded-md border border-border p-3"
            >
              <p class="text-sm font-medium">{{ stakeholder.name }}</p>
              <p
                v-if="stakeholder.company"
                class="mt-0.5 text-xs text-muted-foreground"
              >
                {{ stakeholder.company }}
              </p>
              <Badge v-if="stakeholder.role" variant="secondary" class="mt-2">
                {{ stakeholder.role }}
              </Badge>
              <span
                v-else
                class="mt-2 block text-xs text-muted-foreground"
              >
                本项目未填写角色
              </span>
            </div>
          </div>
          <p v-else class="text-sm text-muted-foreground">暂未关联干系人。</p>
        </section>
      </div>

      <SourceRequirementsPanel
        v-if="activeTab === 'source'"
        :project="project"
      />
      <RequirementsPanel
        v-else-if="activeTab === 'requirements'"
        :project="project"
      />
      <CommunicationsPanel
        v-else-if="activeTab === 'communications'"
        :project="project"
      />
    </template>
  </section>
</template>
