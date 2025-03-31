let map;
let connection;
let settings = {
  ip: "10.21.50.5",
  httpPort: 5025,
  wsPort: 2323,
  dispatcher: 1,
  encryptionKey: "defaultKey",
  userId: "user_" + Math.random().toString(36).substring(2, 9)
};

const API_URL = `http://${settings.ip}:${settings.httpPort}/api`;
let isMapView = true;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Инициализация темы
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.innerHTML = theme === "dark" 
      ? '<i class="fas fa-sun"></i>' 
      : '<i class="fas fa-moon"></i>';
  }
}

function toggleTheme() {
  const body = document.body;
  const isDark = body.getAttribute("data-theme") === "dark";
  const newTheme = isDark ? "light" : "dark";
  
  body.setAttribute("data-theme", newTheme);
  updateThemeIcon(newTheme);
  localStorage.setItem("theme", newTheme);
}

// Обновление времени и даты
function updateDateTime() {
  const now = new Date();
  const timeElement = document.getElementById("currentTime");
  const dateElement = document.getElementById("currentDate");
  
  if (timeElement) timeElement.textContent = now.toLocaleTimeString("ru-RU");
  if (dateElement) {
    dateElement.textContent = now.toLocaleDateString("ru-RU", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
}

// Модальные окна
function showModal(modalId) {
  const overlay = document.getElementById("overlay");
  const modal = document.getElementById(modalId);
  
  if (overlay) overlay.style.display = "block";
  if (modal) modal.style.display = "block";
}

function hideModals() {
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.style.display = "none";
  
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.style.display = "none";
  });
}

// Работа с API
async function fetchData(endpoint, options = {}) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_URL}/${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${settings.encryptionKey}`,
        ...(options.headers || {})
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Ошибка при загрузке ${endpoint}:`, error);
    showErrorModal(`Не удалось загрузить данные: ${error.message}`);
    return null;
  }
}

async function saveData(endpoint, data) {
  try {
    const options = { 
      method: "POST",
      headers: {}
    };
    
    if (data instanceof FormData) {
      options.body = data;
    } else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data);
    }

    return await fetchData(endpoint, options);
  } catch (error) {
    console.error(`Ошибка при сохранении (${endpoint}):`, error);
    showErrorModal(`Ошибка сохранения: ${error.message}`);
    return null;
  }
}

// Карта
function initMap() {
  if (typeof L === "undefined") {
    console.error("Leaflet не загружен");
    return;
  }
  
  const mapElement = document.getElementById("map");
  if (!mapElement) return;
  
  map = L.map("map").setView([55.751244, 37.618423], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Пример маркера
  L.marker([55.751244, 37.618423])
    .addTo(map)
    .bindPopup("Центр Москвы")
    .openPopup();
}

// WebSocket соединение
async function connectToServer() {
  try {
    // Проверка доступности HTTP сервера
    const health = await fetchData("healthcheck");
    if (!health) {
      throw new Error("Сервер недоступен");
    }

    // Закрываем предыдущее соединение, если есть
    if (connection) {
      connection.close();
    }

    connection = new WebSocket(`ws://${settings.ip}:${settings.wsPort}`);
    
    connection.onopen = () => {
      reconnectAttempts = 0;
      console.log("WebSocket подключен");
      updateConnectionStatus("connected", "Подключено");
      showSystemMessage("Соединение с сервером установлено");
      
      // Отправляем информацию о пользователе
      connection.send(JSON.stringify({
        type: "user_connect",
        userId: settings.userId,
        status: "online"
      }));
      
      // Загружаем начальные данные
      loadInitialData();
    };

    connection.onclose = (event) => {
      console.log("WebSocket отключен:", event.code, event.reason);
      updateConnectionStatus("disconnected", "Отключено");
      
      // Пытаемся переподключиться
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 15000);
        console.log(`Попытка переподключения #${reconnectAttempts} через ${delay}мс`);
        setTimeout(connectToServer, delay);
      }
    };

    connection.onerror = (error) => {
      console.error("WebSocket ошибка:", error);
      updateConnectionStatus("error", "Ошибка подключения");
      showErrorModal("Ошибка соединения с сервером");
    };

    connection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingData(data);
      } catch (error) {
        console.error("Ошибка обработки сообщения:", error);
      }
    };

  } catch (error) {
    console.error("Ошибка подключения:", error);
    showErrorModal(`Ошибка подключения: ${error.message}`);
    updateConnectionStatus("error", "Ошибка подключения");
    
    // Пытаемся переподключиться
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 15000);
      setTimeout(connectToServer, delay);
    }
  }
}

// Обработка входящих данных
function handleIncomingData(data) {
  console.log("Получены данные:", data);
  
  switch (data.type) {
    case "welcome":
      handleWelcomeMessage(data);
      break;
    case "ptt_event":
      handlePTTEvent(data);
      break;
    case "new_message":
      handleNewMessage(data);
      break;
    case "user_status":
      handleUserStatusChange(data);
      break;
    case "group_created":
      handleNewGroup(data);
      break;
    case "abonent_created":
      handleNewAbonent(data);
      break;
    default:
      console.warn("Неизвестный тип данных:", data.type);
  }
}

function handleWelcomeMessage(data) {
  showSystemMessage(data.message);
}

function handlePTTEvent(data) {
  console.log("PTT активировано:", data.group, "пользователем:", data.userId);
  // Здесь можно добавить визуализацию активации PTT
  showSystemMessage(`PTT активировано в группе ${data.group} пользователем ${data.userId}`);
}

function handleNewMessage(data) {
  const message = `Новое сообщение в группе ${data.groupId} от ${data.userId}: ${data.message}`;
  console.log(message);
  showSystemMessage(message);
}

function handleUserStatusChange(data) {
  console.log(`Пользователь ${data.userId} сменил статус на ${data.status}`);
  // Обновляем UI статуса пользователя
  updateAbonentStatus(data.userId, data.status);
}

function handleNewGroup(data) {
  console.log("Создана новая группа:", data.group);
  // Обновляем список групп
  loadGroups();
}

function handleNewAbonent(data) {
  console.log("Добавлен новый абонент:", data.abonent);
  // Обновляем список абонентов
  loadAbonents();
}

// Управление подключением
function updateConnectionStatus(status, message) {
  const statusElement = document.getElementById("connectionStatus");
  if (!statusElement) return;
  
  statusElement.textContent = message;
  statusElement.className = "";
  statusElement.classList.add("connection-status", `status-${status}`);
}

function updateNetworkInfo() {
  const remoteIpElement = document.getElementById("remoteIP");
  if (remoteIpElement) {
    remoteIpElement.textContent = `${settings.ip}:${settings.wsPort}`;
  }
}

// Настройки
async function saveSettings() {
  const ipInput = document.getElementById("serverIp");
  const portInput = document.getElementById("serverPort");
  const dispatcherInput = document.getElementById("dispatcher");

  if (!ipInput || !portInput || !dispatcherInput) {
    showErrorModal("Не найдены элементы настроек");
    return;
  }

  const ip = ipInput.value.trim();
  const port = parseInt(portInput.value);
  const dispatcher = parseInt(dispatcherInput.value);

  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    showErrorModal("Неверный формат IP-адреса");
    return;
  }

  if (isNaN(port) || port < 1 || port > 65535) {
    showErrorModal("Неверный порт (допустимо 1-65535)");
    return;
  }

  try {
    const encryptionKey = await getEncryptionKey(ip, port);
    if (!encryptionKey) {
      showErrorModal("Не удалось получить ключ шифрования");
      return;
    }

    settings = { ...settings, ip, wsPort: port, dispatcher, encryptionKey };
    localStorage.setItem("bsuSettings", JSON.stringify(settings));
    
    hideModals();
    updateNetworkInfo();
    showSystemMessage("Настройки сохранены успешно");
    
    // Переподключение с новыми настройками
    connectToServer();
    
  } catch (error) {
    console.error("Ошибка сохранения настроек:", error);
    showErrorModal(`Ошибка сохранения: ${error.message}`);
  }
}

async function getEncryptionKey(ip, port) {
  try {
    const response = await fetch(`http://${ip}:${port}/api/encryptionKey`, {
      headers: { Authorization: `Bearer ${settings.encryptionKey}` }
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.key;
  } catch (error) {
    console.error("Ошибка получения ключа:", error);
    return null;
  }
}

// Абоненты
async function saveAbonent() {
  const nameInput = document.getElementById("abonentName");
  const colorInput = document.getElementById("abonentColor");
  const iconInput = document.getElementById("abonentIcon");

  if (!nameInput || !colorInput || !iconInput) {
    showErrorModal("Не найдены поля формы абонента");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("name", nameInput.value.trim());
    formData.append("color", colorInput.value);
    
    const iconFile = iconInput.files[0];
    if (iconFile) formData.append("icon", iconFile);

    const result = await saveData("abonents", formData);
    if (!result || !result.success) throw new Error("Ошибка сохранения");

    hideModals();
    await loadAbonents();
    showSystemMessage("Абонент добавлен успешно");
    
    // Очистка формы
    nameInput.value = "";
    colorInput.value = "#000000";
    iconInput.value = "";
    
  } catch (error) {
    console.error("Ошибка сохранения абонента:", error);
    showErrorModal("Ошибка сохранения абонента");
  }
}

async function loadAbonents() {
  const abonents = await fetchData("abonents");
  const abonentTree = document.getElementById("abonentTree");
  if (!abonentTree || !abonents) return;

  abonentTree.innerHTML = "";
  abonents.forEach((abonent) => {
    const listItem = document.createElement("li");
    listItem.className = "abonent-item";
    listItem.innerHTML = `
      <div class="abonent-info" style="color:${abonent.color || '#000'}">
        <span class="abonent-name">${abonent.name}</span>
        ${abonent.icon ? `<img src="${abonent.icon}" class="abonent-icon">` : ''}
        <span class="abonent-status ${abonent.online ? 'online' : 'offline'}">
          ${abonent.online ? 'online' : 'offline'}
        </span>
      </div>
    `;
    abonentTree.appendChild(listItem);
  });
}

function updateAbonentStatus(userId, status) {
  const abonentItems = document.querySelectorAll(".abonent-item");
  abonentItems.forEach(item => {
    const nameElement = item.querySelector(".abonent-name");
    if (nameElement && nameElement.textContent.includes(userId)) {
      const statusElement = item.querySelector(".abonent-status");
      if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `abonent-status ${status}`;
      }
    }
  });
}

// Группы
async function loadGroups() {
  const groups = await fetchData("groups");
  const dashboard = document.getElementById("dashboard");
  if (!dashboard || !groups) return;

  dashboard.innerHTML = "";
  groups.forEach((group) => {
    const element = document.createElement("div");
    element.className = `card ${group.status || 'offline'}`;
    element.dataset.group = group.id;
    element.innerHTML = `
      <div class="card-header">
        <div class="card-title">${group.title}</div>
        <div class="card-status">${group.status || 'offline'}</div>
      </div>
      <div class="card-controls">
        <button class="ptt-button" onclick="handlePTT('${group.id}')">PTT</button>
        <div class="control-buttons">
          <button class="message-button" onclick="showMessageForm('${group.id}')">
            <i class="fas fa-envelope"></i>
          </button>
          <button class="sound-button" onclick="toggleSound(this, '${group.id}')">
            <i class="fas fa-volume-up"></i>
          </button>
        </div>
      </div>
      <div class="card-members">
        ${group.members?.map(m => `<span class="member">${m}</span>`).join('') || ''}
      </div>
    `;
    dashboard.appendChild(element);
  });
}

function handlePTT(groupId) {
  if (connection && connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify({
      type: "ptt",
      group: groupId,
      userId: settings.userId,
      timestamp: new Date().toISOString()
    }));
  }
}

function showMessageForm(groupId) {
  const message = prompt(`Введите сообщение для группы ${groupId}:`);
  if (message && connection && connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify({
      type: "message",
      groupId,
      userId: settings.userId,
      message: message,
      timestamp: new Date().toISOString()
    }));
  }
}

function toggleSound(button, groupId) {
  button.classList.toggle("muted");
  const icon = button.querySelector("i");
  icon.classList.toggle("fa-volume-up");
  icon.classList.toggle("fa-volume-mute");
}

// Ошибки
function showErrorModal(message) {
  const errorModal = document.createElement('div');
  errorModal.className = 'error-modal';
  errorModal.innerHTML = `
    <div class="error-content">
      <h3>Ошибка!</h3>
      <p>${message}</p>
      <button onclick="this.parentElement.parentElement.remove()">OK</button>
    </div>
  `;
  document.body.appendChild(errorModal);
}

function showSystemMessage(message) {
  const systemMessage = document.createElement('div');
  systemMessage.className = 'system-message';
  systemMessage.textContent = message;
  document.body.appendChild(systemMessage);
  setTimeout(() => systemMessage.remove(), 3000);
}

// Переключение вида
function toggleView() {
  isMapView = !isMapView;
  
  const mapElement = document.getElementById("map");
  const dashboard = document.getElementById("dashboard");
  const toggleBtn = document.getElementById("toggleView");

  if (mapElement) mapElement.style.display = isMapView ? "block" : "none";
  if (dashboard) dashboard.style.display = isMapView ? "none" : "grid";
  if (toggleBtn) toggleBtn.textContent = isMapView ? "Панель управления" : "Карта";

  if (isMapView && map) {
    setTimeout(() => map.invalidateSize(), 100);
  }
}

// Загрузка начальных данных
async function loadInitialData() {
  await Promise.all([
    loadAbonents(),
    loadGroups()
  ]);
}

// Инициализация при загрузке
window.onload = async () => {
  // Проверка элементов
  const requiredElements = [
    "connectBtn", "settingsBtn", "saveSettings", "addAbonent",
    "saveAbonent", "toggleView", "overlay", "themeToggle",
    "serverIp", "serverPort", "dispatcher"
  ];
  
  requiredElements.forEach(id => {
    if (!document.getElementById(id)) {
      console.warn(`Элемент с ID ${id} не найден`);
    }
  });

  // Инициализация
  initTheme();
  initMap();
  setInterval(updateDateTime, 1000);
  updateDateTime();

  // Загрузка сохраненных настроек
  const savedSettings = localStorage.getItem("bsuSettings");
  if (savedSettings) {
    try {
      const saved = JSON.parse(savedSettings);
      settings = { ...settings, ...saved };
      
      document.getElementById("serverIp").value = settings.ip;
      document.getElementById("serverPort").value = settings.wsPort;
      document.getElementById("dispatcher").value = settings.dispatcher;
    } catch (error) {
      console.error("Ошибка загрузки настроек:", error);
    }
  }

  // Назначение обработчиков
  document.getElementById("connectBtn")?.addEventListener("click", connectToServer);
  document.getElementById("settingsBtn")?.addEventListener("click", () => showModal("settingsModal"));
  document.getElementById("saveSettings")?.addEventListener("click", saveSettings);
  document.getElementById("addAbonent")?.addEventListener("click", () => showModal("abonentModal"));
  document.getElementById("saveAbonent")?.addEventListener("click", saveAbonent);
  document.getElementById("toggleView")?.addEventListener("click", toggleView);
  document.getElementById("overlay")?.addEventListener("click", hideModals);
  document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);

  updateNetworkInfo();
  
  // Автоподключение
  connectToServer();
};

// Глобальные функции
window.handlePTT = handlePTT;
window.showMessageForm = showMessageForm;
window.toggleSound = toggleSound;