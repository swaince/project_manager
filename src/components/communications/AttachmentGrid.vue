<script setup lang="ts">
import { reactive, watch } from "vue";
import {
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Trash2,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  formatFileSize,
  isImageAttachment,
  openAttachment,
  readAttachmentDataUrl,
} from "@/lib/attachments";
import type { CommunicationAttachment } from "@/types/models";

const props = withDefaults(
  defineProps<{
    attachments: CommunicationAttachment[];
    readonly?: boolean;
  }>(),
  {
    readonly: false,
  },
);

const emit = defineEmits<{
  remove: [attachment: CommunicationAttachment];
  preview: [attachment: CommunicationAttachment];
}>();

const previews = reactive<Record<string, string>>({});
const failed = reactive<Record<string, boolean>>({});
const loading = reactive<Record<string, boolean>>({});

watch(
  () => props.attachments.map((attachment) => attachment.id).join(","),
  () => {
    for (const attachment of props.attachments) {
      if (
        isImageAttachment(attachment.mimeType) &&
        !previews[attachment.id] &&
        !loading[attachment.id] &&
        !failed[attachment.id]
      ) {
        loading[attachment.id] = true;
        readAttachmentDataUrl(attachment.filePath)
          .then((url) => {
            previews[attachment.id] = url;
          })
          .catch(() => {
            failed[attachment.id] = true;
          })
          .finally(() => {
            loading[attachment.id] = false;
          });
      }
    }
  },
  { immediate: true },
);

function iconFor(attachment: CommunicationAttachment) {
  const mimeType = attachment.mimeType ?? "";
  const fileName = (attachment.fileName ?? "").toLowerCase();
  if (isImageAttachment(mimeType)) return FileImage;
  if (
    mimeType.includes("spreadsheet") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    fileName.endsWith(".csv")
  ) {
    return FileSpreadsheet;
  }
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("text")
  ) {
    return FileText;
  }
  return File;
}

function displayName(attachment: CommunicationAttachment): string {
  return attachment.fileName || "未命名附件";
}

function preview(attachment: CommunicationAttachment) {
  if (isImageAttachment(attachment.mimeType) && previews[attachment.id]) {
    emit("preview", attachment);
  } else {
    open(attachment);
  }
}

function open(attachment: CommunicationAttachment) {
  if (!attachment.filePath) return;
  void openAttachment(attachment.filePath);
}
</script>

<template>
  <div v-if="attachments.length > 0" class="grid gap-2 sm:grid-cols-2">
    <div
      v-for="attachment in attachments"
      :key="attachment.id"
      class="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-2"
    >
      <button
        class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground"
        :aria-label="`预览 ${displayName(attachment)}`"
        @click="preview(attachment)"
      >
        <img
          v-if="isImageAttachment(attachment.mimeType) && previews[attachment.id]"
          :src="previews[attachment.id]"
          :alt="displayName(attachment)"
          class="size-full object-cover"
        />
        <component
          :is="iconFor(attachment)"
          v-else
          class="size-5"
        />
      </button>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium" :title="displayName(attachment)">
          {{ displayName(attachment) }}
        </p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ formatFileSize(attachment.fileSize) }}
        </p>
      </div>

      <div class="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="打开附件"
          @click="open(attachment)"
        >
          <ExternalLink class="size-3.5" />
        </Button>
        <Button
          v-if="!readonly"
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground hover:text-destructive"
          aria-label="移除附件"
          @click="emit('remove', attachment)"
        >
          <Trash2 class="size-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
