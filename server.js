const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const WebSocket = require('ws');
const axios = require('axios'); // Для HTTP-запросов к bsuserver.js

const app = express();
const PORT = 5000;
const BSU_SERVER_URL = 'http://localhost:5001'; // Адрес bsuserver.js

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Ключ шифрования
const ENCRYPTION_KEY = 'my-secret-key';

// API для получения ключа шифрования
app.get('/api/encryptionKey', (req, res) => {
    res.json({ key: ENCRYPTION_KEY });
});

// Загрузка данных из data.json
function loadData() {
    const DATA_FILE = path.join(__dirname, 'data.json');
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ groups: [], settings: {}, abonents: [] }));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Сохранение данных в data.json
function saveData(data) {
    fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(data, null, 2));
}

// Прокси-запрос к bsuserver.js
app.get('/api/bsu/data', async (req, res) => {
    try {
        const response = await axios.get(`${BSU_SERVER_URL}/api/bsu/data`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка запроса к bsuserver' });
    }
});

// Остальные API endpoints (группы, настройки, абоненты)
app.get('/api/groups', (req, res) => {
    res.json(loadData().groups);
});

app.post('/api/groups', (req, res) => {
    const data = loadData();
    data.groups.push(req.body);
    saveData(data);
    res.json({ success: true });
});

// Запуск HTTP-сервера
const server = app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});

// WebSocket-сервер
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Новое подключение WebSocket');

    ws.on('message', async (message) => {
        const data = JSON.parse(message);

        // Аутентификация
        if (data.type === 'auth') {
            if (data.key === ENCRYPTION_KEY) {
                ws.send(JSON.stringify({ type: 'auth', status: 'success' }));
            } else {
                ws.send(JSON.stringify({ type: 'auth', status: 'error' }));
            }
        }

        // Запрос данных из bsuserver.js через WebSocket
        if (data.type === 'get_bsu_data') {
            try {
                const response = await axios.get(`${BSU_SERVER_URL}/api/bsu/data`);
                ws.send(JSON.stringify({ type: 'bsu_data', data: response.data }));
            } catch (error) {
                ws.send(JSON.stringify({ type: 'error', message: 'Ошибка запроса к bsuserver' }));
            }
        }
    });

    ws.on('close', () => {
        console.log('Подключение закрыто');
    });
});