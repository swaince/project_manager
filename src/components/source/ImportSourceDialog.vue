<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { FileSpreadsheet, Upload } from "@lucide/vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import FormField from "@/components/ui/FormField.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  chooseExcelFile,
  copySourceDocument,
  listExcelSheets,
  readExcelSheet,
  type ExcelRow,
} from "@/lib/excel";
import { createSourceDocument } from "@/db/sourceRequirements";
import type { Project, SourceRequirementInput } from "@/types/models";

const props = defineProps<{
  open: boolean;
  project: Project;
}>();

const emit = defineEmits<{ close: []; saved: [] }>();

const filePath = ref("");
const fileName = ref("");
const sheets = ref<string[]>([]);
const selectedSheet = ref("");
const rows = ref<ExcelRow[]>([]);
const moduleCol = ref(1);
const itemCol = ref(2);
const descriptionCol = ref(3);
const startRow = ref(1);
const title = ref("");
const version = ref("V1.0");
const note = ref("");
const loading = ref(false);
const importing = ref(false);
const error = ref("");

const hasFile = computed(() => Boolean(filePath.value));
const maxColumns = computed(() =>
  Math.max(1, ...rows.value.map((row) => row.cells.length)),
);

const columnOptions = computed(() => {
  const sampleRow =
    rows.value.find((row) => row.row >= startRow.value) ?? rows.value[0];
  return Array.from({ length: maxColumns.value }, (_, index) => {
    const sample = sampleRow?.cells[index]?.trim() ?? "";
    return {
      value: String(index),
      label: `${columnLabel(index)} 列${sample ? ` · ${sample.slice(0, 24)}` : ""}`,
    };
  });
});

const mappedItems = computed<SourceRequirementInput[]>(() => {
  const items: SourceRequirementInput[] = [];
  let currentModule = "";
  for (const row of rows.value) {
    if (row.row < startRow.value) continue;
    const moduleName = cell(row, moduleCol.value);
    if (moduleName) currentModule = moduleName;
    const itemTitle = cell(row, itemCol.value);
    const description = cell(row, descriptionCol.value);
    if (!itemTitle && !description) continue;
    items.push({
      moduleName: currentModule || "未分组",
      title: itemTitle || description.slice(0, 40) || "未命名原始需求",
      description,
      sourceRow: row.row,
    });
  }
  return items;
});

const previewItems = computed(() => mappedItems.value.slice(0, 12));
const moduleCount = computed(
  () => new Set(mappedItems.value.map((item) => item.moduleName)).size,
);

watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
  { immediate: true },
);

function reset() {
  filePath.value = "";
  fileName.value = "";
  sheets.value = [];
  selectedSheet.value = "";
  rows.value = [];
  moduleCol.value = 1;
  itemCol.value = 2;
  descriptionCol.value = 3;
  startRow.value = 1;
  title.value = "";
  version.value = "V1.0";
  note.value = "";
  error.value = "";
  importing.value = false;
  loading.value = false;
}

function columnLabel(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return `第 ${index + 1}`;
}

function cell(row: ExcelRow, index: number): string {
  return (row.cells[index] ?? "").trim();
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "原始需求";
}

async function selectFile() {
  error.value = "";
  try {
    const selected = await chooseExcelFile();
    if (!selected) return;
    filePath.value = selected;
    fileName.value = baseName(selected);
    title.value = fileName.value.replace(/\.[^.]+$/, "");
    loading.value = true;
    sheets.value = await listExcelSheets(selected);
    if (sheets.value.length === 0) {
      throw new Error("Excel 中没有可读取的工作表");
    }
    selectedSheet.value = sheets.value[0];
    await loadSheet();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

async function loadSheet() {
  if (!filePath.value || !selectedSheet.value) return;
  error.value = "";
  loading.value = true;
  try {
    const data = await readExcelSheet(filePath.value, selectedSheet.value);
    rows.value = data.rows;
    autoDetect();
    if (rows.value.length === 0) error.value = "这个工作表没有可读取的数据";
  } catch (cause) {
    rows.value = [];
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

function onSheetChange(value: unknown) {
  if (value == null) return;
  selectedSheet.value = String(value);
  return loadSheet();
}

function autoDetect() {
  const width = Math.max(1, ...rows.value.map((row) => row.cells.length));
  moduleCol.value = width >= 4 ? 1 : 0;
  itemCol.value = width >= 4 ? 2 : Math.min(1, width - 1);
  descriptionCol.value = width >= 4 ? 3 : Math.min(2, width - 1);

  const headerWords = new Set([
    "模块",
    "子项",
    "功能",
    "功能名称",
    "需求",
    "需求名称",
    "描述",
    "说明",
  ]);
  const firstDataRow = rows.value.find((row) => {
    if (row.row < 2) return false;
    const item = cell(row, itemCol.value);
    const description = cell(row, descriptionCol.value);
    if (!item && !description) return false;
    return !headerWords.has(item) && !headerWords.has(description);
  });
  startRow.value = firstDataRow?.row ?? 1;
}

async function importDocument() {
  error.value = "";
  if (!filePath.value) {
    error.value = "请先选择 Excel 文件";
    return;
  }
  if (mappedItems.value.length === 0) {
    error.value = "没有识别到可导入的原始需求，请调整列映射或起始行";
    return;
  }

  importing.value = true;
  try {
    const storedPath = await copySourceDocument(props.project.id, filePath.value);
    await createSourceDocument(props.project.id, {
      title: title.value.trim() || fileName.value,
      version: version.value.trim(),
      fileName: fileName.value,
      filePath: storedPath,
      sheetName: selectedSheet.value,
      note: note.value.trim(),
      items: mappedItems.value,
    });
    emit("saved");
    emit("close");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <AppDialog
    :open="open"
    title="导入原始需求"
    description="从 Excel 建立合同范围基线。导入后原始需求会锁定，后续调整通过变更记录处理。"
    wide
    @close="emit('close')"
  >
    <div class="space-y-5">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="outline" :disabled="loading || importing" @click="selectFile">
          <FileSpreadsheet class="size-4" />
          选择 Excel 文件
        </Button>
        <span v-if="fileName" class="min-w-0 truncate text-sm text-muted-foreground">
          {{ fileName }}
        </span>
        <span v-else class="text-sm text-muted-foreground">
          支持 .xlsx / .xls / .ods
        </span>
      </div>

      <div v-if="hasFile" class="grid gap-4 sm:grid-cols-2">
        <FormField label="工作表">
          <Select
            :model-value="selectedSheet"
            @update:model-value="onSheetChange"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="sheet in sheets"
                :key="sheet"
                :value="sheet"
              >
                {{ sheet }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="起始行" hint="标题行或表头上一行可以跳过">
          <Input
            :model-value="String(startRow)"
            type="number"
            min="1"
            @update:model-value="(value) => (startRow = Number(value) || 1)"
          />
        </FormField>
      </div>

      <div v-if="rows.length > 0" class="grid gap-4 sm:grid-cols-3">
        <FormField label="模块列">
          <Select
            :model-value="String(moduleCol)"
            @update:model-value="(value) => (moduleCol = Number(value))"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in columnOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="子项/需求列">
          <Select
            :model-value="String(itemCol)"
            @update:model-value="(value) => (itemCol = Number(value))"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in columnOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="描述列">
          <Select
            :model-value="String(descriptionCol)"
            @update:model-value="(value) => (descriptionCol = Number(value))"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in columnOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div v-if="hasFile" class="grid gap-4 sm:grid-cols-2">
        <FormField label="来源文件标题" required>
          <Input v-model="title" placeholder="例如：客户原始需求清单" />
        </FormField>
        <FormField label="版本">
          <Input v-model="version" placeholder="例如：V1.0" />
        </FormField>
      </div>

      <FormField label="备注">
        <Textarea
          v-model="note"
          class="min-h-16"
          placeholder="例如：招标合同附件、客户提供的初始范围"
        />
      </FormField>

      <div
        v-if="rows.length > 0"
        class="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-medium">
            将导入 {{ mappedItems.length }} 条原始需求，{{ moduleCount }} 个模块
          </p>
          <span class="text-xs text-muted-foreground">
            预览前 {{ previewItems.length }} 条
          </span>
        </div>

        <div class="max-h-64 overflow-auto rounded-md border border-border bg-card">
          <table class="w-full text-left text-xs">
            <thead class="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-2 py-2 font-medium">行</th>
                <th class="px-2 py-2 font-medium">模块</th>
                <th class="px-2 py-2 font-medium">子项</th>
                <th class="px-2 py-2 font-medium">描述</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="item in previewItems" :key="`${item.sourceRow}-${item.title}`">
                <td class="whitespace-nowrap px-2 py-2 text-muted-foreground">
                  {{ item.sourceRow }}
                </td>
                <td class="px-2 py-2">{{ item.moduleName }}</td>
                <td class="px-2 py-2 font-medium">{{ item.title }}</td>
                <td class="max-w-md px-2 py-2 text-muted-foreground">
                  <span class="line-clamp-2">{{ item.description }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="loading" class="text-sm text-muted-foreground">正在读取 Excel…</p>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>

    <template #footer>
      <Button variant="outline" :disabled="importing" @click="emit('close')">
        取消
      </Button>
      <Button
        :disabled="importing || loading || !hasFile || mappedItems.length === 0"
        @click="importDocument"
      >
        <Upload class="size-4" />
        {{ importing ? "导入中…" : "导入原始需求" }}
      </Button>
    </template>
  </AppDialog>
</template>
