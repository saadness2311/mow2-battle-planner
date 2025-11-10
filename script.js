
// script_translated.js
// Translations-enabled version of the original script.js
// Language switcher (ru / en) and translated label objects added.

(function(){
/* ------------------ Language / i18n ------------------ */
let currentLang = localStorage.getItem('mow2_lang') || 'ru';

const UI_TRANSLATIONS = {
  langButton_ru: { ru: '🇷🇺 Русский', en: '🇷🇺 Russian' },
  langButton_en: { ru: '🇬🇧 Английский', en: '🇬🇧 English' },

  selectMapLabel: { ru: 'Выберите карту:', en: 'Select map:' },
  loadMapBtn: { ru: 'Загрузить карту', en: 'Load map' },
  resetMapBtn: { ru: 'Сбросить карту', en: 'Reset map' },

  teamsTitle: { ru: 'Команды', en: 'Teams' },
  blueTeam: { ru: 'Синие', en: 'Blue' },
  redTeam: { ru: 'Красные', en: 'Red' },

  drawToolsTitle: { ru: 'Инструменты рисования', en: 'Drawing tools' },
  colorLabel: { ru: 'Цвет:', en: 'Color:' },
  thicknessLabel: { ru: 'Толщина:', en: 'Thickness:' },
  frontLineBtn: { ru: 'Нанести линию фронта', en: 'Draw front line' },
  enemyZoneBtn: { ru: 'Нанести область противника', en: 'Fill enemy area' },
  enemyAssaultBtn: { ru: 'Наступление противника', en: "Enemy assault" },
  eraseFrontBtn: { ru: 'Очистить фронт', en: 'Erase front' },
  clearAllBtn: { ru: 'Очистить карту', en: 'Clear map' },
  savePlanBtn: { ru: 'Сохранить план', en: 'Save plan' },
  saveImageBtn: { ru: 'Сохранить карту как .jpg', en: 'Save map as .jpg' },
  loadPlanBtn: { ru: 'Загрузить план', en: 'Load plan' },
  noteText: { ru: 'Инструменты рисования находятся на панели карты. Нужно нажимать "edit" и менять линию фронта. Нужно сохранять изменения "save". Автор — saadness', en: 'Drawing tools are on the map panel. Press "edit" to modify front lines. Save changes with "save". Author — saadness' },

  chooseMapAlert: { ru: 'Выберите карту в списке.', en: 'Please select a map from the list.' },
  mapNotLoadedConfirmSave: { ru: 'Карта не загружена. Сохранить план без карты?', en: 'Map not loaded. Save plan without map?' },
  cantLoadMapError: { ru: 'Не удалось загрузить файл карты: ', en: 'Failed to load map file: ' },

  loadPlanError: { ru: 'Ошибка при загрузке файла плана!', en: 'Error loading plan file!' },
  planLoadedOk: { ru: '✅ План успешно загружен!', en: '✅ Plan loaded successfully!' },

  removeSymbolConfirm: { ru: 'Удалить этот символ?', en: 'Delete this symbol?' },
  removeAllDrawingsConfirm: { ru: 'Удалить ВСЕ рисунки на карте?', en: 'Delete ALL drawings on the map?' },
  clearMapConfirm: { ru: 'Очистить карту полностью? (иконки и рисунки)', en: 'Clear the map completely? (icons and drawings)' },

  assaultStopped: { ru: 'Наступление остановлено', en: 'Assault stopped' },
  loadMapFirst: { ru: 'Сначала загрузите карту.', en: 'Load the map first.' },

  copyToEchelon: { ru: 'Скопировано в эшелон ', en: 'Copied to echelon ' },

  saveScreenshotNoMap: { ru: 'Карта не загружена — нечего сохранять!', en: 'Map not loaded — nothing to save!' },

  ok: { ru: 'OK', en: 'OK' }
};

function tUi(key){
  const item = UI_TRANSLATIONS[key];
  if(!item) return key;
  return item[currentLang] || item.ru;
}

function setLanguage(lang){
  currentLang = lang;
  localStorage.setItem('mow2_lang', lang);

  // update lang toggle button (exists in HTML)
  const langBtn = document.getElementById('langToggle');
  if(langBtn){
    langBtn.textContent = (lang === 'ru') ? UI_TRANSLATIONS.langButton_ru.ru : UI_TRANSLATIONS.langButton_en.en;
  }

  // translate all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if(UI_TRANSLATIONS[key]){
      const txt = UI_TRANSLATIONS[key][lang] || UI_TRANSLATIONS[key].ru;
      // preserve input children inside label
      if(el.tagName.toLowerCase() === 'label' && el.querySelector('input')){
        // replace text nodes only (before input)
        const inputs = Array.from(el.querySelectorAll('input, select, button'));
        // set label innerText except inputs: simpler to set firstChild text
        el.childNodes.forEach(node => {
          if(node.nodeType === Node.TEXT_NODE){
            node.nodeValue = txt + ' ';
          }
        });
      } else {
        el.textContent = txt;
      }
    }
  });

  // update dynamic UI pieces that are created by JS (echelon label)
  updateEchelonLabel();
  // update any existing tooltips (we rely on lazy tooltip binding when creating markers)
  // For existing markers that have tooltip bound, update tooltip content if possible
  updateAllTooltips();
}

function translateString(objOrStr){
  // If it's already an object with ru/en, pick accordingly
  if(objOrStr && typeof objOrStr === 'object' && 'ru' in objOrStr){
    return objOrStr[currentLang] || objOrStr.ru;
  }
  // Otherwise if it's a string, attempt to find translation in UI_TRANSLATIONS values
  return (objOrStr || '');
}

/* ------------------ Helper for labels stored as objects ------------------ */

// ICON_LABELS, ICON_SHORT and REG_NAMES converted to objects {ru, en}
const ICON_LABELS = {
  symb1:  { ru: 'Бронеавтомобиль', en: 'Armored Car' },
  symb2:  { ru: 'Гаубица', en: 'Howitzer' },
  symb3:  { ru: 'Противотанковая пушка', en: 'Anti-Tank Gun' },
  symb4:  { ru: 'Противовоздушная оборона', en: 'Air Defense' },
  symb5:  { ru: 'Основная пехота', en: 'Infantry' },
  symb6:  { ru: 'Тяжелая пехота', en: 'Heavy Infantry' },
  symb7:  { ru: 'Специальная пехота', en: 'Special Infantry' },
  symb8:  { ru: 'Вспомогательная пехота', en: 'Auxiliary Infantry' },
  symb9:  { ru: 'Подразделение поддержки', en: 'Support Unit' },
  symb10: { ru: 'Тяжелый танк', en: 'Heavy Tank' },
  symb11: { ru: 'Противотанковая САУ', en: 'Self-Propelled Tank Destroyer' },
  symb12: { ru: 'Легкий танк', en: 'Light Tank' },
  symb13: { ru: 'Средний танк', en: 'Medium Tank' },
  symb14: { ru: 'Штурмовая САУ', en: 'Assault Gun' },
  symb15: { ru: 'Самостоятельный пехотный отряд', en: 'Independent Infantry Squad' },
  symb16: { ru: 'Парашютисты', en: 'Paratroopers' },
  symb17: { ru: 'Фронтовая авиация', en: 'Frontline Aviation' },
  symb18: { ru: 'Вспомогательная техника', en: 'Support Vehicle' }
};

// SHORT labels
const ICON_SHORT = {
  symb1:  { ru: 'Бронеавто', en: 'ArmCar' },
  symb2:  { ru: 'Гаубица', en: 'Howz' },
  symb3:  { ru: 'ПТ пушка', en: 'AT gun' },
  symb4:  { ru: 'ПВО', en: 'AA' },
  symb5:  { ru: 'Пехота', en: 'Inf' },
  symb6:  { ru: 'Тяж. пех.', en: 'HeavyInf' },
  symb7:  { ru: 'Спецпех.', en: 'SpecInf' },
  symb8:  { ru: 'Всп. пех.', en: 'AuxInf' },
  symb9:  { ru: 'Поддержка', en: 'Support' },
  symb10: { ru: 'Тяж. танк', en: 'HeavyT' },
  symb11: { ru: 'ПТ САУ', en: 'AT SPG' },
  symb12: { ru: 'Лёг. танк', en: 'LightT' },
  symb13: { ru: 'Сред. танк', en: 'MedT' },
  symb14: { ru: 'Штурм. САУ', en: 'Assault SPG' },
  symb15: { ru: 'Пех. отряд', en: 'Inf Squad' },
  symb16: { ru: 'Десант', en: 'Airborne' },
  symb17: { ru: 'Авиация', en: 'Aviation' },
  symb18: { ru: 'Всп. тех.', en: 'SupportVeh' }
};

// REG_NAMES converted to objects (for germany, usa, ussr)
const REG_NAMES = {
  germany: {
    1: { ru: "Самоходный", en: "Self-propelled" },
    2: { ru: "Развед", en: "Recon" },
    3: { ru: "Механка", en: "Mechanized" },
    4: { ru: "Гаубицы", en: "Howitzers" },
    5: { ru: "Моторизованная пехота", en: "Motorized Infantry" },
    6: { ru: "Огнеметный", en: "Flamethrower" },
    7: { ru: "ПВО", en: "AA" },
    8: { ru: "Саперка", en: "Sappers" },
    9: { ru: "Гренадерский", en: "Grenadier" },
    10:{ ru: "Минометный", en: "Mortar" },
    11:{ ru: "Штурмовой", en: "Assault" },
    12:{ ru: "Тяжелый танковый", en: "Heavy Tank" },
    13:{ ru: "Противотанковый", en: "Antitank" },
    14:{ ru: "Средний танковый", en: "Medium Tank" },
    15:{ ru: "Первый артиллерийский", en: "1st Artillery" },
    16:{ ru: "Первый пехотный", en: "1st Infantry" },
    17:{ ru: "Первый танковый", en: "1st Tank" }
  },
  usa: {
    1: { ru: "Самоходный", en: "Self-propelled" },
    2: { ru: "Развед", en: "Recon" },
    3: { ru: "Механка", en: "Mechanized" },
    4: { ru: "Гаубицы", en: "Howitzers" },
    5: { ru: "Моторизованная пехота", en: "Motorized Infantry" },
    6: { ru: "Огнеметный", en: "Flamethrower" },
    7: { ru: "ПВО", en: "AA" },
    8: { ru: "Десантный", en: "Airborne" },
    9: { ru: "Тяжелый танковый", en: "Heavy Tank" },
    10:{ ru: "Минометный", en: "Mortar" },
    11:{ ru: "Саперный", en: "Sapper" },
    12:{ ru: "Средний танковый", en: "Medium Tank" },
    13:{ ru: "Противотанковый", en: "Antitank" },
    14:{ ru: "Штурмовой", en: "Assault" },
    15:{ ru: "Первый артиллерийский", en: "1st Artillery" },
    16:{ ru: "Первый пехотный", en: "1st Infantry" },
    17:{ ru: "Первый танковый", en: "1st Tank" }
  },
  ussr: {
    1: { ru: "Самоходный", en: "Self-propelled" },
    2: { ru: "Развед", en: "Recon" },
    3: { ru: "Механка", en: "Mechanized" },
    4: { ru: "Гаубицы", en: "Howitzers" },
    5: { ru: "Моторизованная пехота", en: "Motorized Infantry" },
    6: { ru: "Огнеметный", en: "Flamethrower" },
    7: { ru: "ПВО", en: "AA" },
    8: { ru: "Саперка", en: "Sappers" },
    9: { ru: "Тяжелый танковый", en: "Heavy Tank" },
    10:{ ru: "Минометный", en: "Mortar" },
    11:{ ru: "Штурмовой", en: "Assault" },
    12:{ ru: "Средний танковый", en: "Medium Tank" },
    13:{ ru: "Противотанковый", en: "Antitank" },
    14:{ ru: "88-ой штурмовой", en: "88th Assault" },
    15:{ ru: "Первый артиллерийский", en: "1st Artillery" },
    16:{ ru: "Первый пехотный", en: "1st Infantry" },
    17:{ ru: "Первый танковый", en: "1st Tank" }
  }
};

/* ------------------ Utility helpers ------------------ */
function $id(id){ return document.getElementById(id); }
function createEl(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

function getLabelForSymbol(key){
  // prefer short label if exists
  if(ICON_SHORT[key]) return ICON_SHORT[key][currentLang] || ICON_SHORT[key].ru;
  if(ICON_LABELS[key]) return ICON_LABELS[key][currentLang] || ICON_LABELS[key].ru;
  return key;
}

function getLongLabelForSymbol(key){
  if(ICON_LABELS[key]) return ICON_LABELS[key][currentLang] || ICON_LABELS[key].ru;
  return key;
}

function getRegName(nation, idx){
  const regs = REG_NAMES[nation] || {};
  const v = regs[idx];
  if(!v) return (currentLang === 'ru') ? `Полк ${idx}` : `Regiment ${idx}`;
  return v[currentLang] || v.ru;
}

/* ------------------ Original configuration (mostly unchanged) ------------------ */
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

//------------ Полезные утилиты ------------
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

let echelonLabelElement = null;

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
  leftBtn.title = (currentLang === 'ru') ? 'Предыдущий эшелон' : 'Previous echelon';

  const label = L.DomUtil.create('span','',container);
  label.textContent = `${(currentLang==='ru'?'Эшелон':'Echelon')} ${currentEchelon}/${ECHELON_COUNT}`;
  label.style.minWidth = '80px';
  label.style.textAlign = 'center';
  echelonLabelElement = label;

  const rightBtn = L.DomUtil.create('button','',container);
  rightBtn.innerHTML = '⟶';
  rightBtn.style.background = 'none';
  rightBtn.style.color = 'white';
  rightBtn.style.border = 'none';
  rightBtn.style.cursor = 'pointer';
  rightBtn.title = (currentLang === 'ru') ? 'Следующий эшелон' : 'Next echelon';

  const copyBtn = L.DomUtil.create('button','',container);
  copyBtn.innerHTML = '📋';
  copyBtn.style.background = 'none';
  copyBtn.style.color = 'white';
  copyBtn.style.border = 'none';
  copyBtn.style.cursor = 'pointer';
  copyBtn.title = (currentLang === 'ru') ? 'Копировать текущее состояние в следующий эшелон' : 'Copy current state to next echelon';

  // обработчики
  L.DomEvent.on(leftBtn, 'click', e => {
    L.DomEvent.stopPropagation(e);
    saveCurrentEchelonState();
    currentEchelon = currentEchelon <= 1 ? ECHELON_COUNT : currentEchelon - 1;
    loadEchelonState(currentEchelon);
    updateEchelonLabel();
  });

  L.DomEvent.on(rightBtn, 'click', e => {
    L.DomEvent.stopPropagation(e);
    saveCurrentEchelonState();
    currentEchelon = currentEchelon >= ECHELON_COUNT ? 1 : currentEchelon + 1;
    loadEchelonState(currentEchelon);
    updateEchelonLabel();
  });

  L.DomEvent.on(copyBtn, 'click', e => {
    L.DomEvent.stopPropagation(e);
    saveCurrentEchelonState();
    const next = currentEchelon >= ECHELON_COUNT ? 1 : currentEchelon + 1;
    echelonStates[next] = JSON.parse(JSON.stringify(echelonStates[currentEchelon]));
    alert( (currentLang==='ru' ? 'Скопировано в эшелон ' : 'Copied to echelon ') + next );
  });

  return container;
};

map.addControl(echelonControl);

function updateEchelonLabel(){
  if(echelonLabelElement){
    echelonLabelElement.textContent = `${(currentLang==='ru'?'Эшелон':'Echelon')} ${currentEchelon}/${ECHELON_COUNT}`;
  }
}

// When a new shape is created via Draw, apply current color/weight and add to drawnItems
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
    layer.setStyle && layer.setStyle({ color: getDrawColor(), weight: getDrawWeight() });
  }
  drawnItems.addLayer(layer);
});

// Ensure edits keep styles intact (nothing special needed, but keep handler)
map.on(L.Draw.Event.EDITED, function (e) {});
map.on(L.Draw.Event.DELETED, function (e) {});

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

    const tabNames = { unit: (currentLang==='ru'?'Арм':'Unit'), engineer: (currentLang==='ru'?'Инж':'Eng'), signs: (currentLang==='ru'?'Сим':'Signs') };
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
        const title = getLongLabelForSymbol(name) || name;
        btn.innerHTML = `<img src="assets/symbols/${name}.png" 
                          alt="${name}" 
                          title="${escapeHtml(title)}" 
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

// === addSimpleSymbol с масштабируемыми иконками ===
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

  // НЕ добавляем tooltip для простых символов
  marker._simpleType = type; // чтобы при сохранении/загрузке восстановить тип

  marker.on('click', () => {
    if(confirm( (currentLang==='ru'?'Удалить этот символ?':'Delete this symbol?') )){
      map.removeLayer(marker);
      const idx = simpleMarkers.indexOf(marker);
      if(idx!==-1) simpleMarkers.splice(idx,1);
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

  try {
    const file = String(url).split('/').pop() || '';
    const key = file.replace(/\.[^/.]+$/, '');
    marker._symbName = key;

    // compute a string label safely whether ICON_LABELS entries are objects or strings
    let label = key;
    if (ICON_SHORT[key]) {
      label = (typeof ICON_SHORT[key] === 'string') ? ICON_SHORT[key] :
              (ICON_SHORT[key][currentLang] || ICON_SHORT[key].ru);
    } else if (ICON_LABELS[key]) {
      label = (typeof ICON_LABELS[key] === 'string') ? ICON_LABELS[key] :
              (ICON_LABELS[key][currentLang] || ICON_LABELS[key].ru);
    }

    // bind tooltip (if marker already has one, update it)
    // skip tooltips for unit (Арм) and signs (Сим) categories as in original behavior
    let skip = false;
    try { if (ICON_CATEGORIES && ICON_CATEGORIES.engineer && ICON_CATEGORIES.engineer.includes(key)) skip = true; } catch(e){}
    try { if (ICON_CATEGORIES && ICON_CATEGORIES.signs && ICON_CATEGORIES.signs.includes(key)) skip = true; } catch(e){}
    if (!skip) {
      if (marker.getTooltip && marker.getTooltip()) {
        marker.setTooltipContent && marker.setTooltipContent(label);
      } else {
        marker.bindTooltip(label, {
          permanent: false,
          direction: "top",
          offset: [0, -26],
          opacity: 0.95,
          className: 'symb-tooltip'
        });
      }
    }
  } catch (e) { console.warn('tooltip bind error', e); }

  marker.on('click', () => {
    if (confirm(currentLang==='ru'?'Удалить этот символ?':'Delete this symbol?')) {
      map.removeLayer(marker);
      const idx = simpleMarkers.indexOf(marker);
      if (idx !== -1) simpleMarkers.splice(idx, 1);
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
      imageOverlay = L.imageOverlay(url, imageBounds).addTo(map);
      if (imageOverlay && typeof imageOverlay.bringToBack === 'function') {
        imageOverlay.bringToBack();
      }
      map.fitBounds(imageBounds);
      currentMapFile = fileName;
      resolve();
    };
    img.onerror = function(){
      reject(new Error( (currentLang==='ru'? UI_TRANSLATIONS.cantLoadMapError.ru : UI_TRANSLATIONS.cantLoadMapError.en) + url + '. Проверьте, что файл существует и название/регистр совпадают.' ));
    };
    img.src = url;
  });
}

$id('btnLoadMap') && $id('btnLoadMap').addEventListener('click', ()=> {
  const sel = mapSelect.value;
  if(!sel) return alert( tUi('chooseMapAlert') );
  loadMapByFile(sel).catch(err => alert(err.message));
});

$id('btnResetMap') && $id('btnResetMap').addEventListener('click', ()=> {
  if(imageOverlay) map.removeLayer(imageOverlay);
  imageOverlay = null; imageBounds = null; currentMapFile = null;
  map.setView([0,0], 0);
});

//------------ Создание UI для игроков (2 команды по 5) ------------
const RED_PLAYERS = $id('redPlayers');
const BLUE_PLAYERS = $id('bluePlayers');
const NATIONS = ['ussr','germany','usa'];

function makePlayerRow(team, index){
  const row = createEl('div','player-row');
  const nickId = `${team}-nick-${index}`;
  const nationId = `${team}-nation-${index}`;
  const regId = `${team}-reg-${index}`;
  row.innerHTML = `
    <input id="${nickId}" type="text" placeholder="${currentLang==='ru'?'Ник':'Nick'}" />
    <select id="${nationId}" class="nation-select"></select>
    <select id="${regId}" class="reg-select"></select>
    <button id="${team}-place-${index}">${currentLang==='ru'?'Поставить':'Place'}</button>
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
    for(let i=1;i<=17;i++){
      const opt = createEl('option');
      opt.value = `reg${i}.png`;
      opt.textContent = getRegName(nation, i);
      regSel.appendChild(opt);
    }
  }
  fillRegOptions(nationSel.value);
  nationSel.addEventListener('change', ()=> fillRegOptions(nationSel.value));

  // кнопка поставить
  const btn = row.querySelector(`#${team}-place-${index}`);
  btn.addEventListener('click', ()=> {
    const nick = (row.querySelector(`#${nickId}`).value || (currentLang==='ru' ? `Игрок ${index}` : `Player ${index}`));
    const nation = row.querySelector(`#${nationId}`).value;
    const regiment = row.querySelector(`#${regId}`).value;
    placeMarker(nick, nation, regiment, team, index-1); // store 0-based index internally
  });

  return row;
}

for(let i=1;i<=5;i++){
  RED_PLAYERS && RED_PLAYERS.appendChild(makePlayerRow('red', i));
  BLUE_PLAYERS && BLUE_PLAYERS.appendChild(makePlayerRow('blue', i));
}

//------------ Управление маркерами ------------
function generateMarkerId(team, idx){ return `${team}-${idx}`; }

function createRegDivIcon(nick, nation, regimentFile, team) {
  const iconUrl = `${ICON_FOLDER}${nation}/${regimentFile}`;
  const size = 56;

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

  const existingIndex = markerList.findIndex(m => m.id === id);
  if (existingIndex !== -1) {
    try { map.removeLayer(markerList[existingIndex].marker); } catch(e){}
    markerList.splice(existingIndex, 1);
  }

  const pos = map.getCenter();
  const icon = createRegDivIcon(nick, nation, regimentFile, team);
  const marker = L.marker(pos, { icon, draggable: true }).addTo(map);

  marker.on('dragend', ()=> {});

  const entry = { id, team, playerIndex, nick, nation, regimentFile, marker };
  markerList.push(entry);
}

//------------ Кнопки готовых символов ------------
$id('btnFront') && $id('btnFront').addEventListener('click', ()=> {
  if(!imageBounds) return alert( tUi('loadMapFirst') );
  const b = imageBounds;
  const y = (b[0][0] + b[1][0]) / 2;
  const left = [y, b[0][1]];
  const right = [y, b[1][1]];
  const color = getDrawColor();
  const weight = getDrawWeight();
  const line = L.polyline([left, right], { color, weight }).addTo(drawnItems);
});

$id('btnFillLower') && $id('btnFillLower').addEventListener('click', ()=> {
  if (!imageBounds) return alert( tUi('loadMapFirst') );

  const color = getDrawColor();

  const top = imageBounds[0][0];
  const bottom = imageBounds[1][0];
  const left = imageBounds[0][1];
  const right = imageBounds[1][1];

  const midY = (top + bottom) / 2;

  L.polygon([
    [midY, left],
    [midY, right],
    [bottom, right],
    [bottom, left]
  ], {
    color: color,
    weight: 2,
    fillColor: color,
    fillOpacity: 0.10
  }).addTo(drawnItems);
});

let assaultTimer = null;

function toggleAssault() {
  if (assaultTimer) {
    clearInterval(assaultTimer);
    assaultTimer = null;
    alert(tUi('assaultStopped'));
    return;
  }

  if (!imageBounds) return alert(tUi('loadMapFirst'));

  const top = imageBounds[0][0];
  const bottom = imageBounds[1][0];
  const left = imageBounds[0][1];
  const right = imageBounds[1][1];

  const waveInterval = 30000;
  const frontDuration = 8000;

  function spawnArrowSVG() {
    const xMid = left + Math.random() * (right - left);
    const yStart = bottom - 5;
    const yEnd = top + (bottom - top) * 0.45;

    const svg = `
      <svg width="40" height="60" viewBox="0 0 40 60" xmlns="http://www.w3.org/2000/svg">
        <polygon points="20,60 35,10 20,20 5,10" fill="#ff3300" fill-opacity="0.35"/>
      </svg>
    `;

    const icon = L.divIcon({
      html: svg,
      className: 'assault-arrow',
      iconSize: [40, 60],
      iconAnchor: [20, 60],
    });

    const marker = L.marker([yStart, xMid], { icon, interactive: false }).addTo(drawnItems);

    const startTime = performance.now();
    function animate() {
      const now = performance.now();
      const progress = Math.min((now - startTime) / frontDuration, 1);
      const newY = yStart - (yStart - yEnd) * progress;

      marker.setLatLng([newY, xMid]);

      if (progress < 1) requestAnimationFrame(animate);
      else setTimeout(() => drawnItems.removeLayer(marker), 2000);
    }
    requestAnimationFrame(animate);
  }

  spawnArrowSVG();
  assaultTimer = setInterval(spawnArrowSVG, waveInterval);
}

document.getElementById("btnAssault") && document.getElementById("btnAssault").addEventListener("click", toggleAssault);

// ------------ Сохранить план в JSON (обновлено с учётом эшелонов) ------------
$id('btnSave') && $id('btnSave').addEventListener('click', () => {
  if (!currentMapFile && !confirm( tUi('mapNotLoadedConfirmSave') )) return;

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
    if (plan.echelons) {
      for (let e = 1; e <= (plan.meta?.echelonCount || 3); e++) {
        const state = plan.echelons[e];
        if (!state) continue;
        echelonStates[e] = {
          markers: (state.markers || []).map(m => ({
            ...m,
            marker: null
          })),
          simple: state.simple || [],
          drawings: state.drawings || []
        };
      }

      currentEchelon = 1;
      loadEchelonState(currentEchelon);
    } else {
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

    if (plan.mapState && plan.mapState.center && plan.mapState.zoom)
      map.setView(plan.mapState.center, plan.mapState.zoom);

    alert( tUi('planLoadedOk') );
  }).catch(err => {
    console.error('Ошибка при загрузке карты:', err);
    alert( tUi('loadPlanError') );
  });
}

// === Обработчик кнопки загрузки плана ===
document.getElementById("loadPlan") && document.getElementById("loadPlan").addEventListener("click", () => {
  const input = document.getElementById("planFileInput");
  input.value = null;
  input.click();
});

document.getElementById("planFileInput") && document.getElementById("planFileInput").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      loadPlanData(data);
    } catch(err) {
      console.error(err);
      alert( tUi('loadPlanError') );
    } finally {
      e.target.value = null;
    }
  };
  reader.readAsText(file);
});

map.attributionControl.setPrefix(false);
map.attributionControl.addAttribution('');

// UI bindings
$id('btnEraser') && $id('btnEraser').addEventListener('click', ()=> {
  if(!confirm( tUi('removeAllDrawingsConfirm') )) return;
  drawnItems.clearLayers();
});

$id('btnClearAll') && $id('btnClearAll').addEventListener('click', ()=> {
  if(!confirm( tUi('clearMapConfirm') )) return;
  markerList.forEach(m => { try { map.removeLayer(m.marker); } catch(e){} });
  markerList = [];
  simpleMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  simpleMarkers = [];
  drawnItems.clearLayers();
});

$id('drawWeight') && $id('drawWeight').addEventListener('input', (e)=> {
  $id('weightVal').textContent = e.target.value;
});

// ------------ Сохранить карту как изображение ------------
function saveMapAsScreenshot() {
  if (!imageOverlay) return alert( tUi('saveScreenshotNoMap') );

  const mapContainer = document.getElementById('map');

  const tooltips = mapContainer.querySelectorAll('.leaflet-tooltip');
  tooltips.forEach(t => t.style.display = 'none');

  html2canvas(mapContainer, {
    backgroundColor: null,
    useCORS: true,
    allowTaint: true,
    scale: 2
  }).then(canvas => {
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
    alert( currentLang==='ru' ? 'Не удалось сохранить карту как изображение.' : 'Failed to save map as image.' );
  });
}

document.getElementById('btnSaveImage') && document.getElementById('btnSaveImage').addEventListener('click', saveMapAsScreenshot);

// ------------ Состояния эшелона (save/load) ------------
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

  drawnItems.clearLayers();
  markerList.forEach(m => { try { map.removeLayer(m.marker); } catch(e){} });
  markerList = [];
  simpleMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  simpleMarkers = [];

  (state.markers||[]).forEach(m=>{
    const pos = m.latlng || {lat:0,lng:0};
    const marker = L.marker([pos.lat,pos.lng], { icon:createRegDivIcon(m.nick,m.nation,m.regimentFile,m.team), draggable:true }).addTo(map);
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

// update existing tooltips for markers
function updateAllTooltips(){
  // Ensure all symbol markers have tooltips with current language labels.
  markerList.forEach(m => {
    try{
      const key = (m.marker && (m.marker._symbName || m.marker._simpleType)) || m._symbName || null;
      if(key){
        let skip = false;
        try{ if(ICON_CATEGORIES && ICON_CATEGORIES.engineer && ICON_CATEGORIES.engineer.includes(key)) skip = true; }catch(e){}
        try{ if(ICON_CATEGORIES && ICON_CATEGORIES.signs && ICON_CATEGORIES.signs.includes(key)) skip = true; }catch(e){}
        if(skip) return;
        if(ICON_LABELS[key]){
          const label = (ICON_SHORT[key] && (typeof ICON_SHORT[key] === 'string' ? ICON_SHORT[key] : (ICON_SHORT[key][currentLang] || ICON_SHORT[key].ru)))
                        || (typeof ICON_LABELS[key] === 'string' ? ICON_LABELS[key] : (ICON_LABELS[key][currentLang] || ICON_LABELS[key].ru));
          if (m.marker.getTooltip && m.marker.getTooltip()) {
            m.marker.setTooltipContent && m.marker.setTooltipContent(label);
          } else if (m.marker.bindTooltip) {
            m.marker.bindTooltip(label, { permanent:false, direction:"top", offset:[0,-26], opacity:0.95, className:'symb-tooltip' });
          }
        }
      }
    } catch(e){}
  });
  simpleMarkers.forEach(m=>{
    try{
      const key = m._symbName;
      if(key){
        let skip = false;
        try{ if(ICON_CATEGORIES && ICON_CATEGORIES.engineer && ICON_CATEGORIES.engineer.includes(key)) skip = true; }catch(e){}
        try{ if(ICON_CATEGORIES && ICON_CATEGORIES.signs && ICON_CATEGORIES.signs.includes(key)) skip = true; }catch(e){}
        if(skip) return;
        if(ICON_LABELS[key]){
          const label = (ICON_SHORT[key] && (typeof ICON_SHORT[key] === 'string' ? ICON_SHORT[key] : (ICON_SHORT[key][currentLang] || ICON_SHORT[key].ru)))
                        || (typeof ICON_LABELS[key] === 'string' ? ICON_LABELS[key] : (ICON_LABELS[key][currentLang] || ICON_LABELS[key].ru));
          if (m.getTooltip && m.getTooltip()) {
            m.setTooltipContent && m.setTooltipContent(label);
          } else if (m.bindTooltip) {
            m.bindTooltip(label, { permanent:false, direction:"top", offset:[0,-26], opacity:0.95, className:'symb-tooltip' });
          }
        }
      }
    } catch(e){}
  });
}


/* ------------------ init language UI ------------------ */
window.addEventListener('load', ()=> {
  // add language toggle if exists
  const btn = document.getElementById('langToggle');
  if(btn){
    btn.textContent = (currentLang==='ru') ? UI_TRANSLATIONS.langButton_ru.ru : UI_TRANSLATIONS.langButton_en.en;
    btn.addEventListener('click', ()=> {
      const newLang = (currentLang === 'ru') ? 'en' : 'ru';
      setLanguage(newLang);
      // update some dynamic pieces that depend on text values (player rows)
      // Rebuild player rows labels to update placeholders/button text
      // quick approach: rebuild player lists
      RED_PLAYERS.innerHTML = '';
      BLUE_PLAYERS.innerHTML = '';
      for(let i=1;i<=5;i++){
        RED_PLAYERS.appendChild(makePlayerRow('red', i));
        BLUE_PLAYERS.appendChild(makePlayerRow('blue', i));
      }
    });
  }

  setLanguage(currentLang);
});

})(); // end closure
