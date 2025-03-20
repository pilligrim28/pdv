let map;
let connection;
let settings = {
    ip: '192.168.0.100',
    port: 5000,
    dispatcher: 1,
    encryptionKey: 'defaultKey'
};

const API_URL = 'http://localhost:5000/api';

// Загрузка данных с сервера
async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_URL}/${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error(`Ошибка при загрузке данных (${endpoint}):`, error);
        return null;
    }
}

// Сохранение данных на сервер
async function saveData(endpoint, data) {
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error(`Ошибка при сохранении данных (${endpoint}):`, error);
        return null;
    }
}

// Инициализация карты
function initMap() {
    if (typeof L === 'undefined') {
        console.error('Leaflet не загружен');
        return;
    }
    map = L.map('map').setView([55.751244, 37.618423], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

// Обновление времени и даты
function updateDateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('ru-RU');
    document.getElementById('currentDate').textContent = now.toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Показать/скрыть модальное окно
function showModal(modalId) {
    document.getElementById('overlay').style.display = 'block';
    document.getElementById(modalId).style.display = 'block';
}

function hideModals() {
    document.getElementById('overlay').style.display = 'none';
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Подключение к серверу
async function connectToServer() {
    try {
        console.log('Подключение к:', settings.ip, settings.port);
        connection = new WebSocket(`ws://${settings.ip}:${settings.port}`);
        connection.onerror = (error) => {
            console.error('Ошибка подключения:', error);
        };
        connection.onopen = () => {
            console.log('Подключение установлено');
        };
    } catch (error) {
        console.error('Ошибка подключения:', error);
    }
}

// Сохранение настроек
async function saveSettings() {
    const ipInput = document.getElementById('serverIp');
    const portInput = document.getElementById('serverPort');

    if (!ipInput.checkValidity()) {
        alert('Пожалуйста, введите корректный IP-адрес.');
        return;
    }

    if (!portInput.checkValidity()) {
        alert('Пожалуйста, введите корректный порт (только цифры).');
        return;
    }

    const ip = ipInput.value;
    const port = portInput.value;

    // Получаем ключ шифрования с сервера
    const encryptionKey = await getEncryptionKey(ip, port);
    if (!encryptionKey) {
        alert('Не удалось получить ключ шифрования с сервера.');
        return;
    }

    settings = {
        ip: ip,
        port: parseInt(port),
        dispatcher: parseInt(document.getElementById('dispatcher').value),
        encryptionKey: encryptionKey // Сохраняем полученный ключ
    };

    localStorage.setItem('bsuSettings', JSON.stringify(settings));
    hideModals();
}
// Сохранение абонента
async function saveAbonent() {
    try {
        const abonent = {
            id: document.getElementById('abonentId').value,
            name: document.getElementById('abonentName').value,
            color: document.getElementById('abonentColor').value,
            icon: document.getElementById('abonentIcon').files[0]
        };
        await saveData('abonents', abonent);
        hideModals();
        loadAbonents();
    } catch (error) {
        console.error('Ошибка сохранения абонента:', error);
    }
}

// Загрузка абонентов
async function loadAbonents() {
    const abonents = await fetchData('abonents');
    const abonentTree = document.getElementById('abonentTree');
    if (!abonentTree) return;

    abonentTree.innerHTML = '';
    abonents.forEach(abonent => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <div style="color:${abonent.color}">
                ${abonent.name} (${abonent.id})
            </div>
        `;
        abonentTree.appendChild(listItem);
    });
}

// Загрузка групп
async function loadGroups() {
    const groups = await fetchData('groups');
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;

    dashboard.innerHTML = '';
    groups.forEach(group => {
        const element = document.createElement('div');
        element.className = `card ${group.status}`;
        element.innerHTML = `
            <div class="card-header">
                <div class="card-title">${group.title}</div>
                <div class="card-status"></div>
            </div>
            <div class="card-controls">
                <div class="ptt-button" onclick="handlePTT('${group.title}')">
                    PTT
                </div>
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

// Переключение вида (карта/панель)
let isMapView = true;
function toggleView() {
    const map = document.getElementById('map');
    const dashboard = document.getElementById('dashboard');
    const toggleBtn = document.getElementById('toggleView');
    if (!map || !dashboard || !toggleBtn) return;

    isMapView = !isMapView;
    map.style.display = isMapView ? 'block' : 'none';
    dashboard.style.display = isMapView ? 'none' : 'grid';
    toggleBtn.textContent = isMapView ? 'Показать панель' : 'Показать карту';
}

// Обработка PTT
function handlePTT(group) {
    console.log(`PTT активировано для ${group}`);
}

// Обработка сообщения
function showMessageForm(group) {
    console.log(`Отправка сообщения ${group}`);
}

// Переключение звука
function toggleSound(btn, group) {
    const icon = btn.querySelector('i');
    const isMuted = icon.classList.contains('fa-volume-mute');
    icon.classList.toggle('fa-volume-up');
    icon.classList.toggle('fa-volume-mute');
    console.log(`Звук ${isMuted ? 'включен' : 'выключен'} для ${group}`);
}

// Инициализация темы
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

// Переключение темы
function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// Инициализация при загрузке
window.onload = async () => {
    initTheme();
    initMap();
    setInterval(updateDateTime, 1000);
    updateDateTime();

    // Загрузка данных с сервера
    const savedSettings = await fetchData('settings');
    if (savedSettings) settings = savedSettings;

    // Загрузка абонентов и групп
    await loadAbonents();
    await loadGroups();

    // Назначение обработчиков
    document.getElementById('connectBtn').onclick = connectToServer;
    document.getElementById('settingsBtn').onclick = () => showModal('settingsModal');
    document.getElementById('addAbonent').onclick = () => showModal('abonentModal');
    document.getElementById('toggleView').onclick = toggleView;
    document.getElementById('overlay').onclick = hideModals;

    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', toggleTheme);
};
// Обработчики для маски IP и ограничения на цифры
document.getElementById('serverIp').addEventListener('input', function (e) {
    let value = e.target.value;
    value = value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    if (parts.length > 4) {
        parts.length = 4;
    }
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].length > 3) {
            parts[i] = parts[i].slice(0, 3);
        }
    }
    e.target.value = parts.join('.');
});

document.getElementById('abonentId').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '');
});

document.getElementById('serverPort').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '');
});

// Функции сохранения с проверкой валидности
function saveSettings() {
    const ipInput = document.getElementById('serverIp');
    const portInput = document.getElementById('serverPort');

    if (!ipInput.checkValidity()) {
        alert('Пожалуйста, введите корректный IP-адрес.');
        return;
    }

    if (!portInput.checkValidity()) {
        alert('Пожалуйста, введите корректный порт (только цифры).');
        return;
    }

    settings = {
        ip: ipInput.value,
        port: parseInt(portInput.value),
        dispatcher: parseInt(document.getElementById('dispatcher').value),
        encryptionKey: document.getElementById('encryptionKey').value
    };
    localStorage.setItem('bsuSettings', JSON.stringify(settings));
    hideModals();
}

function saveAbonent() {
    const abonentIdInput = document.getElementById('abonentId');

    if (!abonentIdInput.checkValidity()) {
        alert('Пожалуйста, введите корректный ID (только цифры).');
        return;
    }

    const abonent = {
        id: abonentIdInput.value,
        name: document.getElementById('abonentName').value,
        color: document.getElementById('abonentColor').value,
        icon: document.getElementById('abonentIcon').files[0]
    };

    const listItem = document.createElement('li');
    listItem.innerHTML = `
        <div style="color:${abonent.color}">
            ${abonent.name} (${abonent.id})
        </div>
    `;
    document.getElementById('abonentTree').appendChild(listItem);
    hideModals();
}
async function getEncryptionKey(ip, port) {
    try {
        const response = await fetch(`http://${ip}:${port}/api/encryptionKey`);
        if (!response.ok) {
            throw new Error('Ошибка при получении ключа шифрования');
        }
        const data = await response.json();
        return data.key; // Предполагаем, что сервер возвращает ключ в поле `key`
    } catch (error) {
        console.error('Ошибка при получении ключа шифрования:', error);
        return null;
    }
}