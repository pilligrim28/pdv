const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 2323; // Порт для сервера БСУ

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data', 'bsudata.json');

// Загрузка данных из JSON-файла
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            retranslators: [], // Ретрансляторы Kirisun DR600
            timeslots: []      // Таймслоты для DP990
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Сохранение данных в JSON-файл
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API для получения всех данных
app.get('/api/bsu/data', (req, res) => {
    const data = loadData();
    res.json(data);
});

// API для добавления ретранслятора Kirisun DR600
app.post('/api/bsu/retranslators', (req, res) => {
    const data = loadData();
    const newRetranslator = {
        id: Date.now().toString(), // Уникальный ID
        ip: req.body.ip,           // IP-адрес ретранслятора
        status: 'active',          // Статус (по умолчанию активен)
        config: req.body.config    // Конфигурация (например, частота, мощность)
    };
    data.retranslators.push(newRetranslator);
    saveData(data);
    res.json({ success: true, retranslator: newRetranslator });
});

// API для добавления таймслота для DP990
app.post('/api/bsu/timeslots', (req, res) => {
    const data = loadData();
    const newTimeslot = {
        id: Date.now().toString(), // Уникальный ID
        startTime: req.body.startTime, // Время начала таймслота
        endTime: req.body.endTime,     // Время окончания таймслота
        frequency: req.body.frequency, // Частота
        status: 'active'               // Статус (по умолчанию активен)
    };
    data.timeslots.push(newTimeslot);
    saveData(data);
    res.json({ success: true, timeslot: newTimeslot });
});

// API для удаления ретранслятора
app.delete('/api/bsu/retranslators/:id', (req, res) => {
    const data = loadData();
    const retranslatorId = req.params.id;
    data.retranslators = data.retranslators.filter(r => r.id !== retranslatorId);
    saveData(data);
    res.json({ success: true });
});

// API для удаления таймслота
app.delete('/api/bsu/timeslots/:id', (req, res) => {
    const data = loadData();
    const timeslotId = req.params.id;
    data.timeslots = data.timeslots.filter(t => t.id !== timeslotId);
    saveData(data);
    res.json({ success: true });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер БСУ запущен на http://localhost:${PORT}`);
});
app.use(express.static(path.join(__dirname, 'public')));