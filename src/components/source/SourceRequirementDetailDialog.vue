<script setup lang="ts">
import AppDialog from "@/components/ui/AppDialog.vue";
import { Button } from "@/components/ui/button";
import { requirementStatusClass } from "@/lib/ui";
import {
  getRequirementStatusLabel,
  type SourceRequirement,
} from "@/types/models";

withDefaults(
  defineProps<{
    open: boolean;
    requirement: SourceRequirement | null;
    communicationCount?: number;
  }>(),
  { communicationCount: 0 },
);

const emit = defineEmits<{
  close: [];
  communicate: [];
  refine: [];
}>();
</script>

<template>
  <AppDialog
    :open="open"
    :title="requirement?.title ?? '原始需求'"
    :description="
      requirement
        ? `${requirement.code} · ${requirement.moduleName || '未分组'}`
        : ''
    "
    wide
    @close="emit('close')"
  >
    <div v-if="requirement" class="space-y-4">
      <div class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <template v-if="requirement.documentIsManual">
          <span>录入方式：手工录入</span>
        </template>
        <template v-else>
          <span>来源文件：{{ requirement.documentTitle }}</span>
          <span v-if="requirement.documentVersion">
            版本：{{ requirement.documentVersion }}
          </span>
          <span>Excel 行号：{{ requirement.sourceRow }}</span>
        </template>
      </div>

      <div class="rounded-lg border border-border bg-muted/20 p-4">
        <p class="whitespace-pre-wrap text-sm leading-6">
          {{ requirement.description || "（原表没有描述）" }}
        </p>
      </div>

      <div class="space-y-2">
        <h3 class="text-sm font-semibold">已关联的开发需求</h3>
        <div
          v-if="requirement.linkedRequirements.length > 0"
          class="space-y-2"
        >
          <div
            v-for="linked in requirement.linkedRequirements"
            :key="linked.id"
            class="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
          >
            <span class="font-mono text-xs text-muted-foreground">
              {{ linked.code }}
            </span>
            <span class="min-w-0 flex-1 truncate text-sm">{{ linked.title }}</span>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="requirementStatusClass(linked.status)"
            >
              {{ getRequirementStatusLabel(linked.status) }}
            </span>
          </div>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          还没有细化出开发需求。可以新建一条沟通记录，或直接创建开发需求。
        </p>
      </div>

      <p class="text-xs text-muted-foreground">
        <template v-if="requirement.documentIsManual">
          手工录入的原始需求已锁定；调整合同范围请通过后续的变更记录处理。
        </template>
        <template v-else>
          原始需求来自导入文件，已锁定；调整合同范围请通过后续的变更记录处理。
        </template>
      </p>
    </div>

    <template #footer>
      <Button variant="outline" @click="emit('close')">关闭</Button>
      <Button variant="outline" @click="emit('communicate')">
        {{ communicationCount > 0 ? "继续沟通" : "新建沟通记录" }}
      </Button>
      <Button @click="emit('refine')">细化开发需求</Button>
    </template>
  </AppDialog>
</template>
