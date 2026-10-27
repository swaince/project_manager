<script setup lang="ts">
import { computed } from "vue";
import { Check, ChevronsUpDown } from "@lucide/vue";
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
import type { Stakeholder } from "@/types/models";

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    stakeholders: Stakeholder[];
    placeholder?: string;
  }>(),
  {
    placeholder: "搜索姓名、公司后选择",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const selectedIds = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit("update:modelValue", (value ?? []) as string[]);
  },
});

function itemText(stakeholder: Stakeholder): string {
  return [stakeholder.name, stakeholder.company].filter(Boolean).join(" ");
}
</script>

<template>
  <Combobox
    v-model="selectedIds"
    multiple
    open-on-click
    open-on-focus
    :reset-search-term-on-select="false"
  >
    <ComboboxAnchor class="relative">
      <ComboboxInput :placeholder="placeholder" class="pr-8" />
      <ComboboxTrigger
        class="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="展开干系人列表"
      >
        <ChevronsUpDown class="size-4" />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxList class="min-w-80">
      <ComboboxViewport>
        <ComboboxEmpty>没有匹配的干系人</ComboboxEmpty>
        <ComboboxGroup>
          <ComboboxItem
            v-for="stakeholder in stakeholders"
            :key="stakeholder.id"
            :value="stakeholder.id"
            :text-value="itemText(stakeholder)"
            class="cursor-pointer"
          >
            <div class="flex min-w-0 flex-col">
              <span class="truncate font-medium">{{ stakeholder.name }}</span>
              <span
                v-if="stakeholder.company"
                class="truncate text-xs text-muted-foreground"
              >
                {{ stakeholder.company }}
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
</template>
