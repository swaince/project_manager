<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  FolderKanban,
  LayoutDashboard,
  PanelLeft,
  Search,
  Settings,
  Users,
} from "@lucide/vue";
import { onClickOutside, refDebounced } from "@vueuse/core";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { globalSearch, type GlobalSearchResult } from "@/db/search";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();
const search = ref("");
const searchTerm = refDebounced(search, 200);
const results = ref<GlobalSearchResult[]>([]);
const searching = ref(false);
const searchOpen = ref(false);
const searchBox = ref<HTMLElement | null>(null);
let searchSeq = 0;

watch(searchTerm, async (term) => {
  const seq = ++searchSeq;
  if (!term.trim()) {
    results.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  try {
    const items = await globalSearch(term);
    if (seq !== searchSeq) return;
    results.value = items;
    searchOpen.value = true;
  } catch {
    if (seq === searchSeq) results.value = [];
  } finally {
    if (seq === searchSeq) searching.value = false;
  }
});

watch(search, (value) => {
  if (!value.trim()) {
    results.value = [];
    searchOpen.value = false;
  }
});

watch(
  () => route.fullPath,
  () => {
    search.value = "";
    searchOpen.value = false;
  },
);

onClickOutside(searchBox, () => {
  searchOpen.value = false;
});

const searchGroups = computed(() =>
  (
    [
      { kind: "project", label: "项目" },
      { kind: "requirement", label: "开发需求" },
      { kind: "sourceRequirement", label: "原始需求" },
      { kind: "communication", label: "沟通记录" },
    ] as const
  )
    .map((group) => ({
      ...group,
      items: results.value.filter((item) => item.kind === group.kind),
    }))
    .filter((group) => group.items.length > 0),
);

function openResult(result: GlobalSearchResult) {
  const base = `/projects/${result.projectId}`;
  searchOpen.value = false;
  search.value = "";
  if (result.kind === "project") {
    router.push(base);
  } else if (result.kind === "requirement") {
    router.push(`${base}?tab=requirements`);
  } else if (result.kind === "sourceRequirement") {
    router.push(`${base}?tab=source`);
  } else {
    router.push(`${base}/communications/${result.id}`);
  }
}

const navigation = [
  { to: "/", label: "工作台", icon: LayoutDashboard },
  { to: "/projects", label: "项目", icon: FolderKanban },
  { to: "/stakeholders", label: "干系人", icon: Users },
  { to: "/settings", label: "设置", icon: Settings },
];

function isActive(to: string) {
  return to === "/"
    ? route.path === "/"
    : route.path === to || route.path.startsWith(`${to}/`);
}
</script>

<template>
  <div class="flex min-h-screen bg-background text-foreground">
    <aside
      class="fixed inset-y-0 left-0 z-20 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200"
      :class="appStore.sidebarCollapsed ? 'w-16' : 'w-[var(--app-sidebar-width)]'"
    >
      <div
        class="flex h-[var(--app-header-height)] items-center gap-3 border-b border-sidebar-border px-4"
      >
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
        >
          <FolderKanban class="size-4" />
        </div>
        <div v-if="!appStore.sidebarCollapsed" class="min-w-0">
          <p class="truncate text-sm font-semibold">项目管理</p>
          <p class="truncate text-xs text-muted-foreground">需求与交付台账</p>
        </div>
      </div>

      <nav class="flex-1 space-y-1 p-2">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          "
          :title="appStore.sidebarCollapsed ? item.label : undefined"
        >
          <component :is="item.icon" class="size-4 shrink-0" />
          <span v-if="!appStore.sidebarCollapsed">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div
      class="flex min-h-screen flex-1 flex-col transition-[padding] duration-200"
      :class="appStore.sidebarCollapsed ? 'pl-16' : 'pl-[var(--app-sidebar-width)]'"
    >
      <header
        class="sticky top-0 z-10 flex h-[var(--app-header-height)] items-center gap-3 border-b border-border bg-background/95 px-6 backdrop-blur"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="折叠侧边栏"
          @click="appStore.toggleSidebar"
        >
          <PanelLeft class="size-4" />
        </Button>

        <div ref="searchBox" class="relative w-full max-w-md">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="search"
            type="search"
            placeholder="搜索项目、需求编号、沟通主题…"
            class="pl-9"
            @focus="searchOpen = search.trim() !== ''"
            @keydown.esc="searchOpen = false"
          />
          <div
            v-if="searchOpen && search.trim()"
            class="absolute inset-x-0 top-full z-20 mt-2 max-h-[26rem] overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-lg"
          >
            <p
              v-if="searching && results.length === 0"
              class="px-3 py-2 text-xs text-muted-foreground"
            >
              搜索中…
            </p>
            <template v-else-if="searchGroups.length > 0">
              <div v-for="group in searchGroups" :key="group.kind">
                <p
                  class="px-3 pb-1 pt-2 text-[0.7rem] font-medium text-muted-foreground"
                >
                  {{ group.label }}
                </p>
                <button
                  v-for="item in group.items"
                  :key="`${item.kind}-${item.id}`"
                  type="button"
                  class="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted/60"
                  @click="openResult(item)"
                >
                  <span class="w-full truncate text-sm">{{ item.title }}</span>
                  <span
                    class="w-full truncate text-xs text-muted-foreground"
                  >
                    {{ item.code ? `${item.code} · ` : ""
                    }}{{ item.projectName }}
                  </span>
                </button>
              </div>
            </template>
            <p
              v-else-if="!searching && searchTerm.trim()"
              class="px-3 py-2 text-xs text-muted-foreground"
            >
              没有匹配结果
            </p>
          </div>
        </div>
      </header>

      <main class="flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
