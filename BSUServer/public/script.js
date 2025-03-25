class BSUSystem {
    constructor() {
        this.initEventListeners();
        this.loadAllData();
    }

    initEventListeners() {
        // Переключение вкладок
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Обработчики добавления
        document.getElementById('addRetranslatorBtn').addEventListener('click', () => this.addItem('retranslator'));
        document.getElementById('addDispatcherBtn').addEventListener('click', () => this.addItem('dispatcher'));
        document.getElementById('addRadioStationBtn').addEventListener('click', () => this.addItem('radioStation'));
    }

    async loadAllData() {
        try {
            const response = await fetch('/api/bsu/data');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            this.renderList('retranslators-list', data.retranslators || [], this.renderRetranslator);
            this.renderList('dispatchers-list', data.dispatchers || [], this.renderDispatcher);
            this.renderList('radioStations-list', data.radioStations || [], this.renderRadioStation);
        } catch (error) {
            this.showError('Ошибка загрузки данных:', error);
        }
    }
    async addRetranslator() {
            try {
                const ip = document.getElementById('ipInput').value;
                
                // Запрос конфигурации по IP
                const configResponse = await fetch(`/api/bsu/retranslators/${ip}/config`);
                const deviceConfig = await configResponse.json();
    
                // Создание ретранслятора с автоматическими слотами
                const response = await fetch('/api/bsu/retranslators', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        ip: ip,
                        slots: deviceConfig.slots,
                        config: deviceConfig
                    })
                });
    
                this.updateUI();
            } catch (error) {
                this.showError('Ошибка получения конфигурации:', error);
            }
        
    
        renderRetranslator(item) {
            return `
                <div class="device-card">
                    <h3>${item.ip}</h3>
                    <div class="slots">
                        <div class="slot ${item.slots.slot1 ? 'active' : ''}">
                            Слот 1: ${item.slots.slot1}
                        </div>
                        <div class="slot ${item.slots.slot2 ? 'active' : ''}">
                            Слот 2: ${item.slots.slot2}
                        </div>
                    </div>
                    <pre>${JSON.stringify(item.config, null, 2)}</pre>
                </div>
            `;
        }
    }

    async addItem(type) {
        try {
            const inputs = {
                retranslator: ['retranslatorIp', 'retranslatorConfig'],
                dispatcher: ['dispatcherName'],
                radioStation: ['radioStationName']
            }[type];

            const body = {};
            inputs.forEach(id => {
                const value = document.getElementById(id).value;
                if (!value) throw new Error('Заполните все поля');
                body[id.replace(type, '').toLowerCase()] = value;
            });

            const endpointMap = {
                retranslator: '/api/bsu/retranslators',
                dispatcher: '/api/bsu/dispatchers',
                radioStation: '/api/bsu/radioStations'
            };

            const response = await fetch(endpointMap[type], {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            inputs.forEach(id => (document.getElementById(id).value = ''));
            this.loadAllData();
        } catch (error) {
            this.showError(`Ошибка добавления ${type}:`, error);
        }
    }

    renderList(containerId, items, renderFunction) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        items.forEach(item => container.appendChild(renderFunction(item)));
    }

    renderRetranslator = (item) => this.createListItem(item, `
        <p>IP: ${item.ip}</p>
        <p>Конфигурация: ${item.config}</p>
    `);

    renderDispatcher = (item) => this.createListItem(item, `
        <p>Имя: ${item.name}</p>
    `);

    renderRadioStation = (item) => this.createListItem(item, `
        <p>Идентификатор: ${item.name}</p>
    `);

    createListItem(item, content) {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-header">
                <span class="item-id">ID: ${item.id}</span>
                <div class="item-actions">
                    <button class="delete-btn" data-id="${item.id}">Удалить</button>
                </div>
            </div>
            <div class="item-content">${content}</div>
        `;
        return div;
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-content, .tab-button').forEach(el => {
            el.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    showError(message, error) {
        console.error(message, error);
        alert(`${message}\n${error.message}`);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => new BSUSystem());