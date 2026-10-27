<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Pencil, Plus, Trash2, Users } from "@lucide/vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
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
import { useStakeholdersStore } from "@/stores/stakeholders";
import { formatDateTime } from "@/lib/dates";
import {
  STAKEHOLDER_CONTACT_TYPE_OPTIONS,
  getStakeholderContactTypeLabel,
  type Stakeholder,
  type StakeholderContact,
  type StakeholderContactType,
  type StakeholderInput,
} from "@/types/models";

interface ContactForm {
  type: StakeholderContactType;
  value: string;
}

interface StakeholderForm {
  name: string;
  company: string;
  contacts: ContactForm[];
  notes: string;
}

const store = useStakeholdersStore();

const loading = ref(false);
const error = ref("");
const dialogOpen = ref(false);
const editing = ref<Stakeholder | null>(null);
const saving = ref(false);
const formError = ref("");
const deleteTarget = ref<Stakeholder | null>(null);
const deleting = ref(false);

const form = reactive<StakeholderForm>({
  name: "",
  company: "",
  contacts: [{ type: "phone", value: "" }],
  notes: "",
});

const deleteMessage = computed(() => {
  const stakeholder = deleteTarget.value;
  if (!stakeholder) return "";
  if (stakeholder.projectCount > 0) {
    return `确定删除干系人「${stakeholder.name}」吗？它会从 ${stakeholder.projectCount} 个项目的干系人列表中移除。此操作不可撤销。`;
  }
  return `确定删除干系人「${stakeholder.name}」吗？此操作不可撤销。`;
});

onMounted(load);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    await store.fetchAll();
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  resetForm();
  formError.value = "";
  dialogOpen.value = true;
}

function openEdit(stakeholder: Stakeholder) {
  editing.value = stakeholder;
  form.name = stakeholder.name;
  form.company = stakeholder.company ?? "";
  form.contacts =
    stakeholder.contacts.length > 0
      ? stakeholder.contacts.map((contact) => ({
          type: contact.type,
          value: contact.value,
        }))
      : [{ type: "phone", value: "" }];
  form.notes = stakeholder.notes;
  formError.value = "";
  dialogOpen.value = true;
}

function resetForm() {
  form.name = "";
  form.company = "";
  form.contacts = [{ type: "phone", value: "" }];
  form.notes = "";
}

function addContact() {
  form.contacts.push({ type: "phone", value: "" });
}

function removeContact(index: number) {
  form.contacts.splice(index, 1);
}

function contactPlaceholder(type: StakeholderContactType): string {
  switch (type) {
    case "phone":
      return "电话号码";
    case "wechat":
      return "微信号";
    case "email":
      return "邮箱地址";
    default:
      return "其他联系方式";
  }
}

function formatContacts(contacts: StakeholderContact[]): string {
  return contacts
    .map(
      (contact) =>
        `${getStakeholderContactTypeLabel(contact.type)} ${contact.value}`,
    )
    .join(" / ");
}

async function save() {
  formError.value = "";
  const name = form.name.trim();
  if (!name) {
    formError.value = "干系人名称不能为空";
    return;
  }

  saving.value = true;
  try {
    const input: StakeholderInput = {
      name,
      company: form.company.trim() || null,
      contacts: form.contacts
        .map((contact) => ({
          type: contact.type,
          value: contact.value.trim(),
        }))
        .filter((contact) => contact.value.length > 0),
      notes: form.notes.trim(),
    };

    if (editing.value) {
      await store.update(editing.value.id, input);
    } else {
      await store.create(input);
    }
    dialogOpen.value = false;
  } catch (cause) {
    formError.value = errorMessage(cause);
  } finally {
    saving.value = false;
  }
}

function askDelete(stakeholder: Stakeholder) {
  deleteTarget.value = stakeholder;
}

async function confirmDelete() {
  const stakeholder = deleteTarget.value;
  if (!stakeholder) return;

  deleting.value = true;
  error.value = "";
  try {
    await store.remove(stakeholder.id);
    deleteTarget.value = null;
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    deleting.value = false;
  }
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
</script>

<template>
  <section class="space-y-6 p-6 lg:p-8">
    <PageHeader title="干系人" description="记录客户方参与项目的人和公司；角色在项目里填写。">
      <Button @click="openCreate">
        <Plus class="size-4" />
        新建干系人
      </Button>
    </PageHeader>

    <div
      v-if="error"
      class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div
      v-if="loading"
      class="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"
    >
      加载中…
    </div>

    <div
      v-else-if="store.items.length === 0"
      class="rounded-xl border border-dashed border-border p-10 text-center"
    >
      <Users class="mx-auto size-8 text-muted-foreground" />
      <p class="mt-3 text-sm font-medium">暂无干系人</p>
      <p class="mt-1 text-sm text-muted-foreground">
        还没有干系人。先记录客户方参与项目的人，再在项目里关联。
      </p>
      <Button variant="outline" class="mt-4" @click="openCreate">
        <Plus class="size-4" />
        新建干系人
      </Button>
    </div>

    <div
      v-else
      class="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"
          >
            <tr>
              <th class="px-4 py-3 font-medium">干系人</th>
              <th class="hidden px-4 py-3 font-medium lg:table-cell">联系方式</th>
              <th class="px-4 py-3 font-medium">项目</th>
              <th class="hidden px-4 py-3 font-medium lg:table-cell">更新时间</th>
              <th class="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="stakeholder in store.items"
              :key="stakeholder.id"
              class="transition-colors hover:bg-muted/30"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
                  >
                    <Users class="size-4" />
                  </div>
                  <div class="min-w-0">
                    <p class="truncate font-medium">{{ stakeholder.name }}</p>
                    <p
                      v-if="stakeholder.company"
                      class="mt-0.5 truncate text-xs text-muted-foreground"
                    >
                      {{ stakeholder.company }}
                    </p>
                    <p
                      v-else-if="stakeholder.notes"
                      class="mt-0.5 line-clamp-1 text-xs text-muted-foreground"
                    >
                      {{ stakeholder.notes }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                <span
                  v-if="stakeholder.contacts.length > 0"
                  class="line-clamp-2"
                  :title="formatContacts(stakeholder.contacts)"
                >
                  {{ formatContacts(stakeholder.contacts) }}
                </span>
                <span v-else>—</span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                >
                  {{ stakeholder.projectCount }} 个
                </span>
              </td>
              <td class="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                {{ formatDateTime(stakeholder.updatedAt) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="openEdit(stakeholder)"
                  >
                    <Pencil class="size-3.5" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    @click="askDelete(stakeholder)"
                  >
                    <Trash2 class="size-3.5" />
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppDialog
      :open="dialogOpen"
      :title="editing ? '编辑干系人' : '新建干系人'"
      :description="
        editing
          ? '修改干系人信息。'
          : '记录客户项目中参与决策、对接或验收的人或组织。只填名称也可以，其他信息随时补充。'
      "
      @close="dialogOpen = false"
    >
      <div class="space-y-4">
        <FormField label="公司">
          <Input v-model="form.company" placeholder="例如：某公司" />
        </FormField>

        <FormField label="姓名 / 名称" required>
          <Input
            v-model="form.name"
            placeholder="例如：张经理 / 李工 / 某公司"
          />
        </FormField>

        <FormField label="联系方式">
          <div class="space-y-2">
            <div
              v-for="(contact, index) in form.contacts"
              :key="index"
              class="flex items-start gap-2"
            >
              <Select
                :model-value="contact.type"
                @update:model-value="
                  (value) => (contact.type = value as StakeholderContactType)
                "
              >
                <SelectTrigger class="w-24" aria-label="联系方式类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="type in STAKEHOLDER_CONTACT_TYPE_OPTIONS"
                    :key="type.value"
                    :value="type.value"
                  >
                    {{ type.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <div class="min-w-0 flex-1">
                <Input
                  v-model="contact.value"
                  :placeholder="contactPlaceholder(contact.type)"
                  aria-label="联系方式"
                />
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label="删除联系方式"
                @click="removeContact(index)"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>

            <Button variant="ghost" size="sm" @click="addContact">
              <Plus class="size-3.5" />
              添加联系方式
            </Button>

            <p
              v-if="form.contacts.length === 0"
              class="text-xs text-muted-foreground"
            >
              还没有联系方式，点击“添加联系方式”补充。
            </p>
          </div>
        </FormField>

        <FormField label="备注">
          <Textarea
            v-model="form.notes"
            class="min-h-24"
            placeholder="沟通偏好、关注点、合作背景等（可选）"
          />
        </FormField>

        <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
      </div>

      <template #footer>
        <Button variant="outline" :disabled="saving" @click="dialogOpen = false">
          取消
        </Button>
        <Button :disabled="saving" @click="save">
          {{ saving ? "保存中…" : editing ? "保存" : "创建" }}
        </Button>
      </template>
    </AppDialog>

    <ConfirmDialog
      :open="deleteTarget !== null"
      title="删除干系人"
      :message="deleteMessage"
      :busy="deleting"
      @close="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
