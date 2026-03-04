<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const navItems = [
  { label: 'Home', route: '/' },
  { label: 'Users', route: '/users' },
  { label: 'Settings', route: '/settings' },
]
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="app-logo">VuePoint Playground</div>
      <nav class="app-nav">
        <button
          v-for="item in navItems"
          :key="item.route"
          class="nav-btn"
          :class="{ active: router.currentRoute.value.path === item.route }"
          @click="router.push(item.route)"
        >
          {{ item.label }}
        </button>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.app-layout {
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.app-logo {
  font-weight: 700;
  font-size: 18px;
  color: #4f46e5;
}

.app-nav {
  display: flex;
  gap: 4px;
}

.nav-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #555;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s;
}

.nav-btn:hover {
  background: #f0f0f0;
}

.nav-btn.active {
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 600;
}

.app-main {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
