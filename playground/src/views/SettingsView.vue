<script setup lang="ts">
import { ref } from 'vue'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Select from 'primevue/select'

defineOptions({ name: 'SettingsView' })

const appName = ref('My App')
const notifications = ref(true)
const darkMode = ref(false)
const language = ref('en')
const languages = ref([
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
])

function handleSave() {
  alert('Settings saved (playground demo)')
}
</script>

<template>
  <div class="settings-view">
    <h2>Settings</h2>

    <div class="settings-section">
      <h3>General</h3>
      <div class="setting-row">
        <label>Application Name</label>
        <InputText v-model="appName" />
      </div>
      <div class="setting-row">
        <label>Language</label>
        <Select v-model="language" :options="languages" option-label="label" option-value="value" />
      </div>
    </div>

    <div class="settings-section">
      <h3>Preferences</h3>
      <div class="setting-row">
        <label>Enable Notifications</label>
        <ToggleSwitch v-model="notifications" />
      </div>
      <div class="setting-row">
        <label>Dark Mode</label>
        <ToggleSwitch v-model="darkMode" />
      </div>
    </div>

    <div class="settings-footer">
      <Button label="Save Settings" icon="pi pi-check" @click="handleSave" />
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e5e5e5;
  max-width: 600px;
}

h2 {
  margin-bottom: 24px;
}

.settings-section {
  margin-bottom: 28px;
}

.settings-section h3 {
  font-size: 16px;
  color: #666;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
}

.setting-row label {
  font-weight: 500;
}

.settings-footer {
  padding-top: 16px;
  border-top: 1px solid #eee;
}
</style>
