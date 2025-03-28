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
            retranslators: [
                {
                    id: "1",
                    ip: "192.168.1.100",
                    name: "Основной ретранслятор",
                    location: "Центральный офис",
                    status: "active"
                }
            ],
            dispatchers: [],
            radioStations: []
        }, null, 2));
    }
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5025', 'http://10.21.10.146:5025'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoints
app.get('/api/bsu/data', (req, res) => {
    try {
        initData();
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        res.json(data);
    } catch (error) {
        console.error('BSU data read error:', error);
        res.status(500).json({ error: 'Ошибка чтения данных BSU' });
    }
});

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
        firmware: 'v2.5.3',
        lastSeen: new Date().toISOString()
    };
    
    res.json(mockConfig);
});

// Функция для обработки POST запросов
function handlePostRequest(entity) {
    return (req, res) => {
        try {
            initData();
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            const newItem = {
                id: Date.now().toString(),
                ...req.body,
                status: 'active',
                createdAt: new Date().toISOString()
            };
            data[`${entity}s`].push(newItem);
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            res.status(201).json(newItem);
        } catch (error) {
            console.error(`BSU ${entity} create error:`, error);
            res.status(500).json({ error: `Ошибка сохранения ${entity}` });
        }
    };
}

// POST endpoints
app.post('/api/bsu/retranslators', handlePostRequest('retranslator'));
app.post('/api/bsu/dispatchers', handlePostRequest('dispatcher'));
app.post('/api/bsu/radioStations', handlePostRequest('radioStation'));

// Запуск сервера
app.listen(PORT, () => {
    console.log(`BSU сервер запущен на http://localhost:${PORT}`);
    initData();
});