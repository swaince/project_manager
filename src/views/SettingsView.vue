<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import PageHeader from "@/components/layout/PageHeader.vue";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_LOCALE, APP_LOCALE_OPTIONS } from "@/lib/i18n";

const version = ref("");
const isDev = import.meta.env.DEV;
const checking = ref(false);
const installing = ref(false);
const update = ref<Update | null>(null);
const upToDate = ref(false);
const updateError = ref("");

onMounted(async () => {
  try {
    version.value = await getVersion();
  } catch {
    version.value = "未知";
  }
});

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

async function checkUpdate() {
  checking.value = true;
  updateError.value = "";
  upToDate.value = false;
  try {
    const result = await check();
    update.value = result;
    upToDate.value = result === null;
  } catch (cause) {
    update.value = null;
    updateError.value = `检查更新失败：${messageOf(cause)}`;
  } finally {
    checking.value = false;
  }
}

async function installUpdate() {
  if (!update.value) return;
  installing.value = true;
  updateError.value = "";
  try {
    await update.value.downloadAndInstall();
    await relaunch();
  } catch (cause) {
    updateError.value = `安装更新失败：${messageOf(cause)}`;
    installing.value = false;
  }
}
</script>

<template>
  <section class="space-y-6 p-6 lg:p-8">
    <PageHeader
      title="设置"
      description="数据目录、备份、主题、语言和版本信息。"
    />

    <div class="grid gap-4">
      <section class="rounded-xl border border-border bg-card p-5">
        <h2 class="text-sm font-semibold">数据</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          SQLite 数据库：project_manager.db（位于应用数据目录）。
        </p>
      </section>

      <section class="rounded-xl border border-border bg-card p-5">
        <h2 class="text-sm font-semibold">语言与区域</h2>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <span class="text-sm text-muted-foreground">界面语言</span>
          <Select :model-value="APP_LOCALE">
            <SelectTrigger class="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in APP_LOCALE_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          日期、月份、表单提示和导出格式均按简体中文（zh-CN）显示。当前版本仅提供中文。
        </p>
      </section>

      <section class="rounded-xl border border-border bg-card p-5">
        <h2 class="text-sm font-semibold">外观</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          浅色 / 深色 / 跟随系统（主题切换待接入）。
        </p>
      </section>

      <section class="rounded-xl border border-border bg-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">版本与更新</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              当前版本 {{ version || "读取中…" }}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="checking || installing || isDev"
            @click="checkUpdate"
          >
            {{ checking ? "检查中…" : "检查更新" }}
          </Button>
        </div>

        <p v-if="isDev" class="mt-2 text-xs text-muted-foreground">
          开发模式下不检查更新，请使用打包后的应用验证。
        </p>

        <div
          v-if="update"
          class="mt-3 rounded-md border border-border bg-muted/30 p-3"
        >
          <p class="text-sm font-medium">发现新版本 {{ update.version }}</p>
          <p
            v-if="update.body"
            class="mt-1 whitespace-pre-wrap text-xs text-muted-foreground"
          >
            {{ update.body }}
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" :disabled="installing" @click="installUpdate">
              {{ installing ? "下载安装中…" : "下载并安装" }}
            </Button>
            <span v-if="installing" class="text-xs text-muted-foreground">
              安装完成后应用会自动重启。
            </span>
          </div>
        </div>

        <p
          v-else-if="upToDate"
          class="mt-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          已是最新版本。
        </p>

        <p v-if="updateError" class="mt-3 text-sm text-destructive">
          {{ updateError }}
        </p>
      </section>
    </div>
  </section>
</template>
