import { defineStore } from "pinia";
import { APP_LOCALE } from "@/lib/i18n";
import {
  createStakeholder,
  deleteStakeholder,
  listStakeholders,
  updateStakeholder,
} from "@/db/stakeholders";
import type { Stakeholder, StakeholderInput } from "@/types/models";

export const useStakeholdersStore = defineStore("stakeholders", {
  state: () => ({
    items: [] as Stakeholder[],
    loading: false,
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.items = await listStakeholders();
      } finally {
        this.loading = false;
      }
    },
    async create(input: StakeholderInput) {
      const stakeholder = await createStakeholder(input);
      this.items = [...this.items, stakeholder].sort((a, b) =>
        a.name.localeCompare(b.name, APP_LOCALE),
      );
      return stakeholder;
    },
    async update(id: string, input: StakeholderInput) {
      const stakeholder = await updateStakeholder(id, input);
      this.items = this.items.map((item) =>
        item.id === id ? stakeholder : item,
      );
      return stakeholder;
    },
    async remove(id: string) {
      await deleteStakeholder(id);
      this.items = this.items.filter((item) => item.id !== id);
    },
  },
});
