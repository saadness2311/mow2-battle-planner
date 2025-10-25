/*
  firebase-sync.js — ПОЛНАЯ СИНХРОНИЗАЦИЯ ПО ТВОЕЙ СТРУКТУРЕ
  ЧИТАЕТ: echelonStates, currentEchelon, currentMapFile, map
  НЕ ТРЕБУЕТ НИ ОДНОГО ИЗМЕНЕНИЯ В script.js
*/

const FIREBASE_CONFIG = { /* твой конфиг */ };

let firebaseApp, firebaseDb;
try {
  firebaseApp = firebase.app('[DEFAULT]');
  firebaseDb = firebase.database();
} catch (e) { console.warn(e); }

let currentRoomId = null;
let myUid = localStorage.getItem('mw2_uid') || 'uid_' + Math.random().toString(36).slice(2,9);
localStorage.setItem('mw2_uid', myUid);

// --- UI КОМНАТ (как раньше) ---
window.addEventListener('DOMContentLoaded', () => {
  // ... твой UI ...
  // (оставляю как в прошлом сообщении — работает)
});

// === ГЛАВНОЕ: СИНХРОНИЗАЦИЯ ПО echelonStates ===
let syncTimer = null;

function startSync() {
  if (syncTimer) clearInterval(syncTimer);
  if (!currentRoomId) return;

  // --- ОТПРАВКА: каждые 800мс ---
  syncTimer = setInterval(() => {
    if (!window.echelonStates || !window.currentEchelon) return;

    const state = window.echelonStates[window.currentEchelon];
    if (!state) return;

    const ref = firebaseDb.ref(`rooms/${currentRoomId}/echelons/${window.currentEchelon}`);

    // Отправляем markers
    if (state.markers) {
      state.markers.forEach(m => {
        if (!m.id) return;
        ref.child(m.id).set({
          type: 'marker',
          latlng: m.latlng,
          ownerNick: m.ownerNick,
          nation: m.nation,
          regimentFile: m.regimentFile,
          team: m.team,
          updatedAt: Date.now()
        });
      });
    }

    // Отправляем simple
    if (state.simple) {
      state.simple.forEach(s => {
        if (!s.entityId) return;
        ref.child(s.entityId).set({
          type: 'simple',
          latlng: s.latlng,
          symbName: s.symbName || null,
          simpleType: s.simpleType || null,
          updatedAt: Date.now()
        });
      });
    }

    // Отправляем drawings
    if (state.drawings) {
      state.drawings.forEach((feat, i) => {
        const id = feat.id || `drawing_${i}`;
        ref.child(id).set({
          type: 'drawing',
          geojson: feat,
          updatedAt: Date.now()
        });
      });
    }

    // Карта
    if (window.currentMapFile || map.getCenter()) {
      firebaseDb.ref(`rooms/${currentRoomId}/mapData`).update({
        currentMapFile: window.currentMapFile || null,
        center: map.getCenter(),
        zoom: map.getZoom(),
        currentEchelon: window.currentEchelon,
        updatedAt: Date.now()
      });
    }
  }, 800);

  // --- ПРИЁМ: слушаем все эшелоны ---
  firebaseDb.ref(`rooms/${currentRoomId}/echelons`).on('child_added', snap => {
    const ech = snap.key;
    snap.ref.on('child_added', child => applyEntity(child.val(), ech));
    snap.ref.on('child_changed', child => applyEntity(child.val(), ech));
  });

  // Карта
  firebaseDb.ref(`rooms/${currentRoomId}/mapData`).on('value', snap => {
    const d = snap.val();
    if (d?.currentMapFile && d.currentMapFile !== window.currentMapFile) {
      loadMapImage(d.currentMapFile);
    }
    if (d?.center) map.setView(d.center, d.zoom);
    if (d?.currentEchelon && d.currentEchelon !== window.currentEchelon) {
      // Ты сам переключаешь — не трогаем
    }
  });
}

function applyEntity(data, echelonId) {
  if (!window.echelonStates[echelonId]) {
    window.echelonStates[echelonId] = { markers: [], simple: [], drawings: [] };
  }
  const state = window.echelonStates[echelonId];

  if (data.type === 'marker') {
    if (state.markers.find(m => m.id === data.id)) return;
    state.markers.push({
      id: data.id,
      latlng: data.latlng,
      ownerNick: data.ownerNick,
      nation: data.nation,
      regimentFile: data.regimentFile,
      team: data.team
    });
  } else if (data.type === 'simple') {
    if (state.simple.find(s => s.entityId === data.id)) return;
    state.simple.push({
      entityId: data.id,
      latlng: data.latlng,
      symbName: data.symbName,
      simpleType: data.simpleType
    });
  } else if (data.type === 'drawing') {
    if (state.drawings.find(f => f.id === data.id)) return;
    state.drawings.push(data.geojson);
  }

  // Принудительно обновляем UI (если ты не в этом эшелоне)
  if (window.currentEchelon === parseInt(echelonId)) {
    loadEchelonState(); // твоя функция
  }
}

function stopSync() {
  if (syncTimer) clearInterval(syncTimer);
  firebaseDb.ref(`rooms/${currentRoomId}`).off();
}