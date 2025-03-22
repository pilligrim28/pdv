let currentEditId = null;
let currentEditType = null;

// Функция для переключения вкладок
function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`button[onclick="openTab('${tabName}')"]`).classList.add('active');
}

// Функция для загрузки данных
async function loadData() {
    const response = await fetch('/api/bsu/data');
    return await response.json();
}

// Функция для отображения ретрансляторов
async function loadRetranslators() {
    const data = await loadData();
    const list = document.getElementById('retranslators-list');
    list.innerHTML = '<h2>Ретрансляторы</h2>';
    data.retranslators.forEach(retranslator => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <p><strong>ID:</strong> ${retranslator.id}</p>
            <p><strong>IP:</strong> ${retranslator.ip}</p>
            <p><strong>Слот 1:</strong> ${retranslator.slot1.join(', ')}</p>
            <p><strong>Слот 2:</strong> ${retranslator.slot2.join(', ')}</p>
            <button onclick="openEditModal('retranslator', '${retranslator.id}', '${retranslator.ip}', '${JSON.stringify(retranslator.slot1)}', '${JSON.stringify(retranslator.slot2)}')">Редактировать</button>
            <button onclick="deleteRetranslator('${retranslator.id}')">Удалить</button>
        `;
        list.appendChild(item);
    });
}

// Функция для отображения диспетчеров
async function loadDispatchers() {
    const data = await loadData();
    const list = document.getElementById('dispatchers-list');
    list.innerHTML = '<h2>Диспетчеры</h2>';
    data.dispatchers.forEach(dispatcher => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <p><strong>ID:</strong> ${dispatcher.id}</p>
            <p><strong>Имя:</strong> ${dispatcher.name}</p>
            <p><strong>Группы:</strong> ${dispatcher.groups.join(', ')}</p>
            <button onclick="openEditModal('dispatcher', '${dispatcher.id}', '${dispatcher.name}', '${JSON.stringify(dispatcher.groups)}')">Редактировать</button>
            <button onclick="deleteDispatcher('${dispatcher.id}')">Удалить</button>
        `;
        list.appendChild(item);
    });
}

// Функция для отображения радиостанций
async function loadRadioStations() {
    const data = await loadData();
    const list = document.getElementById('radioStations-list');
    list.innerHTML = '<h2>Радиостанции</h2>';
    data.radioStations.forEach(radioStation => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <p><strong>ID:</strong> ${radioStation.id}</p>
            <p><strong>Имя:</strong> ${radioStation.name}</p>
            <p><strong>Группы:</strong> ${radioStation.groups.join(', ')}</p>
            <button onclick="openEditModal('radioStation', '${radioStation.id}', '${radioStation.name}', '${JSON.stringify(radioStation.groups)}')">Редактировать</button>
            <button onclick="deleteRadioStation('${radioStation.id}')">Удалить</button>
        `;
        list.appendChild(item);
    });
}

// Функция для открытия модального окна редактирования
function openEditModal(type, id, name, slot1, slot2) {
    currentEditId = id;
    currentEditType = type;
    document.getElementById('editModalTitle').innerText = `Редактировать ${type === 'retranslator' ? 'ретранслятор' : type === 'dispatcher' ? 'диспетчера' : 'радиостанцию'}`;
    let content = '';

    if (type === 'retranslator') {
        content = `
            <label for="editIp">IP-адрес:</label>
            <input type="text" id="editIp" value="${name}">
            <label for="editSlot1">Слот 1 (группы):</label>
            <input type="text" id="editSlot1" value="${slot1}">
            <label for="editSlot2">Слот 2 (группы):</label>
            <input type="text" id="editSlot2" value="${slot2}">
            <button onclick="saveEditedItem()">Сохранить</button>
        `;
    } else {
        content = `
            <label for="editName">Имя:</label>
            <input type="text" id="editName" value="${name}">
            <label for="editGroups">Группы:</label>
            <input type="text" id="editGroups" value="${slot1}">
            <button onclick="saveEditedItem()">Сохранить</button>
        `;
    }

    document.getElementById('editModalContent').innerHTML = content;
    document.getElementById('editModal').style.display = 'block';
    document.getElementById('editModalOverlay').style.display = 'block';
}

// Функция для закрытия модального окна
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('editModalOverlay').style.display = 'none';
}

// Функция для сохранения изменений
async function saveEditedItem() {
    let url = '';
    let body = {};

    if (currentEditType === 'retranslator') {
        url = `/api/bsu/retranslators/${currentEditId}`;
        body = {
            ip: document.getElementById('editIp').value,
            slot1: JSON.parse(document.getElementById('editSlot1').value),
            slot2: JSON.parse(document.getElementById('editSlot2').value)
        };
    } else if (currentEditType === 'dispatcher') {
        url = `/api/bsu/dispatchers/${currentEditId}`;
        body = {
            name: document.getElementById('editName').value,
            groups: JSON.parse(document.getElementById('editGroups').value)
        };
    } else if (currentEditType === 'radioStation') {
        url = `/api/bsu/radioStations/${currentEditId}`;
        body = {
            name: document.getElementById('editName').value,
            groups: JSON.parse(document.getElementById('editGroups').value)
        };
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const result = await response.json();
    if (result.success) {
        alert('Изменения сохранены!');
        closeEditModal();
        if (currentEditType === 'retranslator') loadRetranslators();
        else if (currentEditType === 'dispatcher') loadDispatchers();
        else if (currentEditType === 'radioStation') loadRadioStations();
    }
}

// Загрузка данных при загрузке страницы
window.onload = () => {
    loadRetranslators();
    loadDispatchers();
    loadRadioStations();
};