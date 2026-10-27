import { defineStore } from "pinia";
import { listCommunications } from "@/db/communications";
import type { Communication } from "@/types/models";

export const useCommunicationsStore = defineStore("communications", {
  state: () => ({
    items: [] as Communication[],
    loading: false,
    projectId: null as string | null,
  }),

  actions: {
    async fetchAll(projectId: string) {
      this.loading = true;
      this.projectId = projectId;
      try {
        this.items = await listCommunications(projectId);
      } finally {
        this.loading = false;
      }
    },
  },
});
