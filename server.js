const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const WebSocket = require('ws');
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = 5025;
const WS_PORT = 2323;
const DATA_FILE = path.join(__dirname, 'data.json');
const ENCRYPTION_KEY = 'my-secret-key';

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // Укажите домен вашего фронтенда
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Разрешить куки и заголовки авторизации
  }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static('uploads'));

// Аутентификация
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${ENCRYPTION_KEY}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Работа с данными
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ 
            groups: [], 
            settings: {}, 
            abonents: [] 
        }));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
// server.js
app.get('/healthcheck', (req, res) => {
    res.status(200).json({ status: "OK" });
  });
// API Endpoints
app.get('/api/encryptionKey', authenticate, (req, res) => {
    res.json({ key: ENCRYPTION_KEY });
});

app.get('/api/groups', (req, res) => {
    res.json(loadData().groups);
});

app.post('/api/groups', authenticate, (req, res) => {
    const data = loadData();
    data.groups.push(req.body);
    saveData(data);
    res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
    res.json(loadData().settings);
});

app.post('/api/settings', authenticate, (req, res) => {
    const data = loadData();
    data.settings = req.body;
    saveData(data);
    res.json({ success: true });
});

app.get('/api/abonents', (req, res) => {
    res.json(loadData().abonents);
});

app.post('/api/abonents', upload.single('icon'), (req, res) => {
    const data = loadData();
    const abonent = {
        id: req.body.id,
        name: req.body.name,
        color: req.body.color,
        icon: req.file ? `/uploads/${req.file.filename}` : null
    };
    data.abonents.push(abonent);
    saveData(data);
    res.json({ success: true, abonent });
});

// WebSocket Server
const wss = new WebSocket.Server({
    host: '0.0.0.0',
    port: WS_PORT,
    perMessageDeflate: false
});

setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('listening', () => {
    console.log(`WebSocket сервер запущен на ws://0.0.0.0:${WS_PORT}`);
});

wss.on('connection', (ws) => {
    ws.isAlive = true;
    console.log('Новое подключение:', ws._socket.remoteAddress);

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('error', (error) => {
        console.error('Ошибка соединения:', error);
    });
});

// Глобальная обработка ошибок сервера
wss.on('error', (error) => {
    console.error('Ошибка сервера WebSocket:', error);
});

// Запускаем HTTP-сервер для проверки доступности
app.get('/healthcheck', (req, res) => {
    res.status(200).send('OK');
});

// Single app.listen() call
app.listen(PORT, () => {
    console.log(`HTTP сервер запущен на http://localhost:${PORT}`);
    console.log(`WebSocket сервер запущен на ws://localhost:${WS_PORT}`);
});