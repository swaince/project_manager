import { defineStore } from "pinia";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "@/db/projects";
import type { Project, ProjectInput } from "@/types/models";

export const useProjectsStore = defineStore("projects", {
  state: () => ({
    items: [] as Project[],
    loading: false,
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.items = await listProjects();
      } finally {
        this.loading = false;
      }
    },
    async create(input: ProjectInput) {
      const project = await createProject(input);
      this.items = [project, ...this.items];
      return project;
    },
    async update(id: string, input: ProjectInput) {
      const project = await updateProject(id, input);
      this.items = this.items.map((item) =>
        item.id === id ? project : item,
      );
      return project;
    },
    async remove(id: string) {
      await deleteProject(id);
      this.items = this.items.filter((item) => item.id !== id);
    },
  },
});
