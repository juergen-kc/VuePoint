import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user' | 'viewer'
  status: 'active' | 'inactive'
}

const SAMPLE_USERS: User[] = [
  { id: 1, name: 'Alice Chen', email: 'alice@jumpcloud.com', role: 'admin', status: 'active' },
  { id: 2, name: 'Bob Martinez', email: 'bob@jumpcloud.com', role: 'user', status: 'active' },
  { id: 3, name: 'Carol Kim', email: 'carol@jumpcloud.com', role: 'user', status: 'inactive' },
  { id: 4, name: 'David Patel', email: 'david@jumpcloud.com', role: 'viewer', status: 'active' },
  { id: 5, name: 'Eve Johnson', email: 'eve@jumpcloud.com', role: 'admin', status: 'active' },
]

export const useUsersStore = defineStore('users', () => {
  const users = ref<User[]>(SAMPLE_USERS)
  const loading = ref(false)
  const search = ref('')

  const filteredUsers = computed(() => {
    if (!search.value) return users.value
    const q = search.value.toLowerCase()
    return users.value.filter(
      u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  })

  const activeCount = computed(() => users.value.filter(u => u.status === 'active').length)

  function addUser(user: Omit<User, 'id'>) {
    const id = Math.max(0, ...users.value.map(u => u.id)) + 1
    users.value.push({ ...user, id })
  }

  function removeUser(id: number) {
    users.value = users.value.filter(u => u.id !== id)
  }

  function toggleStatus(id: number) {
    const user = users.value.find(u => u.id === id)
    if (user) {
      user.status = user.status === 'active' ? 'inactive' : 'active'
    }
  }

  return { users, loading, search, filteredUsers, activeCount, addUser, removeUser, toggleStatus }
})
