<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import FormField from "@/components/ui/FormField.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createManualSourceRequirement } from "@/db/sourceRequirements";

const props = defineProps<{
  open: boolean;
  projectId: string;
}>();

const emit = defineEmits<{ close: []; saved: [] }>();

const form = reactive({
  moduleName: "",
  title: "",
  description: "",
});
const saving = ref(false);
const error = ref("");

watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
  { immediate: true },
);

function reset() {
  form.moduleName = "";
  form.title = "";
  form.description = "";
  error.value = "";
  saving.value = false;
}

async function save() {
  error.value = "";
  if (!form.title.trim()) {
    error.value = "原始需求标题不能为空";
    return;
  }
  saving.value = true;
  try {
    await createManualSourceRequirement(props.projectId, {
      moduleName: form.moduleName,
      title: form.title,
      description: form.description,
    });
    emit("saved");
    emit("close");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppDialog
    :open="open"
    title="新建原始需求"
    description="手工录入的原始需求会归入“手工录入原始需求”来源文件，不会修改已导入的 Excel 基线。"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <FormField label="模块" hint="可选，例如：数据同步、运行监控">
        <Input v-model="form.moduleName" placeholder="所属模块" />
      </FormField>

      <FormField label="原始需求标题" required>
        <Input v-model="form.title" placeholder="一句话描述合同范围里的要求" />
      </FormField>

      <FormField label="原始描述">
        <Textarea
          v-model="form.description"
          class="min-h-28"
          placeholder="客户原始要求、合同条款或口头确认的范围"
        />
      </FormField>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>

    <template #footer>
      <Button variant="outline" :disabled="saving" @click="emit('close')">
        取消
      </Button>
      <Button :disabled="saving" @click="save">
        {{ saving ? "保存中…" : "创建" }}
      </Button>
    </template>
  </AppDialog>
</template>
