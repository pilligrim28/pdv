const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5001;
const DATA_FILE = path.join(__dirname, 'data', 'bsudata.json');

// Инициализация данных
function initData() {
    if (!fs.existsSync(path.dirname(DATA_FILE))) {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    }
    
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            retranslators: [],
            dispatchers: [],
            radioStations: []
        }, null, 2));
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoints
app.get('/api/bsu/data', (req, res) => {
    try {
        initData();
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка чтения данных' });
    }
});

// Получение конфигурации по IP
app.get('/api/bsu/retranslators/:ip/config', (req, res) => {
    const ip = req.params.ip;
    
    // Эмуляция запроса к реальному устройству Kirisun DR600
    const mockConfig = {
        status: 'online',
        ip: ip,
        model: 'DR600',
        slots: {
            slot1: { type: 'voice', group: 'Группа 1', frequency: '435.125 МГц' },
            slot2: { type: 'data', group: 'Группа 2', frequency: '435.625 МГц' }
        },
        power: '10W',
        firmware: 'v2.5.3'
    };
    
    res.json(mockConfig);
});

// Добавление ретранслятора
app.post('/api/bsu/retranslators', (req, res) => {
    try {
        initData();
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            const newItem = {
                id: Date.now().toString(),
                ...req.body,
                status: 'active'
            };
            data[`${entity}s`].push(newItem);
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            res.status(201).json(newItem);
        } catch (error) {
            res.status(500).json({ error: 'Ошибка сохранения данных' });
        }
    };
}

app.post('/api/bsu/retranslators', handlePostRequest('retranslators'));
app.post('/api/bsu/dispatchers', handlePostRequest('dispatchers'));
app.post('/api/bsu/radioStations', handlePostRequest('radioStation'));

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    initData();
});