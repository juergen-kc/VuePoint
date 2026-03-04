<script setup lang="ts">
import { ref } from 'vue'
import { useUsersStore, type User } from '../stores/users'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'

defineOptions({ name: 'UsersView' })

const store = useUsersStore()

const showAddDialog = ref(false)
const newUser = ref({ name: '', email: '', role: 'user' as User['role'], status: 'active' as User['status'] })

function handleAdd() {
  if (newUser.value.name && newUser.value.email) {
    store.addUser(newUser.value)
    newUser.value = { name: '', email: '', role: 'user', status: 'active' }
    showAddDialog.value = false
  }
}

function statusSeverity(status: string) {
  return status === 'active' ? 'success' : 'danger'
}

function roleSeverity(role: string) {
  if (role === 'admin') return 'warn'
  if (role === 'viewer') return 'info'
  return undefined
}
</script>

<template>
  <div class="users-view">
    <div class="users-header">
      <h2>User Management</h2>
      <div class="users-actions">
        <InputText v-model="store.search" placeholder="Search users..." />
        <Button label="Add User" icon="pi pi-plus" @click="showAddDialog = true" />
      </div>
    </div>

    <DataTable :value="store.filteredUsers" striped-rows data-testid="users-table">
      <Column field="name" header="Name" />
      <Column field="email" header="Email" />
      <Column field="role" header="Role">
        <template #body="{ data }">
          <Tag :value="data.role" :severity="roleSeverity(data.role)" />
        </template>
      </Column>
      <Column field="status" header="Status">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column header="Actions">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button
              icon="pi pi-sync"
              severity="secondary"
              text
              rounded
              @click="store.toggleStatus(data.id)"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="store.removeUser(data.id)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="showAddDialog" header="Add User" :style="{ width: '400px' }" modal>
      <div class="dialog-form">
        <label>Name</label>
        <InputText v-model="newUser.name" placeholder="Full name" class="w-full" />
        <label>Email</label>
        <InputText v-model="newUser.email" placeholder="email@example.com" class="w-full" />
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddDialog = false" />
        <Button label="Add" icon="pi pi-check" @click="handleAdd" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.users-view {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e5e5e5;
}

.users-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.users-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dialog-form label {
  font-weight: 600;
  font-size: 14px;
  margin-top: 4px;
}

.w-full {
  width: 100%;
}
</style>
