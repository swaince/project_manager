import { defineStore } from "pinia";
import {
  createRequirement,
  listRequirements,
  updateRequirement,
} from "@/db/requirements";
import type { Requirement, RequirementInput } from "@/types/models";

export const useRequirementsStore = defineStore("requirements", {
  state: () => ({
    items: [] as Requirement[],
    loading: false,
    projectId: null as string | null,
  }),
  actions: {
    async fetchAll(projectId: string) {
      this.loading = true;
      this.projectId = projectId;
      try {
        this.items = await listRequirements(projectId);
      } finally {
        this.loading = false;
      }
    },
    async create(projectId: string, input: RequirementInput) {
      const requirement = await createRequirement(projectId, input);
      if (this.projectId === projectId) {
        this.items = [...this.items, requirement];
      }
      return requirement;
    },
    async update(id: string, input: RequirementInput) {
      const requirement = await updateRequirement(id, input);
      this.items = this.items.map((item) =>
        item.id === id ? requirement : item,
      );
      return requirement;
    },
  },
});
