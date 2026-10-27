<script setup lang="ts">
import { ref } from "vue";
import {
  FolderKanban,
  LayoutDashboard,
  PanelLeft,
  Search,
  Settings,
  Users,
} from "@lucide/vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
const route = useRoute();
const search = ref("");

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

        <div class="relative w-full max-w-md">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="search"
            type="search"
            placeholder="搜索项目、需求编号…"
            class="pl-9"
          />
        </div>
      </header>

      <main class="flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
