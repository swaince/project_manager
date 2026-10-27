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
import type { SourceRequirement } from "@/types/models";

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    requirements: SourceRequirement[];
    placeholder?: string;
  }>(),
  {
    placeholder: "搜索原始需求编号、模块或名称",
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

const requirementById = computed(
  () => new Map(props.requirements.map((item) => [item.id, item])),
);

const selectedRequirements = computed(() =>
  props.modelValue
    .map((id) => requirementById.value.get(id))
    .filter((item): item is SourceRequirement => Boolean(item)),
);

function itemText(requirement: SourceRequirement): string {
  return [requirement.code, requirement.moduleName, requirement.title]
    .filter(Boolean)
    .join(" ");
}

function removeRequirement(id: string) {
  emit(
    "update:modelValue",
    props.modelValue.filter((value) => value !== id),
  );
}
</script>

<template>
  <div class="space-y-2">
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
          aria-label="展开原始需求列表"
        >
          <ChevronsUpDown class="size-4" />
        </ComboboxTrigger>
      </ComboboxAnchor>

      <ComboboxList class="min-w-96">
        <ComboboxViewport>
          <ComboboxEmpty>
            {{
              requirements.length === 0
                ? "当前项目还没有原始需求，请先导入 Excel"
                : "没有匹配的原始需求"
            }}
          </ComboboxEmpty>
          <ComboboxGroup>
            <ComboboxItem
              v-for="requirement in requirements"
              :key="requirement.id"
              :value="requirement.id"
              :text-value="itemText(requirement)"
              class="cursor-pointer"
            >
              <div class="flex min-w-0 flex-col">
                <span class="truncate font-mono text-xs text-muted-foreground">
                  {{ requirement.code }}
                </span>
                <span class="truncate">{{ requirement.title }}</span>
                <span
                  v-if="requirement.moduleName"
                  class="truncate text-xs text-muted-foreground"
                >
                  {{ requirement.moduleName }}
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

    <div v-if="selectedRequirements.length > 0" class="flex flex-wrap gap-1.5">
      <Badge
        v-for="requirement in selectedRequirements"
        :key="requirement.id"
        variant="secondary"
        class="gap-1 py-0.5 pr-1"
      >
        <span class="font-mono text-[0.7rem]">{{ requirement.code }}</span>
        <span class="max-w-44 truncate">{{ requirement.title }}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          class="size-4 rounded-full p-0 text-muted-foreground hover:text-foreground"
          :aria-label="`移除 ${requirement.code}`"
          @click="removeRequirement(requirement.id)"
        >
          <X class="size-3" />
        </Button>
      </Badge>
    </div>
  </div>
</template>
