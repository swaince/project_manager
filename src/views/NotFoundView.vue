<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section class="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
    <p class="text-sm font-medium text-muted-foreground">404</p>
    <h1 class="text-2xl font-semibold tracking-tight">页面不存在</h1>
    <RouterLink to="/" class="text-sm text-primary underline-offset-4 hover:underline">
      返回工作台
    </RouterLink>
  </section>
</template>
