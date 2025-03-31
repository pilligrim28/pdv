const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const WebSocket = require('ws');
const axios = require('axios');

// Настройка загрузки файлов
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }
});

const app = express();
const PORT = 5025;
const HOST = '0.0.0.0';
const WS_PORT = 2323;
const DATA_FILE = path.join(__dirname, 'data.json');
const ENCRYPTION_KEY = 'secure-key-12345';
const BSU_SERVER_URL = 'http://localhost:5001';

// Создаем необходимые директории
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5025', 'http://10.21.10.146:5025', 'http://10.21.50.5:2323'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static('uploads'));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Упрощенная аутентификация
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    console.warn('No authorization header');
    return res.status(401).json({ error: 'Authorization header required' });
  }
  next();
};

// Работа с данными
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      groups: [
        { id: 1, title: "Тестовая группа", status: "online", members: [] }
      ],
      settings: { 
        version: "1.0",
        maxConnections: 100
      },
      abonents: [
        { id: "1", name: "Тестовый абонент", color: "#3366ff", online: false }
      ]
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (err) {
    console.error('Error reading data file:', err);
    return { groups: [], settings: {}, abonents: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API Endpoints
app.get('/healthcheck', (req, res) => {
  res.status(200).json({ 
    status: "OK",
    server: "BSU Server",
    version: "1.0",
    time: new Date().toISOString(),
    websocketPort: WS_PORT,
    bsuServerUrl: BSU_SERVER_URL
  });
});

app.get('/api/encryptionKey', (req, res) => {
  res.json({ 
    key: ENCRYPTION_KEY,
    expiresIn: "1h",
    serverTime: new Date().toISOString()
  });
});

// BSU Server Integration
app.get('/api/bsu/data', async (req, res) => {
  try {
    const response = await axios.get(`${BSU_SERVER_URL}/api/bsu/data`);
    res.json(response.data);
  } catch (error) {
    console.error('BSU data error:', error.message);
    res.status(500).json({ error: "Failed to get BSU data" });
  }
});

app.get('/api/bsu/retranslators/:ip/config', async (req, res) => {
  try {
    const response = await axios.get(
      `${BSU_SERVER_URL}/api/bsu/retranslators/${req.params.ip}/config`
    );
    res.json(response.data);
  } catch (error) {
    console.error('BSU config error:', error.message);
    res.status(500).json({ error: "Failed to get retranslator config" });
  }
});

app.post('/api/bsu/retranslators', async (req, res) => {
  try {
    const response = await axios.post(
      `${BSU_SERVER_URL}/api/bsu/retranslators`,
      req.body
    );
    res.status(201).json(response.data);
  } catch (error) {
    console.error('BSU create error:', error.message);
    res.status(500).json({ error: "Failed to create retranslator" });
  }
});

// Группы
app.get('/api/groups', (req, res) => {
  try {
    const data = loadData();
    res.json(data.groups);
  } catch (error) {
    console.error('Groups error:', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/api/groups', authenticate, (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const data = loadData();
    const newGroup = {
      id: Date.now(),
      title,
      status: "offline",
      members: [],
      createdAt: new Date().toISOString()
    };
    
    data.groups.push(newGroup);
    saveData(data);
    
    // Уведомляем всех клиентов через WS
    broadcastToClients({
      type: "group_created",
      group: newGroup
    });
    
    res.json({ success: true, group: newGroup });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: "Failed to save group" });
  }
});

// Настройки
app.get('/api/settings', (req, res) => {
  try {
    const data = loadData();
    res.json(data.settings);
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Абоненты
app.get('/api/abonents', (req, res) => {
  try {
    const data = loadData();
    res.json(data.abonents);
  } catch (error) {
    console.error('Abonents error:', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/api/abonents', upload.single('icon'), (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const data = loadData();
    const abonent = {
      id: req.body.id || Date.now().toString(),
      name,
      color: color || '#3366ff',
      icon: req.file ? `/uploads/${req.file.filename}` : null,
      online: false,
      createdAt: new Date().toISOString()
    };
    
    data.abonents.push(abonent);
    saveData(data);
    
    broadcastToClients({
      type: "abonent_created",
      abonent
    });
    
    res.json({ success: true, abonent });
  } catch (error) {
    console.error('Create abonent error:', error);
    res.status(500).json({ error: "Failed to save abonent" });
  }
});

// WebSocket Server
const wss = new WebSocket.Server({
  port: WS_PORT,
  perMessageDeflate: false
});

function broadcastToClients(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Функция для широковещательной рассылки
function broadcastToClients(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Heartbeat для проверки подключений
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      console.log(`Terminating inactive connection: ${ws._socket.remoteAddress}`);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(null, false, true);
  });
}, 30000);

wss.on('listening', () => {
  console.log(`WebSocket сервер запущен на ws://${HOST}:${WS_PORT}`);
});

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  const clientIp = req.socket.remoteAddress;
  console.log(`Новое подключение от ${clientIp}`);

  // Отправляем приветственное сообщение
  ws.send(JSON.stringify({
    type: "welcome",
    message: "Connection established",
    serverTime: new Date().toISOString()
  }));

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Получено сообщение от', clientIp, ':', data);
      
      // Обработка разных типов сообщений
      switch (data.type) {
        case "ptt":
          handlePTTMessage(data, ws);
          break;
        case "message":
          handleTextMessage(data, ws);
          break;
        case "status_update":
          handleStatusUpdate(data, ws);
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format"
      }));
    }
  });

  ws.on('error', (error) => {
    console.error(`Ошибка соединения с ${clientIp}:`, error);
  });

  ws.on('close', () => {
    console.log(`Соединение с ${clientIp} закрыто`);
    updateUserStatus(clientIp, false);
  });
});

// Обработчики WebSocket сообщений
function handlePTTMessage(data, ws) {
  broadcastToClients({
    type: "ptt_event",
    group: data.group,
    userId: data.userId,
    timestamp: new Date().toISOString()
  });
}

function handleTextMessage(data, ws) {
  if (!data.message || !data.groupId) {
    return ws.send(JSON.stringify({
      type: "error",
      message: "Invalid message format"
    }));
  }

  broadcastToClients({
    type: "new_message",
    groupId: data.groupId,
    userId: data.userId,
    message: data.message,
    timestamp: new Date().toISOString()
  });
}

function handleStatusUpdate(data, ws) {
  updateUserStatus(data.userId, data.status === "online");
}

function updateUserStatus(userId, isOnline) {
  const data = loadData();
  const user = data.abonents.find(a => a.id === userId);
  if (user) {
    user.online = isOnline;
    user.lastSeen = isOnline ? null : new Date().toISOString();
    saveData(data);
    
    broadcastToClients({
      type: "user_status",
      userId,
      status: isOnline ? "online" : "offline"
    });
  }
}

// Запуск HTTP сервера
app.listen(PORT, HOST, () => {
  console.log(`HTTP сервер запущен на http://${HOST}:${PORT}`);
  console.log(`WebSocket сервер запущен на ws://${HOST}:${WS_PORT}`);
  console.log(`Интеграция с BSU сервером: ${BSU_SERVER_URL}`);
});

// Обработка ошибок
process.on('uncaughtException', (err) => {
  console.error('Неперехваченное исключение:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный rejection:', reason);
});