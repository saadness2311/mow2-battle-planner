// script.js


// --- Entity ID generator for realtime sync ---
function generateEntityId(prefix='e') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}

// Helper wrappers for Firebase (теперь с echelon)
window.firebaseCreateEntity = window.firebaseCreateEntity || function(entity, echelon){ /* no-op until firebase initialized */ };
window.firebaseUpdateEntity = window.firebaseUpdateEntity || function(id, data, echelon){ /* no-op */ };
window.firebaseDeleteEntity = window.firebaseDeleteEntity || function(id, echelon){ /* no-op */ };

// --- Многопользовательская синхронизация (улучшенная версия) ---
let syncEnabled = false;
let entityStore = {}; // {echelon: {id: {data, localUpdatedAt, layer}}}
let dragDebounceTimers = {};

// Debounce функция для drag и edit
function debounce(fn, ms, key) {
  return function(...args) {
    clearTimeout(dragDebounceTimers[key]);
    dragDebounceTimers[key] = setTimeout(() => fn(...args), ms);
  };
}

// Получить состояние текущего эшелона
function getCurrentEchelonState() {
  if (!entityStore[currentEchelon]) {
    entityStore[currentEchelon] = {};
  }
  return entityStore[currentEchelon];
}

// Применить remote entity (с проверкой конфликтов по timestamp)
function applyRemoteEntity(entity) {
  if (!syncEnabled || entity.echelon !== currentEchelon) return;
  const state = getCurrentEchelonState();
  const existing = state[entity.id];
  
  // Игнорируем, если локальная версия новее (last-write-wins)
  if (existing && existing.localUpdatedAt >= entity.updatedAt) {
    console.log('IGNORED remote (local newer):', entity.id);
    return;
  }
  
  // Обновляем store
  state[entity.id] = {
    data: entity.data,
    remoteUpdatedAt: entity.updatedAt,
    layer: null // будет установлен ниже
  };
  
  // Удаляем старый layer, если есть
  if (existing?.layer) {
    if (existing.layer instanceof L.LayerGroup) {
      existing.layer.clearLayers();
    } else {
      map.removeLayer(existing.layer);
    }
  }
  
  // Создаём новый layer
  createLayerFromEntity(entity);
  console.log('APPLIED remote entity:', entity.id, entity.type);
}

// Создать Leaflet layer из entity данных
function createLayerFromEntity(entity) {
  const state = getCurrentEchelonState();
  let layer;
  
  try {
    const data = entity.data;
    switch (entity.type) {
      case 'player_marker':
        const icon = createRegDivIcon(data.ownerNick, data.nation, data.regimentFile, data.team);
        layer = L.marker(data.latlng, { icon, draggable: true }).addTo(map);
        
        // Drag sync (debounce 250ms)
        layer.on('dragend', debounce(() => {
          const newLatLng = layer.getLatLng();
          firebaseUpdateEntity(entity.id, { latlng: newLatLng }, currentEchelon);
          // Обновляем local timestamp
          state[entity.id].localUpdatedAt = Date.now();
        }, 250, `drag_${entity.id}`));
        
        // Удаление по правой кнопке
        layer.on('contextmenu', (e) => {
          L.DomEvent.preventDefault(e);
          if (confirm('Удалить маркер игрока?')) {
            firebaseDeleteEntity(entity.id, currentEchelon);
          }
        });
        
        // Добавляем в markerList
        const entry = { id: entity.id, team: data.team, playerIndex: data.playerIndex, nick: data.ownerNick, nation: data.nation, regimentFile: data.regimentFile, marker: layer };
        markerList.push(entry);
        break;
        
      case 'simple_symbol':
        if (data.symbName && ICON_NAMES.includes(data.symbName)) {
          layer = addCustomIcon(`assets/symbols/${data.symbName}.png`, data.latlng);
        } else {
          layer = addSimpleSymbol(data.simpleType, data.latlng);
        }
        layer.entityId = entity.id;
        layer.entityType = 'simple_symbol';
        
        // Drag sync
        layer.on('dragend', debounce(() => {
          firebaseUpdateEntity(entity.id, { latlng: layer.getLatLng() }, currentEchelon);
          state[entity.id].localUpdatedAt = Date.now();
        }, 250, `drag_${entity.id}`));
        
        // Удаление
        layer.on('contextmenu', (e) => {
          L.DomEvent.preventDefault(e);
          if (confirm('Удалить символ?')) {
            map.removeLayer(layer);
            simpleMarkers = simpleMarkers.filter(m => m !== layer);
            firebaseDeleteEntity(entity.id, currentEchelon);
          }
        });
        
        simpleMarkers.push(layer);
        break;
        
      case 'drawing':
        layer = L.geoJSON(data.geojson, {
          style: (feature) => feature.properties || {}
        }).addTo(drawnItems);
        
        layer.entityId = entity.id;
        layer.entityType = 'drawing';
        
        // Edit sync (debounce 500ms)
        layer.on('edit', debounce(() => {
          const newGeojson = layer.toGeoJSON();
          newGeojson.properties = pickLayerOptions(layer);
          firebaseUpdateEntity(entity.id, { geojson: newGeojson }, currentEchelon);
          state[entity.id].localUpdatedAt = Date.now();
        }, 500, `edit_${entity.id}`));
        break;
    }
    
    if (layer) {
      state[entity.id].layer = layer;
      layer.entityId = entity.id;
      layer.entityType = entity.type;
    }
  } catch (e) {
    console.error('Error creating layer from entity:', e);
  }
}

// --- Remote event handlers (БЕЗОПАСНЫЕ, С ЭШЕЛОНАМИ, БЕЗ ЦИКЛОВ) ---
const processedEntities = new Set(); // Защита от дублирования

window.addEventListener('remoteEntityAdded', (e) => {
  const { entity, echelonId = 'default' } = e.detail;
  if (!entity || !entity.id) return;

  const key = `${echelonId}_${entity.id}`;
  if (processedEntities.has(key)) return;
  processedEntities.add(key);

  // Сохраняем echelonId в entity, если его нет
  entity.echelonId = echelonId;

  applyRemoteEntity(entity);
  console.log('ADDED remote entity:', entity.id, 'echelon:', echelonId);
});

window.addEventListener('remoteEntityChanged', (e) => {
  const { entity, echelonId = 'default' } = e.detail;
  if (!entity || !entity.id) return;

  entity.echelonId = echelonId;
  applyRemoteEntity(entity);
  console.log('CHANGED remote entity:', entity.id, 'echelon:', echelonId);
});

window.addEventListener('remoteEntityRemoved', (e) => {
  const { id, echelonId = 'default' } = e.detail;
  const key = `${echelonId}_${id}`;
  processedEntities.delete(key);

  const state = getCurrentEchelonState();
  const item = state[id];
  if (item?.layer) {
    if (item.layer instanceof L.LayerGroup) {
      item.layer.clearLayers();
    } else {
      map.removeLayer(item.layer);
    }
  }
  delete state[id];

  // Очистка из списков
  markerList = markerList.filter(m => m.id !== id);
  simpleMarkers = simpleMarkers.filter(m => m.entityId !== id);

  console.log('REMOVED remote entity:', id, 'echelon:', echelonId);
});

window.addEventListener('remoteRoomLeft', () => {
  syncEnabled = false;
  entityStore = {};
  processedEntities.clear();
  console.log('Left room - sync disabled');
});

window.addEventListener('remoteParticipants', (e) => {
  syncEnabled = true;
  console.log('Room joined - sync enabled. Participants:', Object.keys(e.detail.participants).length);
});

// ------------ Конфигурация ------------ 
const MAP_COUNT = 25; // теперь map1..map25
const MAP_FILE_PREFIX = "map"; // map1.jpg
const MAP_FOLDER = "assets/maps/";
const ICON_FOLDER = "assets/"; // assets/{nation}/regX.png

// placeholder SVG data URI (показываем если иконка не найдена)
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
     <rect width="100%" height="100%" fill="#444"/>
     <text x="50%" y="54%" font-size="18" fill="#fff" text-anchor="middle" font-family="Arial">no</text>
     <text x="50%" y="70%" font-size="12" fill="#ddd" text-anchor="middle" font-family="Arial">image</text>
   </svg>`);

// === Иконки в папке assets/symbols ===
const ICON_NAMES = [
  'symb1','symb2','symb3','symb4','symb5','symb6',
  'symb7','symb8','symb9','symb10','symb11','symb12',
  'symb13','symb14','symb15','symb16','symb17','symb18',
  'symb19','symb20','symb21','symb22','symb23','symb24','symb25','symb26',
  'symb27','symb28','symb29','symb30','symb31','symb32','symb33','symb34',
  'symb35'
];

const ICON_CATEGORIES = {
  unit: ['symb1','symb2','symb3','symb4','symb5','symb6',
         'symb7','symb8','symb9','symb10','symb11','symb12',
         'symb13','symb14','symb15','symb16','symb17','symb18'],
  engineer: ['symb19','symb20','symb21','symb22','symb23','symb24','symb25','symb26',
             'symb27','symb28','symb29'],
  signs: ['symb31','symb32','symb33','symb34','symb35']
};

const ICON_LABELS = {
  symb1:  'Бронеавтомобиль',
  symb2:  'Гаубица',
  symb3:  'Противотанковая пушка',
  symb4:  'Противовоздушная оборона',
  symb5:  'Основная пехота',
  symb6:  'Тяжелая пехота',
  symb7:  'Специальная пехота',
  symb8:  'Вспомогательная пехота',
  symb9:  'Подразделение поддержки',
  symb10: 'Тяжелый танк',
  symb11: 'Противотанковая САУ',
  symb12: 'Легкий танк',
  symb13: 'Средний танк',
  symb14: 'Штурмовая САУ',
  symb15: 'Самостоятельный пехотный отряд',
  symb16: 'Парашютисты',
  symb17: 'Фронтовая авиация',
  symb18: 'Вспомогательная техника'
};

// Короткие подписи для всплывающей подсказки (используются при наведении)
const ICON_SHORT = {
  symb1:  'Бронеавто',
  symb2:  'Гаубица',
  symb3:  'ПТ пушка',
  symb4:  'ПВО',
  symb5:  'Пехота',
  symb6:  'Тяж. пех.',
  symb7:  'Спецпех.',
  symb8:  'Всп. пех.',
  symb9:  'Поддержка',
  symb10: 'Тяж. танк',
  symb11: 'ПТ САУ',
  symb12: 'Лёг. танк',
  symb13: 'Сред. танк',
  symb14: 'Штурм. САУ',
  symb15: 'Пех. отряд',
  symb16: 'Десант',
  symb17: 'Авиация',
  symb18: 'Всп. тех.'
};

// Отображаемые имена карт (в порядке map1..map25)
const MAP_NAMES = {
  1: "Airfield",
  2: "Bazerville",
  3: "Borovaya River",
  4: "Carpathians",
  5: "Champagne",
  6: "Coast",
  7: "Dead River",
  8: "Estate",
  9: "Farm Land",
 10: "Hunting Grounds",
 11: "Kursk Fields",
 12: "Nameless Height",
 13: "Polesie",
 14: "Port",
 15: "Saint Lo",
 16: "Suburb",
 17: "Valley of Death",
 18: "Village",
 19: "Volokalamsk Highway",
 20: "Witches Vale",
 21: "Winter March",
 22: "Chepel",
 23: "Crossroads",
 24: "Sandy Path",
 25: "Marl"
};

// Регистры (отображаемые названия полков) для каждой нации (reg1..reg17)
const REG_NAMES = {
  germany: {
    1: "Самоходный",
    2: "Развед",
    3: "Механка",
    4: "Гаубицы",
    5: "Моторизованная пехота",
    6: "Огнеметный",
    7: "ПВО",
    8: "Саперка",
    9: "Гренадерский",
    10: "Минометный",
    11: "Штурмовой",
    12: "Тяжелый танковый",
    13: "Противотанковый",
    14: "Средний танковый",
    15: "Первый артиллерийский",
    16: "Первый пехотный",
    17: "Первый танковый"
  },
  usa: {
    1: "Самоходный",
    2: "Развед",
    3: "Механка",
    4: "Гаубицы",
    5: "Моторизованная пехота",
    6: "Огнеметный",
    7: "ПВО",
    8: "Десантный",
    9: "Тяжелый танковый",
    10: "Минометный",
    11: "Саперный",
    12: "Средний танковый",
    13: "Противотанковый",
    14: "Штурмовой",
    15: "Первый артиллерийский",
    16: "Первый пехотный",
    17: "Первый танковый"
  },
  ussr: {
    1: "Самоходный",
    2: "Развед",
    3: "Механка",
    4: "Гаубицы",
    5: "Моторизованная пехота",
    6: "Огнеметный",
    7: "ПВО",
    8: "Саперка",
    9: "Тяжелый танковый",
    10: "Минометный",
    11: "Штурмовой",
    12: "Средний танковый",
    13: "Противотанковый",
    14: "88-ой штурмовой",
    15: "Первый артиллерийский",
    16: "Первый пехотный",
    17: "Первый танковый"
  }
};

//------------ Полезные утилиты ------------
function $id(id){ return document.getElementById(id); }
function createEl(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

//--------------------Исправление рисунков в эшелонах

function pickLayerOptions(layer) {
  const opts = {};
  if (layer.options) {
    if (layer.options.color) opts.color = layer.options.color;
    if (layer.options.weight != null) opts.weight = layer.options.weight;
    if (layer.options.fillColor) opts.fillColor = layer.options.fillColor;
    if (layer.options.fillOpacity != null) opts.fillOpacity = layer.options.fillOpacity;
  }
  return opts;
}

//------------ Инициализация карты и слоёв ------------
let imageOverlay = null;
let imageBounds = null;
let currentMapFile = null;

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -1,
  maxZoom: 4,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
});
map.setView([0,0], 0);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ------------ Эшелоны (3 состояния карты) ------------
const ECHELON_COUNT = 3;
let currentEchelon = 1;
let echelonStates = {
  1: { markers: [], simple: [], drawings: [] },
  2: { markers: [], simple: [], drawings: [] },
  3: { markers: [], simple: [], drawings: [] }
};

// Контейнеры для маркеров/символов
let markerList = []; // {id, team, playerIndex, nick, nation, regimentFile, marker}
let simpleMarkers = []; // symbols from SimpleSymbols or others

// ------------ Draw control: ensure color/weight are applied ------------
function getDrawColor(){ return $id('drawColor') ? $id('drawColor').value : '#ff0000'; }
function getDrawWeight(){ return $id('drawWeight') ? Number($id('drawWeight').value) : 3; }

// Create draw control with default options, but we will set style on created layers
const drawControl = new L.Control.Draw({
  position: 'topleft',
  draw: {
    marker: false,
    polyline: true,
    polygon: true,
    rectangle: false,
    circle: false,
    circlemarker: false
  },
  edit: { featureGroup: drawnItems, remove: true }
});
map.addControl(drawControl);

// ------------ Панель управления эшелонами ------------
const echelonControl = L.control({ position: 'topright' });

echelonControl.onAdd = function(map) {
  const container = L.DomUtil.create('div', 'leaflet-bar echelon-control');
  container.style.background = 'rgba(25,25,25,0.75)';
  container.style.color = 'white';
  container.style.padding = '6px 10px';
  container.style.border = '1px solid rgba(255,255,255,0.2)';
  container.style.borderRadius = '8px';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '6px';
  container.style.userSelect = 'none';
  container.style.fontFamily = 'sans-serif';
  container.style.fontSize = '14px';

  const leftBtn = L.DomUtil.create('button','',container);
  leftBtn.innerHTML = '⟵';
  leftBtn.style.background = 'none';
  leftBtn.style.color = 'white';
  leftBtn.style.border = 'none';
  leftBtn.style.cursor = 'pointer';
  leftBtn.title = 'Предыдущий эшелон';

  const label = L.DomUtil.create('span','',container);
  label.textContent = `Эшелон ${currentEchelon}/${ECHELON_COUNT}`;
  label.style.minWidth = '80px';
  label.style.textAlign = 'center';

  const rightBtn = L.DomUtil.create('button','',container);
  rightBtn.innerHTML = '⟶';
  rightBtn.style.background = 'none';
  rightBtn.style.color = 'white';
  rightBtn.style.border = 'none';
  rightBtn.style.cursor = 'pointer';
  rightBtn.title = 'Следующий эшелон';

  const copyBtn = L.DomUtil.create('button','',container);
  copyBtn.innerHTML = '📋';
  copyBtn.style.background = 'none';
  copyBtn.style.color = 'white';
  copyBtn.style.border = 'none';
  copyBtn.style.cursor = 'pointer';
  copyBtn.title = 'Копировать текущее состояние в следующий эшелон';

  // обработчики
  L.DomEvent.on(leftBtn, 'click', e => {
    L.DomEvent.stopPropagation(e);
    saveCurrentEchelonState();
    currentEchelon = currentEchelon <= 1 ? ECHELON_COUNT : currentEchelon - 1;
    loadEchelonState(currentEchelon);
    label.textContent = `Эшелон ${currentEchelon}/${ECHELON_COUNT}`;
  });

  L.DomEvent.on(rightBtn, 'click', e => {
    L.DomEvent.stopPropagation(e);
    saveCurrentEchelonState();
    currentEchelon = currentEchelon >= ECHELON_COUNT ? 1 : currentEchelon + 1;
    loadEchelonState(currentEchelon);
    label.textContent = `Эшелон ${currentEchelon}/${ECHELON_COUNT}`;
  });

  L.DomEvent.on(copyBtn, 'click', e => {
    L.DomEvent.stopPropagation(e);
    saveCurrentEchelonState();
    const next = currentEchelon >= ECHELON_COUNT ? 1 : currentEchelon + 1;
    echelonStates[next] = JSON.parse(JSON.stringify(echelonStates[currentEchelon]));
    alert(`Скопировано в эшелон ${next}`);
  });

  return container;
};

map.addControl(echelonControl);

// When a new shape is created via Draw, apply current color/weight and add to drawnItems + SYNC
map.on(L.Draw.Event.CREATED, function (e) {
  const layer = e.layer;
  // apply style for polylines / polygons / circle
  if (layer.setStyle) {
    const style = { color: getDrawColor(), weight: getDrawWeight() };
    if (layer instanceof L.Polygon) {
      style.fillColor = getDrawColor();
      style.fillOpacity = 0.15;
    }
    layer.setStyle(style);
  }
  if (layer instanceof L.Circle) {
    // circle has options.radius already
    // ensure stroke color/weight set
    layer.setStyle && layer.setStyle({ color: getDrawColor(), weight: getDrawWeight() });
  }
  drawnItems.addLayer(layer);

  // SYNC: Создаём entity для Firebase
  const id = generateEntityId('draw');
  const geojson = layer.toGeoJSON();
  geojson.properties = pickLayerOptions(layer);

  const entity = {
    id: id,
    type: 'drawing',
    data: { geojson },
    updatedAt: Date.now(),
    echelon: currentEchelon
  };

  try {
    firebaseCreateEntity(entity, currentEchelon);
    getCurrentEchelonState()[id] = { data: entity.data, localUpdatedAt: entity.updatedAt, layer: layer };
    layer.entityId = id;
    layer.entityType = 'drawing';
  } catch (e) {
    console.warn('Firebase create drawing error:', e);
  }

  // Edit handler for sync
  layer.on('edit', debounce(() => {
    const newGeojson = layer.toGeoJSON();
    newGeojson.properties = pickLayerOptions(layer);
    firebaseUpdateEntity(id, { geojson: newGeojson }, currentEchelon);
    getCurrentEchelonState()[id].localUpdatedAt = Date.now();
  }, 500, `edit_${id}`));
});

// Ensure edits keep styles intact
map.on(L.Draw.Event.EDITED, function (e) {
  // no-op - layers are already in drawnItems
  // Sync уже в layer.on('edit')
});
map.on(L.Draw.Event.DELETED, function (e) {
  e.layers.eachLayer(layer => {
    if (layer.entityId) {
      firebaseDeleteEntity(layer.entityId, currentEchelon);
    }
  });
});

// === SimpleSymbols с тремя вкладками ===
const SimpleSymbols = L.Control.extend({
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    container.style.background = 'rgba(20,20,20,0.6)';
    container.style.border = '1px solid rgba(255,255,255,0.15)';
    container.style.cursor = 'pointer';
    container.style.padding = '4px';

    // Верхняя панель вкладок
    const tabs = L.DomUtil.create('div', '', container);
    tabs.style.display = 'flex';
    tabs.style.justifyContent = 'space-between';
    tabs.style.marginBottom = '4px';

    const tabNames = { unit: 'Арм', engineer: 'Инж', signs: 'Сим' };
    const menus = {};

    for (const key in tabNames) {
      const btn = L.DomUtil.create('a', '', tabs);
      btn.textContent = tabNames[key];
      btn.style.flex = '1';
      btn.style.textAlign = 'center';
      btn.style.padding = '2px 0';
      btn.style.cursor = 'pointer';
      btn.style.background = 'rgba(40,40,40,0.6)';
      btn.style.color = 'white';
      btn.style.border = '1px solid rgba(255,255,255,0.1)';
      btn.style.userSelect = 'none';

      // Меню символов
      const menu = L.DomUtil.create('div', '', container);
      menu.style.display = 'none';               // свернуто по умолчанию
      menu.classList.add('symbol-menu');     
      menu.style.marginTop = '2px';
      menu.style.background = 'rgba(0,0,0,0.7)';
      menu.style.border = '1px solid rgba(255,255,255,0.1)';
      menu.style.borderRadius = '6px';
      menu.style.padding = '4px';
      menu.style.width = '80px';
      menu.style.gridTemplateColumns = 'repeat(2, 34px)';
      menu.style.gridAutoRows = '34px';
      menu.style.gridGap = '4px';
      menu.style.overflow = 'hidden';
      menu.style.display = 'none';              // главное — скрыто

      menus[key] = menu;

      // Клик по вкладке: показать/скрыть только нужное меню
      btn.addEventListener('click', () => {
        for (const k in menus) {
          if (k === key) {
            menus[k].style.display = menus[k].style.display === 'none' ? 'grid' : 'none';
          } else {
            menus[k].style.display = 'none';
          }
        }
      });
    }

    // Добавляем символы в каждое меню
    for (const category in ICON_CATEGORIES) {
      const menu = menus[category];
      menu.style.display = 'none'; // по умолчанию скрыто

      ICON_CATEGORIES[category].forEach(name => {
        const btn = L.DomUtil.create('a', '', menu);
        btn.style.width = '34px';
        btn.style.height = '34px';
        btn.style.margin = '0';
        btn.style.textAlign = 'center';
        btn.style.verticalAlign = 'middle';
        btn.innerHTML = `<img src="assets/symbols/${name}.png" 
                          alt="${name}" 
                          title="${ICON_LABELS[name] || name}" 
                          style="width:28px;height:28px;pointer-events:none">`;

        L.DomEvent.on(btn, 'click', e => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          const mk = addCustomIcon(`assets/symbols/${name}.png`, map.getCenter());
          if (mk) mk._symbName = name;
          simpleMarkers.push(mk);
        });
      });
    }

    return container;
  }
});

map.addControl(new SimpleSymbols({ position: 'topleft' }));

// === addSimpleSymbol с масштабируемыми иконками + SYNC ===
function addSimpleSymbol(type, latlng) {
  const color = getDrawColor(); 
  const size = 60;

  let char = '?';
  switch(type){
    case 'dot': char='●'; break;
    case 'x': char='✖'; break;
    case 'arrow': char='↑'; break;
    case 'triangle': char='▲'; break;
    case 'diamond': char='◆'; break;
    case 'skull': char='☠'; break;
    case 'cross': char='☧'; break;
  }

  const marker = L.marker(latlng, {
    icon: L.divIcon({
      html: `<div style="color:${color};font-size:${size}px;">${char}</div>`,
      className: 'symbol-marker',
      iconSize: [size,size],
      iconAnchor: [size/2,size/2]
    }),
    draggable: true
  }).addTo(map);

  // SYNC: Assign ID and send to Firebase
  const id = generateEntityId('sym');
  marker.entityId = id;
  marker.entityType = 'simple_symbol';
  marker._simpleType = type; // для сохранения

  const entity = {
    id: id,
    type: 'simple_symbol',
    data: { simpleType: type, latlng: marker.getLatLng() },
    updatedAt: Date.now(),
    echelon: currentEchelon
  };

  try {
    firebaseCreateEntity(entity, currentEchelon);
    getCurrentEchelonState()[id] = { data: entity.data, localUpdatedAt: entity.updatedAt, layer: marker };
  } catch(e) { console.warn('firebaseCreateEntity error', e); }

  // Drag sync
  marker.on('dragend', debounce(() => {
    firebaseUpdateEntity(id, { latlng: marker.getLatLng() }, currentEchelon);
    getCurrentEchelonState()[id].localUpdatedAt = Date.now();
  }, 250, `drag_${id}`));

  marker.on('click', () => {
    if(confirm('Удалить этот символ?')){
      map.removeLayer(marker);
      const idx = simpleMarkers.indexOf(marker);
      if(idx!==-1) simpleMarkers.splice(idx,1);
      firebaseDeleteEntity(id, currentEchelon);
    }
  });

  return marker;
}

function addCustomIcon(url, latlng) {
  const marker = L.marker(latlng, {
    icon: L.icon({
      iconUrl: url,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    }),
    draggable: true
  }).addTo(map);

  // SYNC: Assign ID and send
  const id = generateEntityId('sym');
  marker.entityId = id;
  marker.entityType = 'simple_symbol';

  try {
    const file = String(url).split('/').pop() || '';
    const key = file.replace(/\.[^/.]+$/, '');
    marker._symbName = key;

    // --- Только если для символа есть label ---
    if(ICON_LABELS[key]){
      const label = ICON_SHORT[key] || ICON_LABELS[key];
      marker.bindTooltip(label, {
        permanent: false,
        direction: "top",
        offset: [0, -26],
        opacity: 0.95,
        className: 'symb-tooltip'
      });
    }

    const entity = {
      id: id,
      type: 'simple_symbol',
      data: { symbName: key, latlng: marker.getLatLng() },
      updatedAt: Date.now(),
      echelon: currentEchelon
    };

    firebaseCreateEntity(entity, currentEchelon);
    getCurrentEchelonState()[id] = { data: entity.data, localUpdatedAt: entity.updatedAt, layer: marker };
  } catch (e) { console.warn('tooltip bind error', e); }

  // Drag sync
  marker.on('dragend', debounce(() => {
    firebaseUpdateEntity(id, { latlng: marker.getLatLng() }, currentEchelon);
    getCurrentEchelonState()[id].localUpdatedAt = Date.now();
  }, 250, `drag_${id}`));

  marker.on('click', () => {
    if (confirm('Удалить этот символ?')) {
      map.removeLayer(marker);
      const idx = simpleMarkers.indexOf(marker);
      if (idx !== -1) simpleMarkers.splice(idx, 1);
      firebaseDeleteEntity(id, currentEchelon);
    }
  });

  return marker;
}

//------------ Заполнение списка карт автоматически ------------
const mapSelect = $id('mapSelect');
for (let i = 1; i <= MAP_COUNT; i++) {
  const baseName = MAP_NAMES[i] || `map${i}`;

  // --- Вариант A ---
  const optA = createEl('option');
  optA.value = `${MAP_FILE_PREFIX}${i}.jpg`;
  optA.textContent = `${i}. ${baseName}-a`;
  mapSelect.appendChild(optA);

  // --- Вариант B ---
  const optB = createEl('option');
  optB.value = `${MAP_FILE_PREFIX}${i}-alt.jpg`;
  optB.textContent = `${i}. ${baseName}-b`;
  mapSelect.appendChild(optB);
}

//------------ Загрузка карты (imageOverlay) ------------
function loadMapByFile(fileName){
  // Возвращаем Promise, чтобы можно было дождаться загрузки
  return new Promise((resolve, reject) => {
    // удаляем старую
    if(imageOverlay) {
      try { map.removeLayer(imageOverlay); } catch(e){}
      imageOverlay = null; imageBounds = null; currentMapFile = null;
    }

    const url = MAP_FOLDER + fileName;
    // загружаем картинку чтобы узнать размеры
    const img = new Image();
    img.onload = function(){
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      // bounds: top-left [0,0], bottom-right [h, w] (lat,lng order for CRS.Simple)
      imageBounds = [[0,0],[h,w]];
      // сбрасываем CRS и view: для простоты используем CRS.Simple and set view to center
      imageOverlay = L.imageOverlay(url, imageBounds).addTo(map);
      // ensure overlay is behind markers/drawn items
      if (imageOverlay && typeof imageOverlay.bringToBack === 'function') {
        imageOverlay.bringToBack();
      }
      map.fitBounds(imageBounds);
      currentMapFile = fileName;
      resolve();
    };
    img.onerror = function(){
      reject(new Error('Не удалось загрузить файл карты: ' + url + '. Проверьте, что файл существует и название/регистр совпадают.'));
    };
    img.src = url;
  });
}

$id('btnLoadMap').addEventListener('click', ()=> {
  const sel = mapSelect.value;
  if(!sel) return alert('Выберите карту в списке.');
  loadMapByFile(sel).catch(err => alert(err.message));
});

$id('btnResetMap').addEventListener('click', ()=>{
  if(imageOverlay) map.removeLayer(imageOverlay);
  imageOverlay = null; imageBounds = null; currentMapFile = null;
  // сброс view
  map.setView([0,0], 0);
});

//------------ Создание UI для игроков (2 команды по 5) ------------
const RED_PLAYERS = $id('redPlayers');
const BLUE_PLAYERS = $id('bluePlayers');
const NATIONS = ['ussr','germany','usa'];

function makePlayerRow(team, index){
  // keep original indexing as in your code (index passed 1..5 earlier) - we'll use 1-based here for label but store 0-based where needed
  const row = createEl('div','player-row');
  const nickId = `${team}-nick-${index}`;
  const nationId = `${team}-nation-${index}`;
  const regId = `${team}-reg-${index}`;
  row.innerHTML = `
    <input id="${nickId}" type="text" placeholder="Ник" />
    <select id="${nationId}" class="nation-select"></select>
    <select id="${regId}" class="reg-select"></select>
    <button id="${team}-place-${index}">Поставить</button>
  `;
  // заполним нации
  const nationSel = row.querySelector(`#${nationId}`);
  NATIONS.forEach(n => {
    const o = createEl('option'); o.value = n; o.textContent = n.toUpperCase(); nationSel.appendChild(o);
  });
  // при смене нации обновим полки
  const regSel = row.querySelector(`#${regId}`);
  function fillRegOptions(nation){
    regSel.innerHTML = '';
    const regs = REG_NAMES[nation] || {};
    // добавляем до 17
    for(let i=1;i<=17;i++){
      const opt = createEl('option');
      opt.value = `reg${i}.png`;
      opt.textContent = (regs[i] || `Полк ${i}`);
      regSel.appendChild(opt);
    }
  }
  fillRegOptions(nationSel.value);
  nationSel.addEventListener('change', ()=> fillRegOptions(nationSel.value));

  // кнопка поставить
  const btn = row.querySelector(`#${team}-place-${index}`);
  btn.addEventListener('click', ()=>{
    const nick = (row.querySelector(`#${nickId}`).value || `Игрок ${index}`);
    const nation = row.querySelector(`#${nationId}`).value;
    const regiment = row.querySelector(`#${regId}`).value;
    placeMarker(nick, nation, regiment, team, index-1); // store 0-based index internally
  });

  return row;
}

for(let i=1;i<=5;i++){
  RED_PLAYERS.appendChild(makePlayerRow('red', i));
  BLUE_PLAYERS.appendChild(makePlayerRow('blue', i));
}

//------------ Управление маркерами + SYNC ------------
function generateMarkerId(team, idx){ return `${team}-${idx}`; }

// создаём divIcon с <img onerror=...> чтобы показывать заглушку если не нашлось
function createRegDivIcon(nick, nation, regimentFile, team) {
  const iconUrl = `${ICON_FOLDER}${nation}/${regimentFile}`;
  const size = 56;

  // Назначаем класс в зависимости от выбранной команды
  const teamClass =
    team === 'blue' ? 'blue-marker' : team === 'red' ? 'red-marker' : '';

  const html = `
    <div class="mw2-reg ${teamClass}">
      <img src="${iconUrl}" 
           onerror="this.src='${PLACEHOLDER_SVG}'; this.style.width='56px'; this.style.height='56px'"
           style="width:${size}px;height:${size}px;object-fit:contain;" />
      <div class="mw2-label">${escapeHtml(nick)}</div>
    </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size + 18],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
  });
}

function placeMarker(nick, nation, regimentFile, team, playerIndex){
  const id = generateMarkerId(team, playerIndex);

  // удалим старый маркер этого игрока, если есть
  const existingIndex = markerList.findIndex(m => m.id === id);
  if (existingIndex !== -1) {
    try { map.removeLayer(markerList[existingIndex].marker); } catch(e){}
    markerList.splice(existingIndex, 1);
    // Удаляем из store
    delete getCurrentEchelonState()[id];
  }

  // позиция: центр карты (или центр изображения)
  const pos = map.getCenter();
  const icon = createRegDivIcon(nick, nation, regimentFile, team);
  const marker = L.marker(pos, { icon, draggable: true }).addTo(map);

  // SYNC: Assign ID and handlers
  marker.entityId = id;
  marker.entityType = 'player_marker';

  marker.on('dragend', debounce(() => {
    const newLatLng = marker.getLatLng();
    firebaseUpdateEntity(id, { latlng: newLatLng }, currentEchelon);
    getCurrentEchelonState()[id].localUpdatedAt = Date.now();
  }, 250, `drag_${id}`));

  const entity = {
    id: id,
    type: 'player_marker',
    data: { ownerNick: nick, nation, regimentFile, team, playerIndex, latlng: pos },
    updatedAt: Date.now(),
    echelon: currentEchelon
  };

  try {
    firebaseCreateEntity(entity, currentEchelon);
    getCurrentEchelonState()[id] = { data: entity.data, localUpdatedAt: entity.updatedAt, layer: marker };
  } catch(e) { console.warn(e); }

  const entry = { id, team, playerIndex, nick, nation, regimentFile, marker };
  markerList.push(entry);
}

//------------ Кнопки готовых символов ------------
$id('btnFront').addEventListener('click', ()=>{
  if(!imageBounds) return alert('Загрузите карту перед добавлением символов (кнопка "Загрузить карту").');
  // фронт: прямая линия через центр горизонтально
  const b = imageBounds;
  const y = (b[0][0] + b[1][0]) / 2;
  const left = [y, b[0][1]];
  const right = [y, b[1][1]];
  const color = getDrawColor();
  const weight = getDrawWeight();
  const line = L.polyline([left, right], { color, weight }).addTo(drawnItems);
  
  // SYNC: Автоматически добавляется через draw:created
});

//-------------Сохранение и загрузка состояния эшелона----------

function saveCurrentEchelonState() {
  echelonStates[currentEchelon] = {
    markers: markerList.map(m => ({
      id: m.id,
      team: m.team,
      playerIndex: m.playerIndex,
      nick: m.nick,
      nation: m.nation,
      regimentFile: m.regimentFile,
      latlng: m.marker.getLatLng()
    })),
    simple: simpleMarkers.map(m => {
      const latlng = m.getLatLng ? m.getLatLng() : {lat:0,lng:0};
      const type = m._symbName || m._simpleType || null;
      const html = m.getElement ? m.getElement().innerHTML : '';
      return { latlng, type, html };
    }),
    drawings: (() => {
      const drawings = [];
      drawnItems.eachLayer(layer=>{
        try{
          if(layer instanceof L.Polyline && !(layer instanceof L.Polygon)){
            drawings.push({type:'polyline', latlngs: layer.getLatLngs().map(p=>({lat:p.lat,lng:p.lng})), options: pickLayerOptions(layer)});
          } else if(layer instanceof L.Polygon){
            const rings = layer.getLatLngs();
            const latlngs = Array.isArray(rings[0]) ? rings[0].map(p=>({lat:p.lat,lng:p.lng})) : rings.map(p=>({lat:p.lat,lng:p.lng}));
            drawings.push({type:'polygon', latlngs, options: pickLayerOptions(layer)});
          } else if(layer instanceof L.Circle){
            drawings.push({type:'circle', center: layer.getLatLng(), radius: layer.getRadius(), options: pickLayerOptions(layer)});
          }
        } catch(e){console.warn('serialize drawing error', e);}
      });
      return drawings;
    })()
  };
}

function loadEchelonState(echelon) {
  if(!echelonStates[echelon]) return;
  const state = echelonStates[echelon];

  // очистить текущее (но сохраняем entityStore для sync)
  drawnItems.clearLayers();
  markerList.forEach(m => { try { map.removeLayer(m.marker); } catch(e){} });
  markerList = [];
  simpleMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  simpleMarkers = [];

  // восстановить (sync handlers добавятся автоматически)
  (state.markers||[]).forEach(m=>{
    const pos = m.latlng || {lat:0,lng:0};
    const marker = L.marker([pos.lat,pos.lng], { icon:createRegDivIcon(m.nick,m.nation,m.regimentFile,m.team), draggable:true }).addTo(map);
    marker.entityId = m.id;
    marker.entityType = 'player_marker';
    markerList.push({...m, marker});
  });

  (state.simple||[]).forEach(s=>{
    const latlng = s.latlng || {lat:0,lng:0};
    let marker;
    if(s.type && ICON_NAMES.includes(s.type)){
      marker = addCustomIcon(`assets/symbols/${s.type}.png`, latlng);
      marker._symbName = s.type;
    } else {
      marker = L.marker([latlng.lat, latlng.lng], {
        icon: L.divIcon({ html: s.html || '', className: 'symbol-marker' }),
        draggable: true
      }).addTo(map);
    }
    simpleMarkers.push(marker);
  });

  (state.drawings||[]).forEach(d=>{
    try{
      if(d.type==='polyline') L.polyline(d.latlngs.map(p=>[p.lat,p.lng]), d.options||{}).addTo(drawnItems);
      else if(d.type==='polygon') L.polygon(d.latlngs.map(p=>[p.lat,p.lng]), d.options||{}).addTo(drawnItems);
      else if(d.type==='circle') L.circle([d.center.lat,d.center.lng], { radius:d.radius, ...(d.options||{}) }).addTo(drawnItems);
    } catch(e){console.warn('Ошибка восстановления рисунка:',e);}
  });
}

//------------ Ластик и очистка ------------
$id('btnEraser').addEventListener('click', ()=>{
  if(!confirm('Удалить ВСЕ рисунки на карте?')) return;
  drawnItems.clearLayers();
  // SYNC: Удаляем все drawing entities
  const state = getCurrentEchelonState();
  Object.keys(state).forEach(id => {
    if (state[id].entityType === 'drawing') {
      firebaseDeleteEntity(id, currentEchelon);
      delete state[id];
    }
  });
});

$id('btnClearAll').addEventListener('click', ()=>{
  if(!confirm('Очистить карту полностью? (иконки и рисунки)')) return;
  // удалить маркеры
  markerList.forEach(m => { try { map.removeLayer(m.marker); } catch(e){} });
  markerList = [];
  // удалить простые символы
  simpleMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  simpleMarkers = [];
  // удалить рисунки
  drawnItems.clearLayers();
  
  // SYNC: Удаляем все entities
  const state = getCurrentEchelonState();
  Object.keys(state).forEach(id => {
    firebaseDeleteEntity(id, currentEchelon);
  });
  entityStore[currentEchelon] = {};
});

//------------ Полоса толщины (связываем с UI) ------------
$id('drawWeight').addEventListener('input', (e)=>{
  $id('weightVal').textContent = e.target.value;
});

// ------------ Сохранение плана в JSON (обновлено с учётом эшелонов) ------------
$id('btnSave').addEventListener('click', () => {
  if (!currentMapFile && !confirm('Карта не загружена. Сохранить план без карты?')) return;

  // Перед сохранением актуализируем текущий эшелон
  saveCurrentEchelonState();

  const plan = {
    meta: {
      createdAt: new Date().toISOString(),
      mapFile: currentMapFile || null,
      echelonCount: ECHELON_COUNT
    },
    echelons: {},
    mapState: { center: map.getCenter(), zoom: map.getZoom() }
  };

  // Сохраняем данные по каждому эшелону
  for (let e = 1; e <= ECHELON_COUNT; e++) {
    const state = echelonStates[e];
    if (!state) continue;

    plan.echelons[e] = {
      markers: state.markers || [],
      simple: state.simple || [],
      drawings: state.drawings || []
    };
  }

  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (currentMapFile || 'plan').replace(/\.[^/.]+$/, '') + '_plan.json';
  a.click();
  URL.revokeObjectURL(a.href);
});


// ------------ Загрузка плана из JSON (обновлено с учётом эшелонов) ------------
function loadPlanData(plan) {
  if (!plan) return;

  const mapFile = plan.meta?.mapFile || 'map1.jpg';
  if (mapSelect) mapSelect.value = mapFile;

  loadMapByFile(mapFile).then(() => {
    // Если план содержит эшелоны
    if (plan.echelons) {
      // Восстанавливаем все эшелоны
      for (let e = 1; e <= (plan.meta?.echelonCount || 3); e++) {
        const state = plan.echelons[e];
        if (!state) continue;
        echelonStates[e] = {
          markers: (state.markers || []).map(m => ({
            ...m,
            marker: null // создадим позже при активации эшелона
          })),
          simple: state.simple || [],
          drawings: state.drawings || []
        };
      }

      // Загружаем первый эшелон по умолчанию
      currentEchelon = 1;
      loadEchelonState(currentEchelon);
    } else {
      // Старые планы без эшелонов — грузим как один общий эшелон
      echelonStates = {
        1: {
          markers: plan.markers || [],
          simple: plan.simple || [],
          drawings: plan.drawings || []
        },
        2: { markers: [], simple: [], drawings: [] },
        3: { markers: [], simple: [], drawings: [] }
      };
      currentEchelon = 1;
      loadEchelonState(1);
    }

    // Восстанавливаем позицию карты
    if (plan.mapState && plan.mapState.center && plan.mapState.zoom)
      map.setView(plan.mapState.center, plan.mapState.zoom);

    alert('✅ План успешно загружен!');
  }).catch(err => {
    console.error('Ошибка при загрузке карты:', err);
    alert('Ошибка при загрузке карты/плана: ' + (err.message || err));
  });
}

// === Обработчик кнопки загрузки плана ===
document.getElementById("loadPlan").addEventListener("click", () => {
  const input = document.getElementById("planFileInput");
  input.value = null; // сброс предыдущего выбора
  input.click();
});

document.getElementById("planFileInput").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      loadPlanData(data);  // <-- функция загрузки плана
    } catch(err) {
      console.error(err);
      alert("Ошибка при загрузке файла плана!");
    } finally {
      e.target.value = null; // сброс input после загрузки
    }
  };
  reader.readAsText(file);
});

map.attributionControl.setPrefix(false); // убирает "Leaflet"
map.attributionControl.addAttribution(''); // очищает оставшийся текст

$id('btnFillLower').addEventListener('click', () => {
  if (!imageBounds) return alert('Сначала загрузите карту.');

  const color = getDrawColor();

  const top = imageBounds[0][0];    // верх карты = 0
  const bottom = imageBounds[1][0]; // низ карты = высота изображения
  const left = imageBounds[0][1];   // левый край = 0
  const right = imageBounds[1][1];  // правый край = ширина изображения

  const midY = (top + bottom) / 2;

  L.polygon([
    [midY, left],    // середина слева
    [midY, right],   // середина справа
    [bottom, right], // низ справа
    [bottom, left]   // низ слева
  ], {
    color: color,
    weight: 2,
    fillColor: color,
    fillOpacity: 0.10
  }).addTo(drawnItems);
  // SYNC: Автоматически через draw:created
});

let assaultTimer = null;

function toggleAssault() {
  if (assaultTimer) {
    clearInterval(assaultTimer);
    assaultTimer = null;
    alert("Наступление остановлено");
    return;
  }

  if (!imageBounds) return alert("Сначала загрузите карту!");

  const top = imageBounds[0][0];    // верх карты
  const bottom = imageBounds[1][0]; // низ карты
  const left = imageBounds[0][1];
  const right = imageBounds[1][1];

  const waveInterval = 30000;  // каждые 30 секунд
  const frontDuration = 8000;  // длительность движения

  function spawnArrowSVG() {
    const xMid = left + Math.random() * (right - left); // случайно по горизонтали
    const yStart = bottom - 5;                           // чуть выше низа
    const yEnd = top + (bottom - top) * 0.45;           // чуть ниже верхнего края / до середины

    // SVG стрелка (вершина стрелки смотрит вверх)
    const svg = `
      <svg width="40" height="60" viewBox="0 0 40 60" xmlns="http://www.w3.org/2000/svg">
        <polygon points="20,60 35,10 20,20 5,10" fill="#ff3300" fill-opacity="0.35"/>
      </svg>
    `;

    const icon = L.divIcon({
      html: svg,
      className: 'assault-arrow',
      iconSize: [40, 60],
      iconAnchor: [20, 60], // нижняя точка стрелки на маркере
    });

    const marker = L.marker([yStart, xMid], { icon, interactive: false }).addTo(drawnItems);

    const startTime = performance.now();
    function animate() {
      const now = performance.now();
      const progress = Math.min((now - startTime) / frontDuration, 1);
      const newY = yStart - (yStart - yEnd) * progress; // движение вверх

      marker.setLatLng([newY, xMid]);

      if (progress < 1) requestAnimationFrame(animate);
      else setTimeout(() => drawnItems.removeLayer(marker), 2000);
    }
    requestAnimationFrame(animate);
  }

  // первый запуск сразу
  spawnArrowSVG();
  assaultTimer = setInterval(spawnArrowSVG, waveInterval);
}

// кнопка
document.getElementById("btnAssault").addEventListener("click", toggleAssault);

// ------------ Сохранить карту как изображение (исправлено: без сдвигов полигонов) ------------

function saveMapAsScreenshot() {
  if (!imageOverlay) return alert("Карта не загружена — нечего сохранять!");

  const mapContainer = document.getElementById('map');

  // Скрываем всплывающие окна Leaflet (если есть)
  const tooltips = mapContainer.querySelectorAll('.leaflet-tooltip');
  tooltips.forEach(t => t.style.display = 'none');

  html2canvas(mapContainer, {
    backgroundColor: null,
    useCORS: true,
    allowTaint: true,
    scale: 2 // повышаем разрешение
  }).then(canvas => {
    // Восстанавливаем tooltips
    tooltips.forEach(t => t.style.display = '');

    const link = document.createElement('a');
    const fileName = currentMapFile
      ? currentMapFile.replace(/\.[^/.]+$/, '') + '_plan.png'
      : 'map_plan.png';
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => {
    console.error("Ошибка при создании скриншота карты:", err);
    alert("Не удалось сохранить карту как изображение.");
  });
}

// Привязка к кнопке
document.getElementById('btnSaveImage').addEventListener('click', saveMapAsScreenshot);

window.addEventListener('remoteEntityAdded', (e)=> {
  const entity = e.detail.entity;
  // Создаём маркер из entity (пример для player_marker)
  if (entity.type === 'player_marker') {
    const data = entity.data;
    const marker = L.marker(data.latlng, { icon: createRegDivIcon(data.ownerNick, data.nation, data.regimentFile, data.team), draggable: true }).addTo(map);
    marker.on('dragend', () => firebaseUpdateEntity(entity.id, { latlng: marker.getLatLng() }));
    markerList.push({ id: entity.id, ...data, marker });
  } // Добавь для simple_symbol и drawing аналогично
});
window.addEventListener('remoteEntityChanged', (e)=> {
  const entity = e.detail.entity;
  const existing = markerList.find(m => m.id === entity.id);
  if (existing) existing.marker.setLatLng(entity.data.latlng);
  // Аналогично для simpleMarkers и drawnItems
});
window.addEventListener('remoteEntityRemoved', (e)=> {
  const id = e.detail.id;
  const existingIndex = markerList.findIndex(m => m.id === id);
  if (existingIndex !== -1) {
    map.removeLayer(markerList[existingIndex].marker);
    markerList.splice(existingIndex, 1);
  }
  // Аналогично для simpleMarkers и drawnItems
});