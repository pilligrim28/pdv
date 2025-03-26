let map;
let connection;
let settings = {
    ip: 'localhost',
    port: 5000,
    dispatcher: 1,
    encryptionKey: 'defaultKey'
};

const API_URL = 'http://localhost:5000/api';
const BSU_API_URL = 'http://localhost:5001/api';

// Инициализация при загрузке
window.onload = async () => {
    initTheme();
    initMap();
    initDateTime();
    await initApp();
    setupEventListeners();
};

// Основная инициализация
async function initApp() {
    await loadSettings();
    await loadInitialData();
    connectToServer();
}

// Загрузка данных
async function loadInitialData() {
    await Promise.all([
        loadAbonents(),
        loadGroups(),
        loadRetranslators() // Новая функция для загрузки ретрансляторов
    ]);
}

// Подключение к WebSocket
async function connectToServer() {
    try {
        connection = new WebSocket(`ws://${settings.ip}:${settings.port}`);

        connection.onopen = () => {
            console.log('WebSocket подключен');
            authenticate();
        };

        connection.onerror = (error) => {
            console.error('Ошибка WebSocket:', error);
            setTimeout(connectToServer, 5000);
        };

        connection.onclose = () => {
            console.log('WebSocket закрыт');
            setTimeout(connectToServer, 5000);
        };

        connection.onmessage = handleWebSocketMessage;

    } catch (error) {
        console.error('Ошибка подключения:', error);
    }
}

// Обработка сообщений WebSocket
function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'auth_response':
            handleAuthResponse(data);
            break;
        case 'ptt_notification':
            handlePttNotification(data);
            break;
        case 'status_update':
            updateGroupStatus(data.group, data.status);
            break;
        default:
            console.log('Неизвестный тип сообщения:', data);
    }
}

// Загрузка ретрансляторов из bsuserver.js
async function loadRetranslators() {
    try {
        const response = await fetch(`${BSU_API_URL}/bsu/data`);
        const data = await response.json();
        renderRetranslators(data.retranslators);
    } catch (error) {
        console.error('Ошибка загрузки ретрансляторов:', error);
    }
}

// Отображение ретрансляторов на карте
function renderRetranslators(retranslators) {
    if (!map) return;
    
    retranslators.forEach(rt => {
        const marker = L.marker([rt.lat, rt.lng]).addTo(map);
        marker.bindPopup(`
            <b>${rt.name}</b><br>
            IP: ${rt.ip}<br>
            Статус: ${rt.status}
        `);
    });
}

// Обновленный обработчик PTT
function handlePTT(group) {
    if (!connection || connection.readyState !== WebSocket.OPEN) {
        alert('Нет подключения к серверу');
        return;
    }

    const pttData = {
        type: 'ptt',
        group: group,
        dispatcher: settings.dispatcher,
        timestamp: new Date().toISOString()
    };

    connection.send(JSON.stringify(pttData));
    
    // Дополнительно сохраняем в историю
    savePTTHistory(pttData);
}

// Сохранение истории PTT
async function savePTTHistory(data) {
    try {
        await fetch(`${API_URL}/ptt_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Ошибка сохранения истории PTT:', error);
    }
}

// Получение конфигурации ретранслятора
async function getRetranslatorConfig(ip) {
    try {
        const response = await fetch(`${BSU_API_URL}/bsu/retranslators/${ip}/config`);
        return await response.json();
    } catch (error) {
        console.error('Ошибка получения конфигурации:', error);
        return null;
    }
}

// Инициализация даты и времени
function initDateTime() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// Остальные функции (updateDateTime, initMap, initTheme и т.д.) остаются без изменений
// ...

// Пример обновленной функции saveSettings
async function saveSettings() {
    const ipInput = document.getElementById('serverIp');
    const portInput = document.getElementById('serverPort');

    if (!validateInputs(ipInput, portInput)) return;

    const newSettings = {
        ip: ipInput.value,
        port: parseInt(portInput.value),
        dispatcher: parseInt(document.getElementById('dispatcher').value),
        encryptionKey: await fetchEncryptionKey(ipInput.value, portInput.value)
    };

    if (!newSettings.encryptionKey) {
        alert('Ошибка аутентификации');
        return;
    }

    Object.assign(settings, newSettings);
    localStorage.setItem('bsuSettings', JSON.stringify(settings));
    
    hideModals();
    connectToServer(); // Переподключение с новыми настройками
}

// Валидация ввода
function validateInputs(ipInput, portInput) {
    let isValid = true;
    
    if (!ipInput.checkValidity()) {
        alert('Неверный IP-адрес');
        isValid = false;
    }
    
    if (!portInput.checkValidity()) {
        alert('Неверный порт');
        isValid = false;
    }
    
    return isValid;
}