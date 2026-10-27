<script setup lang="ts">
import { computed, ref } from "vue";
import { Calendar as CalendarIcon } from "@lucide/vue";
import { CalendarDate, type DateValue } from "@internationalized/date";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { APP_LOCALE } from "@/lib/i18n";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    placeholder: "选择日期",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const open = ref(false);

const dateValue = computed<DateValue | undefined>({
  get() {
    if (!props.modelValue) return undefined;
    const [year, month, day] = props.modelValue.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new CalendarDate(year, month, day);
  },
  set(value) {
    if (!value) {
      emit("update:modelValue", "");
      return;
    }
    const month = String(value.month).padStart(2, "0");
    const day = String(value.day).padStart(2, "0");
    emit("update:modelValue", `${value.year}-${month}-${day}`);
    open.value = false;
  },
});

function clearDate() {
  emit("update:modelValue", "");
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        class="w-full justify-start font-normal"
        :class="!modelValue ? 'text-muted-foreground' : ''"
        :disabled="disabled"
      >
        <CalendarIcon class="size-4" />
        {{ modelValue || placeholder }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar v-model="dateValue" :locale="APP_LOCALE" />
      <div class="flex justify-end border-t border-border p-2">
        <Button variant="ghost" size="sm" @click="clearDate">清除</Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
