const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware для обработки CORS
app.use(cors());

// Middleware для обслуживания статических файлов из корневой папки
app.use(express.static(path.join(__dirname)));

// Пример ключа шифрования
const ENCRYPTION_KEY = 'my-secret-key';

// API для получения ключа шифрования
app.get('/api/encryptionKey', (req, res) => {
    res.json({ key: ENCRYPTION_KEY });
});

const DATA_FILE = path.join(__dirname, 'data.json');

// Загрузка данных из JSON-файла
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ groups: [], settings: {}, abonents: [] }));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Сохранение данных в JSON-файл
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Получение всех данных
app.get('/api/data', (req, res) => {
    const data = loadData();
    res.json(data);
});

// Получение групп
app.get('/api/groups', (req, res) => {
    const data = loadData();
    res.json(data.groups);
});

// Добавление группы
app.post('/api/groups', (req, res) => {
    const data = loadData();
    data.groups.push(req.body);
    saveData(data);
    res.json({ success: true });
});

// Получение настроек
app.get('/api/settings', (req, res) => {
    const data = loadData();
    res.json(data.settings);
});

// Сохранение настроек
app.post('/api/settings', (req, res) => {
    const data = loadData();
    data.settings = req.body;
    saveData(data);
    res.json({ success: true });
});

// Получение абонентов
app.get('/api/abonents', (req, res) => {
    const data = loadData();
    res.json(data.abonents);
});

// Добавление абонента
app.post('/api/abonents', (req, res) => {
    const data = loadData();
    data.abonents.push(req.body);
    saveData(data);
    res.json({ success: true });
});

// Все остальные запросы перенаправляем на index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});