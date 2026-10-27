<script setup lang="ts">
import { Label } from "@/components/ui/label";

withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
  }>(),
  {
    hint: "",
    error: "",
    required: false,
  },
);
</script>

<template>
  <div class="space-y-1.5">
    <Label class="flex items-center gap-1">
      {{ label }}
      <span v-if="required" class="text-destructive">*</span>
    </Label>
    <slot />
    <span v-if="error" class="block text-xs text-destructive">{{ error }}</span>
    <span v-else-if="hint" class="block text-xs text-muted-foreground">{{ hint }}</span>
  </div>
</template>
