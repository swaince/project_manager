import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { APP_LOCALE } from "./lib/i18n";
import "./styles/index.css";

document.documentElement.lang = APP_LOCALE;

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.mount("#app");
