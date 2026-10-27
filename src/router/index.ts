import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "dashboard",
      component: () => import("@/views/DashboardView.vue"),
      meta: { title: "工作台" },
    },
    {
      path: "/projects",
      name: "projects",
      component: () => import("@/views/ProjectsView.vue"),
      meta: { title: "项目" },
    },
    {
      path: "/projects/:projectId/communications/:communicationId",
      name: "communication-editor",
      component: () => import("@/views/CommunicationEditorView.vue"),
      props: true,
      meta: { title: "沟通记录" },
    },
    {
      path: "/projects/:id",
      name: "project-detail",
      component: () => import("@/views/ProjectDetailView.vue"),
      props: true,
      meta: { title: "项目详情" },
    },
    {
      path: "/stakeholders",
      name: "stakeholders",
      component: () => import("@/views/StakeholdersView.vue"),
      meta: { title: "干系人" },
    },
    {
      path: "/clients",
      redirect: "/stakeholders",
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("@/views/SettingsView.vue"),
      meta: { title: "设置" },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("@/views/NotFoundView.vue"),
      meta: { title: "页面不存在" },
    },
  ],
});

router.afterEach((to) => {
  const title = to.meta.title;
  document.title = typeof title === "string" ? `${title} · 项目管理` : "项目管理";
});

export default router;
