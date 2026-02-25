<template>
  <header class="header">
    <div class="header-content">
      <div class="logo">
        <Trophy class="icon-logo" />
        <span class="logo-text">MyDiretta</span>
      </div>
      <nav class="nav">
        <a href="#" class="active">Calcio</a>
        <a href="#">Tennis</a>
        <a href="#">Basket</a>
        <a href="#">Volley</a>
      </nav>
      <div class="header-actions">
        <div class="search-bar">
          <Search class="search-icon" size="18" />
          <input
            :value="teamSearch"
            @input="$emit('update:teamSearch', ($event.target).value)"
            type="text"
            class="search-input"
            placeholder="Cerca squadra..."
            aria-label="Cerca squadra"
          />
          <button
            v-if="teamSearch"
            type="button"
            class="search-clear"
            @click="$emit('update:teamSearch', '')"
            aria-label="Cancella"
          >
            ×
          </button>
        </div>
        <button
          type="button"
          class="theme-toggle"
          :aria-label="darkMode ? 'Passa a tema chiaro' : 'Passa a tema scuro'"
          @click="$emit('toggle-dark')"
        >
          <Sun v-if="darkMode" class="theme-icon" size="20" />
          <Moon v-else class="theme-icon" size="20" />
        </button>
        <User class="action-icon" />
        <button class="btn-primary">LOGIN</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { Trophy, Search, User, Sun, Moon } from 'lucide-vue-next';

defineProps({
  teamSearch: { type: String, default: '' },
  darkMode: { type: Boolean, default: true }
});

defineEmits(['update:teamSearch', 'toggle-dark']);
</script>

<style scoped>
.header {
  background: var(--secondary);
  border-bottom: 1px solid var(--border);
  padding: 15px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-logo {
  color: var(--primary);
  width: 32px;
  height: 32px;
}

.logo-text {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  letter-spacing: -1px;
}

.logo-text span {
  color: var(--primary);
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: 2px;
  margin-left: 5px;
}

.nav {
  display: flex;
  gap: 30px;
}

.nav a {
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  padding-bottom: 5px;
  border-bottom: 2px solid transparent;
  transition: all 0.3s ease;
}

.nav a:hover, .nav a.active {
  color: var(--text-main);
  border-bottom-color: var(--primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 14px;
  min-width: 200px;
  max-width: 280px;
  transition: background 0.2s, border-color 0.2s;
}

.search-bar:focus-within {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(0, 135, 78, 0.2);
}

.search-bar .search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-bar:focus-within .search-icon {
  color: var(--primary);
}

.search-bar .search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  color: var(--text-main);
  outline: none;
  min-width: 0;
}

.search-bar .search-input::placeholder {
  color: var(--text-muted);
  opacity: 0.8;
}

.search-bar .search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
}

.search-bar .search-clear:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.08);
}

.action-icon {
  color: var(--text-muted);
  width: 20px;
  cursor: pointer;
  transition: color 0.3s ease;
}

.action-icon:hover {
  color: var(--primary);
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: var(--glass);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}

.theme-toggle:hover {
  color: var(--primary);
  background: var(--glass);
}

.theme-icon {
  flex-shrink: 0;
}
</style>
