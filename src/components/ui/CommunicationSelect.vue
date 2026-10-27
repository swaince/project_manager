<script setup lang="ts">
import { computed } from "vue";
import { Check, ChevronsUpDown, X } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
  ComboboxViewport,
} from "@/components/ui/combobox";
import {
  getCommunicationStatusLabel,
  type Communication,
  type CommunicationSession,
} from "@/types/models";

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    communications: Communication[];
    placeholder?: string;
  }>(),
  {
    placeholder: "搜索沟通主题",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
}>();

const selectedId = computed({
  get: () => props.modelValue ?? "",
  set: (value) => {
    emit("update:modelValue", value || null);
  },
});

const selectedCommunication = computed(
  () =>
    props.communications.find(
      (communication) => communication.id === props.modelValue,
    ) ?? null,
);

function latestSession(
  communication: Communication,
): CommunicationSession | null {
  return communication.sessions[communication.sessions.length - 1] ?? null;
}

function itemText(communication: Communication): string {
  const session = latestSession(communication);
  return [communication.title, session?.occurredAt, session?.participants]
    .filter(Boolean)
    .join(" ");
}

function clearSelection() {
  emit("update:modelValue", null);
}
</script>

<template>
  <div class="space-y-2">
    <Combobox v-model="selectedId" open-on-click open-on-focus>
      <ComboboxAnchor class="relative">
        <ComboboxInput :placeholder="placeholder" class="pr-8" />
        <ComboboxTrigger
          class="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="展开沟通记录列表"
        >
          <ChevronsUpDown class="size-4" />
        </ComboboxTrigger>
      </ComboboxAnchor>

      <ComboboxList class="min-w-96">
        <ComboboxViewport>
          <ComboboxEmpty>
            {{
              communications.length === 0
                ? "当前项目还没有沟通记录"
                : "没有匹配的沟通记录"
            }}
          </ComboboxEmpty>
          <ComboboxGroup>
            <ComboboxItem
              v-for="communication in communications"
              :key="communication.id"
              :value="communication.id"
              :text-value="itemText(communication)"
              class="cursor-pointer"
            >
              <div class="flex min-w-0 flex-col">
                <span class="truncate font-medium">{{ communication.title }}</span>
                <span class="truncate text-xs text-muted-foreground">
                  {{ getCommunicationStatusLabel(communication.status) }}
                  <template v-if="latestSession(communication)">
                    · {{ latestSession(communication)?.occurredAt }}
                  </template>
                  <template v-if="latestSession(communication)?.participants">
                    · {{ latestSession(communication)?.participants }}
                  </template>
                </span>
              </div>
              <ComboboxItemIndicator>
                <Check class="size-4" />
              </ComboboxItemIndicator>
            </ComboboxItem>
          </ComboboxGroup>
        </ComboboxViewport>
      </ComboboxList>
    </Combobox>

    <Badge
      v-if="selectedCommunication"
      variant="secondary"
      class="gap-1 py-0.5 pr-1"
    >
      <span class="max-w-56 truncate">{{ selectedCommunication.title }}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        class="size-4 rounded-full p-0 text-muted-foreground hover:text-foreground"
        aria-label="清除沟通记录"
        @click="clearSelection"
      >
        <X class="size-3" />
      </Button>
    </Badge>
  </div>
</template>
