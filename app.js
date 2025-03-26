// app.js
let map;
let connection;
let settings = {
  ip: "10.21.50.6",
  port: 2323,
  dispatcher: 16,
  encryptionKey: "defaultKey",
};

const API_URL = "http://localhost:5000/api";
let isMapView = true;

// Инициализация темы
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", savedTheme);
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.innerHTML =
      savedTheme === "dark"
        ? '<i class="fas fa-moon"></i>'
        : '<i class="fas fa-sun"></i>';
  }
}

// Переключение темы
function toggleTheme() {
  const body = document.body;
  const isDark = body.getAttribute("data-theme") === "dark";
  body.setAttribute("data-theme", isDark ? "light" : "dark");
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.innerHTML = isDark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  }
  localStorage.setItem("theme", isDark ? "light" : "dark");
}

// Обновление времени и даты
function updateDateTime() {
  const now = new Date();
  document.getElementById("currentTime").textContent =
    now.toLocaleTimeString("ru-RU");
  document.getElementById("currentDate").textContent = now.toLocaleDateString(
    "ru-RU",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}

// Показать/скрыть модальные окна
function showModal(modalId) {
  document.getElementById("overlay").style.display = "block";
  document.getElementById(modalId).style.display = "block";
}

function hideModals() {
  document.getElementById("overlay").style.display = "none";
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.style.display = "none";
  });
}

// Загрузка данных с сервера
async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_URL}/${endpoint}`);
    if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Ошибка при загрузке данных (${endpoint}):`, error);
    return null;
  }
}

// Сохранение данных на сервер
async function saveData(endpoint, data) {
  try {
    const options = { method: "POST" };
    if (data instanceof FormData) {
      options.body = data;
    } else {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(data);
    }
    const response = await fetch(`${API_URL}/${endpoint}`, options);
    if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Ошибка при сохранении данных (${endpoint}):`, error);
    return null;
  }
}

// Инициализация карты
function initMap() {
  if (typeof L === "undefined") {
    console.error("Leaflet не загружен");
    return;
  }
  map = L.map("map").setView([55.751244, 37.618423], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

// Подключение к серверу
// app.js (корректное подключение)
async function connectToServer() {
    try {
        if (connection) connection.close();
        
        // Проверка доступности сервера
        const isAlive = await fetch(`http://${settings.ip}:${settings.port}`);
        if (!isAlive.ok) throw new Error('Сервер недоступен');

        connection = new WebSocket(`ws://${settings.ip}:${settings.port}`);
        
        // Таймаут подключения
        const timeout = setTimeout(() => {
            connection.close();
            throw new Error('Таймаут подключения');
        }, 5000);

        connection.onopen = () => {
            clearTimeout(timeout);
            console.log('Подключено!');
        };
        
    } catch (error) {
        console.error('Ошибка:', error);
        alert(`Ошибка подключения: ${error.message}`);
    }
}

// Обработка входящих данных
function handleIncomingData(data) {
  switch (data.type) {
    case "ptt":
      console.log("PTT активировано:", data.group);
      break;
    case "message":
      alert(`Новое сообщение для ${data.group}: ${data.message}`);
      break;
  }
}

// Обновление статуса подключения
function updateConnectionStatus(status, message) {
  const statusElement = document.getElementById("connectionStatus");
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.className = `status-${status}`;
}

// Обновление сетевой информации
function updateNetworkInfo() {
  document.getElementById(
    "remoteIP"
  ).textContent = `${settings.ip}:${settings.port}`;
}

// Сохранение настроек
async function saveSettings() {
  const ip = document.getElementById("serverIp").value;
  const port = document.getElementById("serverPort").value;
  const dispatcher = document.getElementById("dispatcher").value;

  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    alert("Неверный формат IP-адреса");
    return;
  }

  settings = {
    ip: ip,
    port: parseInt(port),
    dispatcher: parseInt(dispatcher),
    encryptionKey: await getEncryptionKey(ip, port),
  };

  localStorage.setItem("bsuSettings", JSON.stringify(settings));
  hideModals();
  alert("Настройки сохранены!");
  location.reload();
}

// Получение ключа шифрования
async function getEncryptionKey(ip, port) {
  try {
    const response = await fetch(`http://${ip}:${port}/api/encryptionKey`);
    if (!response.ok) throw new Error("Ошибка при получении ключа");
    const data = await response.json();
    return data.key;
  } catch (error) {
    console.error("Ошибка:", error);
    return null;
  }
}

// Сохранение абонента
async function saveAbonent() {
  try {
    const formData = new FormData();
    formData.append("id", document.getElementById("abonentId").value);
    formData.append("name", document.getElementById("abonentName").value);
    formData.append("color", document.getElementById("abonentColor").value);

    const iconFile = document.getElementById("abonentIcon").files[0];
    if (iconFile) formData.append("icon", iconFile);

    await saveData("abonents", formData);
    hideModals();
    loadAbonents();
  } catch (error) {
    console.error("Ошибка сохранения:", error);
    alert("Ошибка сохранения абонента");
  }
}

// Загрузка абонентов
async function loadAbonents() {
  const abonents = await fetchData("abonents");
  const abonentTree = document.getElementById("abonentTree");
  if (!abonentTree || !abonents) return;

  abonentTree.innerHTML = "";
  abonents.forEach((abonent) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
            <div style="color:${abonent.color}">
                ${abonent.name} (${abonent.id})
                ${
                  abonent.icon
                    ? `<img src="${abonent.icon}" class="abonent-icon">`
                    : ""
                }
            </div>
        `;
    abonentTree.appendChild(listItem);
  });
}

// Загрузка групп
async function loadGroups() {
  const groups = await fetchData("groups");
  const dashboard = document.getElementById("dashboard");
  if (!dashboard || !groups) return;

  dashboard.innerHTML = "";
  groups.forEach((group) => {
    const element = document.createElement("div");
    element.className = `card ${group.status}`;
    element.innerHTML = `
            <div class="card-header">
                <div class="card-title">${group.title}</div>
                <div class="card-status"></div>
            </div>
            <div class="card-controls">
                <div class="ptt-button" onclick="handlePTT('${group.title}')">PTT</div>
                <div class="control-buttons">
                    <div class="message-button" onclick="showMessageForm('${group.title}')">
                        <i class="fas fa-envelope"></i>
                    </div>
                    <div class="sound-button" onclick="toggleSound(this, '${group.title}')">
                        <i class="fas fa-volume-up"></i>
                    </div>
                </div>
            </div>
        `;
    dashboard.appendChild(element);
  });
}

// Переключение вида
function toggleView() {
  const mapElement = document.getElementById("map");
  const dashboard = document.getElementById("dashboard");
  const toggleBtn = document.getElementById("toggleView");

  isMapView = !isMapView;
  mapElement.style.display = isMapView ? "block" : "none";
  dashboard.style.display = isMapView ? "none" : "grid";
  toggleBtn.textContent = isMapView ? "Показать панель" : "Показать карту";

  if (isMapView && map) setTimeout(() => map.invalidateSize(), 100);
}

// Инициализация при загрузке
window.onload = async () => {
  initTheme();
  initMap();
  setInterval(updateDateTime, 1000);
  updateDateTime();

  // Загрузка настроек
  const savedSettings = localStorage.getItem("bsuSettings");
  if (savedSettings) {
    settings = JSON.parse(savedSettings);
    document.getElementById("serverIp").value = settings.ip;
    document.getElementById("serverPort").value = settings.port;
    document.getElementById("dispatcher").value = settings.dispatcher;
  }

  await loadAbonents();
  await loadGroups();

  // Обработчики событий
  document.getElementById("connectBtn").onclick = connectToServer;
  document.getElementById("settingsBtn").onclick = () =>
    showModal("settingsModal");
  document.getElementById("addAbonent").onclick = () =>
    showModal("abonentModal");
  document.getElementById("toggleView").onclick = toggleView;
  document.getElementById("overlay").onclick = hideModals;

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

  updateNetworkInfo();
};
