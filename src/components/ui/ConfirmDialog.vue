<script setup lang="ts">
import AppDialog from "./AppDialog.vue";
import { Button } from "@/components/ui/button";

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    busy?: boolean;
    error?: string;
  }>(),
  {
    confirmLabel: "确认删除",
    busy: false,
    error: "",
  },
);

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <AppDialog :open="open" :title="title" @close="emit('close')">
    <p class="text-sm leading-6 text-muted-foreground">{{ message }}</p>
    <p v-if="error" class="mt-3 text-sm text-destructive">{{ error }}</p>

    <template #footer>
      <Button variant="outline" :disabled="busy" @click="emit('close')">
        取消
      </Button>
      <Button variant="destructive" :disabled="busy" @click="emit('confirm')">
        {{ busy ? "处理中…" : confirmLabel }}
      </Button>
    </template>
  </AppDialog>
</template>
