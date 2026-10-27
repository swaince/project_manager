<script setup lang="ts">
import PageHeader from "@/components/layout/PageHeader.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_LOCALE, APP_LOCALE_OPTIONS } from "@/lib/i18n";
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
        <h2 class="text-sm font-semibold">版本</h2>
        <p class="mt-1 text-sm text-muted-foreground">0.1.0</p>
      </section>
    </div>
  </section>
</template>
