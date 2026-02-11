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
        <Search class="action-icon" />
        <User class="action-icon" />
        <button class="btn-primary">LOGIN</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { Trophy, Search, User } from 'lucide-vue-next';
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
  gap: 20px;
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
</style>
