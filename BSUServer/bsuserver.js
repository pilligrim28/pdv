const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5001;
const DATA_FILE = path.join(__dirname, 'data', 'bsudata.json');

// Middleware
app.use(cors());
app.use(express.json());

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

// API Endpoints
app.get('/api/bsu/retranslators', (req, res) => {
    try {
        initData();
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        res.json(data.retranslators);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка чтения данных' });
    }
});

app.get('/api/bsu/retranslators/:ip/config', (req, res) => {
    const mockConfig = {
        status: 'online',
        ip: req.params.ip,
        model: 'DR600',
        slots: {
            slot1: { type: 'voice', group: 'Группа 1', frequency: '435.125 МГц' },
            slot2: { type: 'data', group: 'Группа 2', frequency: '435.625 МГц' }
        }
    };
    res.json(mockConfig);
});

app.post('/api/bsu/retranslators', (req, res) => {
    try {
        initData();
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        
        const newRetranslator = {
            id: Date.now().toString(),
            ip: req.body.ip,
            name: req.body.name || `Ретранслятор ${Date.now()}`,
            location: req.body.location || 'Не указано',
            lastUpdated: new Date().toISOString()
        };
        
        data.retranslators.push(newRetranslator);
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        res.status(201).json(newRetranslator);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`BSU Server запущен на http://localhost:${PORT}`);
    initData();
});