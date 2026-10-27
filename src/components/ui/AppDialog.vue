<script setup lang="ts">
import { X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    wide?: boolean;
  }>(),
  {
    description: "",
    wide: false,
  },
);

const emit = defineEmits<{ close: [] }>();

function handleOpenChange(value: boolean) {
  if (!value) emit("close");
}
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent
      :show-close-button="false"
      :class="[
        'max-h-[90vh] overflow-y-auto',
        wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
      ]"
    >
      <DialogHeader class="flex flex-row items-start justify-between gap-4">
        <div class="min-w-0">
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription v-if="description" class="mt-1">
            {{ description }}
          </DialogDescription>
        </div>
        <DialogClose as-child>
          <Button variant="ghost" size="icon-sm" aria-label="关闭">
            <X class="size-4" />
          </Button>
        </DialogClose>
      </DialogHeader>

      <div>
        <slot />
      </div>

      <DialogFooter v-if="$slots.footer">
        <slot name="footer" />
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
