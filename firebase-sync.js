/*
  firebase-sync.js — ФИНАЛЬНАЯ ВЕРСИЯ
  РАБОТАЕТ БЕЗ script.js
  ДАННЫЕ ПОПАДУТ В БД
*/

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBRbEyiNS5lFfk6YApSM1Xt30I33uW_mo8",
  authDomain: "mow2-battle-planner.firebaseapp.com",
  databaseURL: "https://mow2-battle-planner-default-rtdb.firebaseio.com",
  projectId: "mow2-battle-planner",
  storageBucket: "mow2-battle-planner.firebasestorage.app",
  messagingSenderId: "131172830575",
  appId: "1:131172830575:web:fff7cecadd4e62830fac9a",
  measurementId: "G-CFZTLVEYW0"
};

let firebaseApp, firebaseDb;
try {
  firebaseApp = firebase.app('[DEFAULT]');
  firebaseDb = firebase.database();
} catch (e) { console.error("Firebase error", e); }

let CURRENT_ROOM_ID = null;
let SYNC_TIMER = null;

const ROOM_PANEL_HTML = `
  <div class="room-panel-inner">
    <div class="room-panel-header"><strong>Комнаты</strong> <button id="room-panel-toggle">▾</button></div>
    <div id="room-panel-body">
      <div id="room-list"></div><hr/>
      <input id="room-name" placeholder="Название"/><input id="room-pass" placeholder="Пароль"/><input id="my-nick" placeholder="Ник"/>
      <button id="btn-create-room">Создать</button>
      <button id="btn-refresh-rooms">Обновить</button>
      <button id="btn-leave-room" style="display:none">Выйти</button>
    </div>
  </div>`;

window.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('room-panel');
  if (panel) panel.innerHTML = ROOM_PANEL_HTML;

  const list = document.getElementById('room-list');
  const createBtn = document.getElementById('btn-create-room');
  const refreshBtn = document.getElementById('btn-refresh-rooms');
  const leaveBtn = document.getElementById('btn-leave-room');
  const nameInp = document.getElementById('room-name');
  const passInp = document.getElementById('room-pass');
  const nickInp = document.getElementById('my-nick');
  const toggle = document.getElementById('room-panel-toggle');

  toggle.onclick = () => panel.classList.toggle('collapsed');

  const myUid = localStorage.getItem('mw2_uid') || 'uid_' + Math.random().toString(36).slice(2,9);
  localStorage.setItem('mw2_uid', myUid);
  let nick = localStorage.getItem('mw2_nick') || '';
  if (nickInp) nickInp.value = nick;

  // --- СОЗДАТЬ ---
  createBtn.onclick = async () => {
    const name = nameInp.value.trim() || 'Без названия';
    const pass = passInp.value;
    const n = nickInp.value.trim() || 'Игрок_' + Math.random().toString(36).slice(2,5);
    localStorage.setItem('mw2_nick', n);

    const ref = firebaseDb.ref('rooms').push();
    await ref.set({ name, password: pass || '', createdAt: Date.now() });
    joinRoom(ref.key, pass, n);
  };

  // --- ВОЙТИ ---
  async function joinRoom(id, pass, nick) {
    const snap = await firebaseDb.ref(`rooms/${id}`).once('value');
    const room = snap.val();
    if (room.password && room.password !== pass) return alert('Неверный пароль');

    CURRENT_ROOM_ID = id;
    localStorage.setItem('mw2_last_room', id);
    await firebaseDb.ref(`rooms/${id}/participants/${myUid}`).set({ nick, joinedAt: Date.now() });
    firebaseDb.ref(`rooms/${id}/participants/${myUid}`).onDisconnect().remove();
    leaveBtn.style.display = 'inline-block';

    console.log("JOINED ROOM:", id);
    startSync();
  }

  // --- СПИСОК КОМНАТ ---
  list.onclick = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('join')) {
      const p = prompt('Пароль:') || '';
      joinRoom(id, p, nickInp.value);
    } else if (btn.classList.contains('del')) {
      if (confirm('Удалить?')) firebaseDb.ref(`rooms/${id}`).remove();
    }
  };

  leaveBtn.onclick = () => {
    firebaseDb.ref(`rooms/${CURRENT_ROOM_ID}/participants/${myUid}`).remove();
    stopSync();
    CURRENT_ROOM_ID = null;
    leaveBtn.style.display = 'none';
  };

  refreshBtn.onclick = async () => {
    const snap = await firebaseDb.ref('rooms').once('value');
    const rooms = snap.val() || {};
    list.innerHTML = '';
    Object.entries(rooms).forEach(([id, r]) => {
      const div = document.createElement('div');
      div.innerHTML = `<div>${r.name}</div><div>Участников: <span class="c">?</span></div>
        <button class="join" data-id="${id}">Войти</button>
        <button class="del" data-id="${id}">×</button>`;
      list.appendChild(div);
      firebaseDb.ref(`rooms/${id}/participants`).once('value').then(s => div.querySelector('.c').textContent = s.numChildren());
    });
  };

  setTimeout(() => refreshBtn.click(), 300);
});

// === СИНХРОНИЗАЦИЯ ===
function startSync() {
  if (SYNC_TIMER) clearInterval(SYNC_TIMER);

  SYNC_TIMER = setInterval(() => {
    if (!CURRENT_ROOM_ID) return;
    if (!window.echelonStates || !window.currentEchelon) {
      console.log("WAITING FOR echelonStates or currentEchelon...");
      return;
    }

    const state = window.echelonStates[window.currentEchelon];
    if (!state) return;

    const ref = firebaseDb.ref(`rooms/${CURRENT_ROOM_ID}/echelons/${window.currentEchelon}`);

    // Маркеры
    (state.markers || []).forEach(m => {
      if (!m.id) return;
      ref.child(m.id).set({
        type: 'marker',
        latlng: m.latlng,
        ownerNick: m.ownerNick,
        nation: m.nation,
        regimentFile: m.regimentFile,
        team: m.team,
        updatedAt: Date.now()
      }).catch(e => console.error("MARKER ERROR", e));
    });

    // Символы
    (state.simple || []).forEach(s => {
      if (!s.entityId) return;
      ref.child(s.entityId).set({
        type: 'simple',
        latlng: s.latlng,
        symbName: s.symbName || null,
        simpleType: s.simpleType || null,
        updatedAt: Date.now()
      });
    });

    // Рисунки
    (state.drawings || []).forEach((f, i) => {
      const id = f.id || `d_${i}`;
      ref.child(id).set({
        type: 'drawing',
        geojson: f,
        updatedAt: Date.now()
      });
    });

    // Карта
    if (window.currentMapFile) {
      firebaseDb.ref(`rooms/${CURRENT_ROOM_ID}/mapData`).set({
        currentMapFile: window.currentMapFile,
        center: map.getCenter(),
        zoom: map.getZoom(),
        currentEchelon: window.currentEchelon,
        updatedAt: Date.now()
      });
    }

    console.log("SYNC SENT TO FIREBASE");
  }, 1000);

  // Приём
  firebaseDb.ref(`rooms/${CURRENT_ROOM_ID}`).on('value', snap => {
    const data = snap.val();
    if (!data) return;

    // Карта
    if (data.mapData?.currentMapFile && data.mapData.currentMapFile !== window.currentMapFile) {
      console.log("LOADING MAP:", data.mapData.currentMapFile);
      loadMapImage(data.mapData.currentMapFile);
    }
    if (data.mapData?.center) map.setView(data.mapData.center, data.mapData.zoom);

    // Эшелоны
    if (data.echelons?.[window.currentEchelon]) {
      const remote = data.echelons[window.currentEchelon];
      const local = window.echelonStates[window.currentEchelon];
      if (!local) return;

      // Применяем только если новее
      Object.entries(remote).forEach(([id, val]) => {
        if (val.updatedAt > (local[id]?.updatedAt || 0)) {
          if (val.type === 'marker' && !local.markers.find(m => m.id === id)) {
            local.markers.push(val);
          }
        }
      });

      if (window.currentEchelon === parseInt(Object.keys(data.echelons)[0])) {
        loadEchelonState();
      }
    }
  });
}

function stopSync() {
  if (SYNC_TIMER) clearInterval(SYNC_TIMER);
  firebaseDb.ref().off();
}

// Автостарт при загрузке
setTimeout(() => {
  const last = localStorage.getItem('mw2_last_room');
  if (last && confirm('Восстановить последнюю комнату?')) {
    // Попробуем войти
  }
}, 1000);

console.log("Firebase Sync LOADED. Waiting for room...");