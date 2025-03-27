class BSUSystem {
    constructor() {
        this.initUI();
        this.loadAllData();
    }

    initUI() {
        // Инициализация вкладок
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Кнопка добавления ретранслятора
        document.getElementById('addRetranslatorBtn').addEventListener('click', () => this.addRetranslator());
        
        // Кнопка получения конфигурации
        document.getElementById('fetchConfigBtn').addEventListener('click', () => this.fetchDeviceConfig());
    }

    async fetchDeviceConfig() {
        const ip = document.getElementById('retranslatorIp').value;
        if (!ip) return alert('Введите IP адрес');

        try {
            const response = await fetch(`/api/bsu/retranslators/${ip}/config`);
            if (!response.ok) throw new Error('Устройство не найдено');
            
            const config = await response.json();
            this.displayDeviceConfig(config);
        } catch (error) {
            this.showError('Ошибка получения конфигурации:', error);
        }
    }

    displayDeviceConfig(config) {
        // Заполняем форму данными
        document.getElementById('slot1Group').value = config.slots.slot1.group;
        document.getElementById('slot2Group').value = config.slots.slot2.group;
        document.getElementById('retranslatorConfig').value = JSON.stringify(config, null, 2);
        
        // Активируем кнопку добавления
        document.getElementById('addRetranslatorBtn').disabled = false;
    }

    async addRetranslator() {
        const ip = document.getElementById('retranslatorIp').value;
        const config = JSON.parse(document.getElementById('retranslatorConfig').value);

        try {
            const response = await fetch('/api/bsu/retranslators', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip,
                    slots: config.slots,
                    config
                })
            });

            if (!response.ok) throw new Error('Ошибка сохранения');
            
            this.clearForm();
            this.loadRetranslators();
            alert('Ретранслятор успешно добавлен!');
        } catch (error) {
            this.showError('Ошибка добавления:', error);
        }
    }

    async loadRetranslators() {
        try {
            const response = await fetch('/api/bsu/data');
            const data = await response.json();
            this.renderRetranslators(data.retranslators || []);
        } catch (error) {
            this.showError('Ошибка загрузки:', error);
        }
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

    renderRetranslators(retranslators) {
        const container = document.getElementById('retranslators-list');
        container.innerHTML = '';

        retranslators.forEach(retranslator => {
            const card = document.createElement('div');
            card.className = 'device-card';
            card.innerHTML = `
                <h3>${retranslator.ip}</h3>
                <div class="slot-config">
                    <div class="slot">
                        <strong>Слот 1:</strong> ${retranslator.slots.slot1.group}
                        <span>(${retranslator.slots.slot1.type})</span>
                    </div>
                    <div class="slot">
                        <strong>Слот 2:</strong> ${retranslator.slots.slot2.group} 
                        <span>(${retranslator.slots.slot2.type})</span>
                    </div>
                </div>
                <button class="delete-btn" data-id="${retranslator.id}">Удалить</button>
            `;
            container.appendChild(card);
        });
    }

    // Вспомогательные методы
    switchTab(tabName) {
        document.querySelectorAll('.tab-content, .tab-button').forEach(el => {
            el.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    clearForm() {
        document.getElementById('retranslatorIp').value = '';
        document.getElementById('retranslatorConfig').value = '';
    }

    showError(message, error) {
        console.error(message, error);
        alert(`${message}\n${error.message}`);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => new BSUSystem());