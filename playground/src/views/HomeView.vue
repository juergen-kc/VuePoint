<script setup lang="ts">
defineOptions({ name: 'HomeView' })
</script>

<template>
  <div class="home-view">
    <h1>Welcome to VuePoint Playground</h1>
    <p class="subtitle">
      This app demonstrates VuePoint in a realistic Vue 3 + PrimeVue environment.
      Use <kbd>Ctrl+Shift+A</kbd> to toggle the annotation toolbar.
    </p>

    <div class="cards">
      <div class="card">
        <i class="pi pi-users" />
        <h3>Users Page</h3>
        <p>DataTable with CRUD operations and a Pinia store.</p>
      </div>
      <div class="card">
        <i class="pi pi-cog" />
        <h3>Settings Page</h3>
        <p>Form components — inputs, toggles, and dialogs.</p>
      </div>
      <div class="card">
        <i class="pi pi-comment" />
        <h3>Annotate Anything</h3>
        <p>Click any element to generate structured feedback for AI agents.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  text-align: center;
  padding-top: 40px;
}

h1 {
  font-size: 28px;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  margin-bottom: 40px;
}

kbd {
  background: #eee;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  border: 1px solid #e5e5e5;
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card i {
  font-size: 32px;
  color: #4f46e5;
  margin-bottom: 12px;
}

.card h3 {
  margin-bottom: 8px;
}

.card p {
  color: #666;
  font-size: 14px;
}
</style>
