/* 前端示範用登入系統：帳號、密碼雜湊、收藏清單都存在瀏覽器 localStorage。
   上線時把這裡的函式換成呼叫後端 API 即可，其他頁面不用動。 */
(() => {
  'use strict';
  const K_USERS = 'pickme_users', K_SESSION = 'pickme_session';
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const keyed = (prefix) => {
    const user = read(K_SESSION, null);
    return user?.email ? `${prefix}${user.email}` : null;
  };
  const hash = async (s) => {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pickme:' + s));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
    } catch { return 'plain:' + s; }   // 非 https / localhost 時沒有 crypto.subtle
  };
  const norm = (e) => e.trim().toLowerCase();

  window.Auth = {
    user: () => read(K_SESSION, null),
    async register(name, email, pw) {
      email = norm(email);
      const users = read(K_USERS, {});
      if (users[email]) throw new Error('這個 Email 已經註冊過了，請直接登入。');
      users[email] = { name: name.trim(), pw: await hash(pw) };
      localStorage.setItem(K_USERS, JSON.stringify(users));
      localStorage.setItem(K_SESSION, JSON.stringify({ email, name: users[email].name }));
    },
    async login(email, pw) {
      email = norm(email);
      const rec = read(K_USERS, {})[email];
      if (!rec || rec.pw !== await hash(pw)) throw new Error('Email 或密碼不正確，請再檢查一次。');
      localStorage.setItem(K_SESSION, JSON.stringify({ email, name: rec.name }));
    },
    logout: () => localStorage.removeItem(K_SESSION),
    favs() { const u = this.user(); return u ? read('pickme_favs:' + u.email, []) : []; },
    customFavorites() {
      const key = keyed('pickme_custom_favorites:');
      return key ? read(key, []) : [];
    },
    saveCustomFavorite(config) {
      const key = keyed('pickme_custom_favorites:');
      if (!key) return null;
      const favorites = this.customFavorites();
      const id = config.id || (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const saved = { ...config, id, updatedAt: new Date().toISOString() };
      const index = favorites.findIndex((item) => item.id === id);
      if (index >= 0) favorites[index] = saved;
      else favorites.push(saved);
      localStorage.setItem(key, JSON.stringify(favorites));
      return saved;
    },
    removeCustomFavorite(id) {
      const key = keyed('pickme_custom_favorites:');
      if (!key) return false;
      const favorites = this.customFavorites();
      const next = favorites.filter((item) => item.id !== id);
      if (next.length === favorites.length) return false;
      localStorage.setItem(key, JSON.stringify(next));
      return true;
    },
    toggleTopicFav(id) { return this.toggleFav(`topic:${id}`); },
    toggleFav(id) {                       // 回傳切換後是否為「已收藏」；沒登入回傳 null
      const u = this.user(); if (!u) return null;
      let f = this.favs();
      f = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      localStorage.setItem('pickme_favs:' + u.email, JSON.stringify(f));
      return f.includes(id);
    },
  };
})();
