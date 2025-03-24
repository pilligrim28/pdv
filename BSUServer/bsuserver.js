const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Конфигурация файла данных
const DATA_FILE = path.join(__dirname, 'data', 'bsudata.json');
const DATA_BACKUP_DIR = path.join(__dirname, 'data', 'backups');

// Инициализация файловой системы
function initFileSystem() {
    if (!fs.existsSync(path.dirname(DATA_FILE))) {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    }
    if (!fs.existsSync(DATA_BACKUP_DIR)) {
        fs.mkdirSync(DATA_BACKUP_DIR, { recursive: true });
    }
}

// Валидация структуры данных
function validateDataStructure(data) {
    return (
        typeof data === 'object' &&
        Array.isArray(data.retranslators) &&
        Array.isArray(data.timeslots)
    );
}

// Восстановление данных
function restoreData() {
    const backupFiles = fs.readdirSync(DATA_BACKUP_DIR)
        .filter(file => file.endsWith('.bak'))
        .sort()
        .reverse();

    for (const file of backupFiles) {
        try {
            const backupPath = path.join(DATA_BACKUP_DIR, file);
            const content = fs.readFileSync(backupPath, 'utf8');
            const data = JSON.parse(content);
            if (validateDataStructure(data)) {
                fs.writeFileSync(DATA_FILE, content);
                return data;
            }
        } catch (error) {
            console.error(`Ошибка восстановления из ${file}:`, error);
        }
    }
    return null;
}

// Загрузка данных с защитой от повреждений
function loadData() {
    try {
        initFileSystem();
        
        if (!fs.existsSync(DATA_FILE)) {
            return resetDataFile();
        }

        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        const sanitizedData = rawData
            .replace(/([,{[])\s*(\n|\r|\r\n)\s*}/gs, '$1 }')  // Исправление форматирования
            .replace(/,\s*([}\]])/g, '$1');  // Удаление лишних запятых

        const data = JSON.parse(sanitizedData);
        
        if (!validateDataStructure(data)) {
            throw new Error('Invalid data structure');
        }

        return data;
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        const restoredData = restoreData();
        return restoredData || resetDataFile();
    }
}

// Сброс файла данных
function resetDataFile() {
    const initialData = {
        retranslators: [],
        timeslots: []
    };
    saveData(initialData);
    return initialData;
}

// Сохранение данных с созданием резервных копий
function saveData(data) {
    try {
        initFileSystem();
        const timestamp = Date.now();
        const backupPath = path.join(DATA_BACKUP_DIR, `${timestamp}.bak`);
        
        // Создание резервной копии
        if (fs.existsSync(DATA_FILE)) {
            fs.copyFileSync(DATA_FILE, backupPath);
        }

        // Валидация перед сохранением
        if (!validateDataStructure(data)) {
            throw new Error('Invalid data structure before saving');
        }

        // Атомарная запись через временный файл
        const tempFile = `${DATA_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
        fs.renameSync(tempFile, DATA_FILE);
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        throw error;
    }
}

// API Endpoints
app.get('/api/bsu/data', (req, res) => {
    try {
        const data = loadData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
});

// Остальные endpoints (POST, PUT, DELETE) остаются без изменений
// ...

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер БСУ запущен на http://localhost:${PORT}`);
    console.log(`Файл данных: ${DATA_FILE}`);
    console.log(`Резервные копии: ${DATA_BACKUP_DIR}`);
});