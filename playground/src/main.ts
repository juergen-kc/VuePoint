import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { VuePoint } from '@vuepoint/vue'
import App from './App.vue'
import { router } from './router'

import 'primeicons/primeicons.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})
app.use(VuePoint, {
  shortcut: 'ctrl+shift+a',
  pinia: { enabled: true, instance: pinia },
})

app.mount('#app')
