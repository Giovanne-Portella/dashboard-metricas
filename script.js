'use strict';

/**
 * Gera um gradiente de tons de verde com base nos valores de entrada.
 * @param {number[]} values - Um array de números (as quantidades de cada tag).
 * @returns {string[]} - Um array de cores no formato 'rgb(r, g, b)'.
 */
function generateGreenShades(values) {
    if (values.length === 0) return [];

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const startColor = { r: 220, g: 245, b: 225 }; // Verde bem claro
    const endColor = { r: 15, g: 110, b: 40 };   // Verde escuro

    if (minValue === maxValue) {
        const midColor = `rgb(${Math.round((startColor.r + endColor.r) / 2)}, ${Math.round((startColor.g + endColor.g) / 2)}, ${Math.round((startColor.b + endColor.b) / 2)})`;
        return values.map(() => midColor);
    }

    return values.map(value => {
        const ratio = (maxValue - minValue) > 0 ? (value - minValue) / (maxValue - minValue) : 1;
        const r = Math.round(startColor.r + ratio * (endColor.r - startColor.r));
        const g = Math.round(startColor.g + ratio * (endColor.g - startColor.g));
        const b = Math.round(startColor.b + ratio * (endColor.b - startColor.b));
        return `rgb(${r}, ${g}, ${b})`;
    });
}


const App = {
    charts: { status: null, tags: null, workItem: null },
    data: {
        stats: null,
        fullRawData: [],
        currentFilter: 'all'
    },
    CONFIG: {
        WORKING_DAYS: 21,
        MONTH_COLUMN_NAME: 'Created Date',
        CLIENT_COLUMN_NAME: 'Cliente',
        CHART_COLORS: {
            light: ['#007bff', '#17a2b8', '#28a745', '#ffc107', '#dc3545', '#6c757d'],
            dark: ['#ff79c6', '#8be9fd', '#50fa7b', '#f1fa8c', '#ffb86c', '#ff5555', '#bd93f9']
        }
    },

    init: function () {
        ThemeSwitcher.init();
        App.attachEventListeners();
        App.checkInitialState();
        EditableSection.init('atuacoes', 'principalAtuaacoesData');
        EditableSection.init('desenvolvimento', 'meuDesenvolvimentoData');
    },

    checkInitialState: function () {
        try {
            const storedRawData = localStorage.getItem('rawDashboardData');
            const storedUserInfo = localStorage.getItem('userInfo');

            if (storedRawData && storedUserInfo) {
                App.initializeDashboard(JSON.parse(storedRawData), JSON.parse(storedUserInfo));
            } else {
                App.openModal('setupModal');
            }
        } catch (e) {
            console.error("Erro ao verificar estado inicial:", e);
            App.clearAllData(false);
        }
    },

    attachEventListeners: function () {
        document.body.addEventListener('mousemove', App.handleMouseMove);
        document.getElementById('csvFileInputModal').addEventListener('change', App.handleFileSelect);
        document.getElementById('saveAndStartBtn').addEventListener('click', App.handleSetupSave);
        document.getElementById('reset-btn').addEventListener('click', () => App.clearAllData(true));
        document.getElementById('profilePicContainer').addEventListener('click', () => document.getElementById('profilePicInput').click());
        document.getElementById('profilePicInput').addEventListener('change', App.handleProfilePicSelect);
        document.getElementById('openChartsModal').addEventListener('click', () => App.openModal('chartsModal'));
        document.getElementById('openAtuacoesModal').addEventListener('click', () => App.openModal('atuacoesModal'));
        document.getElementById('openDesenvolvimentoModal').addEventListener('click', () => App.openModal('desenvolvimentoModal'));

        document.querySelectorAll('.close-btn').forEach(btn => {
            const modalId = btn.dataset.modalId;
            if (modalId) {
                btn.addEventListener('click', () => App.closeModal(modalId));
            }
        });

        document.getElementById('filters-placeholder').addEventListener('change', (e) => {
            if (e.target && e.target.id === 'monthFilter') {
                App.data.currentFilter = e.target.value;
                App.updateDashboard();
            }
        });
    },

    initializeDashboard: function (rawData, userInfo) {
        App.data.fullRawData = rawData;
        App.displayUserInfo(userInfo);
        UI.createMonthFilter(App.data.fullRawData);
        App.updateDashboard();
        App.loadProfilePicture();
        App.initializeChartsDragAndDrop();
    },

    updateDashboard: function () {
        const filter = App.data.currentFilter;
        let filteredData;

        if (filter === 'all') {
            filteredData = App.data.fullRawData;
        } else {
            filteredData = App.data.fullRawData.filter(row => row[App.CONFIG.MONTH_COLUMN_NAME] === filter);
        }

        const stats = App.processData(filteredData);
        App.data.stats = stats;
        App.displayData(stats);
    },

    handleMouseMove: function (e) {
        const { clientX, clientY } = e;
        const x = Math.round((clientX / window.innerWidth) * 100);
        const y = Math.round((clientY / window.innerHeight) * 100);
        document.body.style.setProperty('--mouse-x', `${x}%`);
        document.body.style.setProperty('--mouse-y', `${y}%`);
    },

    handleFileSelect: function (event) {
        const file = event.target.files[0];
        document.getElementById('modalFileName').textContent = file ? file.name : 'Nenhum arquivo selecionado';
        document.getElementById('saveAndStartBtn').disabled = !file;
    },

    handleSetupSave: function () {
        const userName = document.getElementById('userName').value.trim();
        const userRole = document.getElementById('userRole').value.trim();
        const csvFile = document.getElementById('csvFileInputModal').files[0];
        if (!userName || !userRole || !csvFile) { return alert("Preencha todos os campos."); }
        const userInfo = { name: userName, role: userRole };
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const rawData = App.parseCSV(e.target.result);
                localStorage.setItem('rawDashboardData', JSON.stringify(rawData));
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
                App.closeModal('setupModal');
                App.initializeDashboard(rawData, userInfo);
            } catch (err) {
                alert("Erro ao processar o arquivo CSV.");
                console.error("Erro no CSV:", err);
            }
        };
        reader.readAsText(csvFile);
    },

    displayUserInfo: function (userInfo) {
        document.getElementById('headerName').textContent = userInfo.name;
        document.getElementById('headerRole').textContent = userInfo.role;
    },

    parseCSV: function (text) {
        const lines = text.trim().replace(/\r/g, "").split('\n');
        const header = lines[0].split(';').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(';');
            const obj = {};
            header.forEach((key, i) => { obj[key] = values[i] ? values[i].trim().replace(/"/g, '') : ''; });
            return obj;
        });
    },

    processData: function (data) {
        const findMax = (obj) => {
            if (Object.keys(obj).length === 0) return [null, 0];
            return Object.entries(obj).reduce((a, b) => a[1] > b[1] ? a : b);
        };

        const normalizeClientName = (name) => {
            if (typeof name !== 'string' || !name.trim()) return 'SEM CATEGORIA';
            return name.trim().toUpperCase().split(' ')[0];
        };

        const dataByClient = {};
        data.forEach(item => {
            const clientName = normalizeClientName(item[App.CONFIG.CLIENT_COLUMN_NAME]);
            if (!dataByClient[clientName]) {
                dataByClient[clientName] = [];
            }
            dataByClient[clientName].push(item);
        });

        const byStatus = {};
        const byTags = {};
        const byWorkItem = {};
        data.forEach(item => {
            const status = (item.State || 'SEM CATEGORIA').toUpperCase();
            const workItem = (item['Work Item Type'] || 'SEM CATEGORIA').toUpperCase();
            byStatus[status] = (byStatus[status] || 0) + 1;
            byWorkItem[workItem] = (byWorkItem[workItem] || 0) + 1;

            const tags = (item.Tags || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            tags.forEach(tag => byTags[tag] = (byTags[tag] || 0) + 1);
        });
        
        const filteredClients = Object.fromEntries(Object.entries(dataByClient).filter(([key]) => key !== 'GERAL' && key !== 'SEM CATEGORIA'));
        const [principalClienteName] = findMax(Object.fromEntries(Object.entries(filteredClients).map(([name, items]) => [name, items.length])));

        const top5ClientesData = Object.entries(dataByClient)
            .map(([name, items]) => ({ name, count: items.length, items }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(client => {
                const clientWorkItems = {};
                const clientTags = {};
                client.items.forEach(item => {
                    const workItem = (item['Work Item Type'] || 'SEM CATEGORIA').toUpperCase();
                    clientWorkItems[workItem] = (clientWorkItems[workItem] || 0) + 1;
                    const tags = (item.Tags || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
                    tags.forEach(tag => clientTags[tag] = (clientTags[tag] || 0) + 1);
                });
                const [topWorkItem] = findMax(clientWorkItems);
                const [topTag] = findMax(clientTags);
                return { name: client.name, count: client.count, topWorkItem, topTag };
            });

        // --- NOVO CÁLCULO PARA CLIENTE MAIS ESCALONADO ---
        const escalatedItems = data.filter(item => (item.State || '').toUpperCase() === 'ESCALONADO ENGENHARIA');
        const escalatedClientCounts = {};
        escalatedItems.forEach(item => {
            const clientName = normalizeClientName(item[App.CONFIG.CLIENT_COLUMN_NAME]);
            if (clientName !== 'GERAL' && clientName !== 'SEM CATEGORIA') {
                escalatedClientCounts[clientName] = (escalatedClientCounts[clientName] || 0) + 1;
            }
        });
        const [topEscalatedClient, topEscalatedCount] = findMax(escalatedClientCounts);

        const [principalWorkItemName, principalWorkItemCount] = findMax(byWorkItem);
        const [principalTagName] = findMax(byTags);

        const uniqueMonths = [...new Set(data.map(row => row[App.CONFIG.MONTH_COLUMN_NAME]).filter(Boolean))];
        const numberOfMonths = uniqueMonths.length > 0 ? uniqueMonths.length : 1;
        const totalWorkingDays = numberOfMonths * App.CONFIG.WORKING_DAYS;
        const avgPerDay = totalWorkingDays > 0 ? (data.length / totalWorkingDays).toFixed(1) : '0.0';
        
        return {
            totalCards: data.length,
            avgPerDay: avgPerDay,
            byStatus, byTags, byWorkItem,
            principalWorkItem: {
                name: principalWorkItemName || 'N/A',
                percentage: data.length > 0 ? ((principalWorkItemCount / data.length) * 100).toFixed(1) : 0
            },
            escalonadoCount: byStatus['ESCALONADO ENGENHARIA'] || 0,
            principalTag: principalTagName || 'N/A',
            principalCliente: principalClienteName || 'N/A',
            top5Clientes: top5ClientesData,
            topEscalatedClient: topEscalatedClient || 'N/A',
            topEscalatedCount: topEscalatedCount || 0
        };
    },

    displayData: function (stats) {
        document.getElementById('totalCards').textContent = stats.totalCards;
        document.getElementById('avgPerDay').textContent = stats.avgPerDay;
        document.getElementById('principalTagValue').textContent = stats.principalTag;
        document.getElementById('principalWorkItemValue').textContent = `${stats.principalWorkItem.percentage}%`;
        document.getElementById('principalWorkItemLabel').textContent = `Principal Item (${stats.principalWorkItem.name})`;
        document.getElementById('escalonadoValue').textContent = stats.escalonadoCount;
        document.getElementById('principalClienteValue').textContent = stats.principalCliente;

        // Atualiza o novo card
        const topEscalatedClientValue = document.getElementById('topEscalatedClientValue');
        if (stats.topEscalatedClient !== 'N/A') {
            topEscalatedClientValue.textContent = `${stats.topEscalatedClient} (${stats.topEscalatedCount})`;
        } else {
            topEscalatedClientValue.textContent = 'N/A';
        }

        App.renderCharts(stats, App.data.currentFilter);
        UI.renderTopClientsTable(stats.top5Clientes);
    },

    clearAllData: function (confirmFirst) {
        if (confirmFirst && !confirm("Tem certeza que deseja apagar todos os dados? Isso limpará o dashboard e exigirá uma nova configuração.")) { return; }
        localStorage.clear();
        window.location.reload();
    },

    openModal: function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('modal--hidden');
        }
    },
    closeModal: function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('modal--hidden');
        }
    },
    renderCharts: function (stats, filter) {
        Object.values(App.charts).forEach(chart => chart?.destroy());
        const isDark = document.body.classList.contains('dark-theme');
        const gridColor = isDark ? 'rgba(248, 248, 242, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#f8f8f2' : '#333';
        const chartColors = isDark ? App.CONFIG.CHART_COLORS.dark : App.CONFIG.CHART_COLORS.light;
        const period = filter === 'all' ? 'Geral' : filter;

        document.querySelector('#status-chart-card .card-title').textContent = `Quantidade por Status (${period})`;
        document.querySelector('#work-item-chart-card .card-title').textContent = `Quantidade por Tipo de Item (${period})`;
        document.querySelector('#tags-chart-card .card-title').textContent = `Principais Tags (${period})`;

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { ticks: { color: textColor }, grid: { color: gridColor } }
            }
        };

        const ctxStatus = document.getElementById('statusChart').getContext('2d');
        App.charts.status = new Chart(ctxStatus, { type: 'doughnut', data: { labels: Object.keys(stats.byStatus), datasets: [{ data: Object.values(stats.byStatus), backgroundColor: chartColors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: textColor } } } } });

        const tagsContainer = document.getElementById('tags-chart-card');
        const filteredAndSortedTags = Object.entries(stats.byTags)
            .filter(([, count]) => count >= 2)
            .sort(([, a], [, b]) => b - a);
        const sortedTagLabels = filteredAndSortedTags.map(item => item[0]);
        const sortedTagData = filteredAndSortedTags.map(item => item[1]);
        const pixelsPerTag = 35;
        const verticalPadding = 100;
        const minHeight = 450;
        const dynamicHeight = (sortedTagData.length * pixelsPerTag) + verticalPadding;
        const finalHeight = Math.max(minHeight, dynamicHeight);
        tagsContainer.style.height = `${finalHeight}px`;
        const tagColors = generateGreenShades(sortedTagData);
        const ctxTags = document.getElementById('tagsChart').getContext('2d');
        App.charts.tags = new Chart(ctxTags, {
            type: 'bar',
            data: { labels: sortedTagLabels, datasets: [{ data: sortedTagData, backgroundColor: tagColors }] },
            options: { ...chartOptions, indexAxis: 'y' }
        });

        const ctxWorkItem = document.getElementById('workItemChart').getContext('2d');
        App.charts.workItem = new Chart(ctxWorkItem, { type: 'bar', data: { labels: Object.keys(stats.byWorkItem), datasets: [{ data: Object.values(stats.byWorkItem), backgroundColor: chartColors }] }, options: chartOptions });
    },

    initializeChartsDragAndDrop: function () {
        const container = document.getElementById('charts-container');
        if (container) new Sortable(container, { animation: 150 });
    },
    
    loadProfilePicture: function () {
        const imageUrl = localStorage.getItem('profilePicture');
        if (imageUrl) App.displayProfilePicture(imageUrl);
    },
    handleProfilePicSelect: function (event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                localStorage.setItem('profilePicture', e.target.result);
                App.displayProfilePicture(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    },
    displayProfilePicture: function (imageUrl) {
        document.getElementById('profilePicContainer').innerHTML = `<img src="${imageUrl}" alt="Foto de Perfil">`;
    },
};

const UI = {
    createMonthFilter: function (rawData) {
        const container = document.getElementById('filters-placeholder');
        container.innerHTML = '';

        const months = [...new Set(rawData.map(row => row[App.CONFIG.MONTH_COLUMN_NAME]).filter(Boolean))].sort();
        if (months.length === 0) return;

        const filterWrapper = document.createElement('div');
        filterWrapper.id = 'filters-container';
        const label = document.createElement('label');
        label.htmlFor = 'monthFilter';
        label.textContent = 'Mês:';
        const select = document.createElement('select');
        select.id = 'monthFilter';
        select.innerHTML = `<option value="all">Visão Geral</option>${months.map(m => `<option value="${m}">${m}</option>`).join('')}`;

        filterWrapper.appendChild(label);
        filterWrapper.appendChild(select);
        container.appendChild(filterWrapper);
    },
    renderTopClientsTable: function(top5Data) {
        const container = document.getElementById('topClientsTableContainer');
        container.innerHTML = '';

        if (top5Data && top5Data.length > 0) {
            const table = document.createElement('table');
            table.className = 'dashboard-table';
            
            table.innerHTML = `<thead><tr><th>Top 5 Clientes</th><th>Qtd</th><th>Principal Item</th><th>Principal Tag</th></tr></thead>`;
            
            const tbody = document.createElement('tbody');
            top5Data.forEach(item => {
                const row = tbody.insertRow();
                row.insertCell().textContent = (item.name || '-').toLowerCase();
                row.insertCell().textContent = item.count || 0;
                row.insertCell().textContent = (item.topWorkItem || '-').toLowerCase();
                row.insertCell().textContent = (item.topTag || '-').toLowerCase();
            });
            table.appendChild(tbody);
            container.appendChild(table);
        } else {
            container.innerHTML = '<p style="font-size: 0.9em; text-align: center;">Nenhum dado de cliente para exibir.</p>';
        }
    }
};

const ThemeSwitcher = {
    init: function () {
        this.toggleButton = document.getElementById('theme-toggle');
        this.toggleButton.addEventListener('click', this.toggleTheme);
        const savedTheme = localStorage.getItem('theme');
        const osPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        this.applyTheme(savedTheme || osPreference);
    },
    applyTheme: function (theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            this.toggleButton.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-theme');
            this.toggleButton.textContent = '🌙';
        }
        localStorage.setItem('theme', theme);
        if (App.data && App.data.stats) {
            App.renderCharts(App.data.stats, App.data.currentFilter);
        }
    },
    toggleTheme: function () {
        const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        ThemeSwitcher.applyTheme(newTheme);
    }
};

const EditableSection = {
    init: function (sectionId, storageKey) {
        const section = {
            id: sectionId, storageKey: storageKey, data: JSON.parse(localStorage.getItem(storageKey)) || [],
            elements: {
                newBtn: document.getElementById(`${sectionId}-new-btn`),
                list: document.getElementById(`${sectionId}-list`),
                editor: {
                    wrapper: document.getElementById(`${sectionId}-editor`),
                    id: document.querySelector(`#${sectionId}-editor .editor-id`),
                    title: document.querySelector(`#${sectionId}-editor .editor-title`),
                    content: document.querySelector(`#${sectionId}-editor .editor-content`),
                    saveBtn: document.querySelector(`#${sectionId}-editor .editor-save`),
                    cancelBtn: document.querySelector(`#${sectionId}-editor .editor-cancel`),
                    toolbar: document.querySelector(`#${sectionId}-editor .editor-toolbar`),
                }
            }
        };
        this.attachListeners(section);
        this.renderList(section);
    },
    attachListeners: function (section) {
        section.elements.newBtn.addEventListener('click', () => this.showEditor(section, null));
        section.elements.editor.saveBtn.addEventListener('click', () => this.saveItem(section));
        section.elements.editor.cancelBtn.addEventListener('click', () => this.hideEditor(section));
        section.elements.list.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const id = button.dataset.id;
            const item = section.data.find(i => i.id == id);
            if (button.classList.contains('edit-btn')) { this.showEditor(section, item); }
            else if (button.classList.contains('delete-btn')) { this.deleteItem(section, id); }
            else if (button.classList.contains('view-btn')) { this.viewItem(item); }
        });
        section.elements.editor.toolbar.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.dataset.command) {
                e.preventDefault();
                const command = button.dataset.command;
                if (command === 'insertImage') {
                    const url = prompt('URL da Imagem:');
                    if (url) document.execCommand(command, false, url);
                } else { document.execCommand(command, false, null); }
            }
        });

    },
    renderList: function (section) {
        section.elements.list.innerHTML = '';
        section.data.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'item';
            itemEl.innerHTML = `<span class="item-title">${item.title}</span><div class="item-actions"><button data-id="${item.id}" class="view-btn">👁️</button><button data-id="${item.id}" class="edit-btn">✏️</button><button data-id="${item.id}" class="delete-btn">🗑️</button></div>`;
            section.elements.list.appendChild(itemEl);
        });
    },
    showEditor: function (section, item) {
        section.elements.editor.id.value = item ? item.id : '';
        section.elements.editor.title.value = item ? item.title : '';
        section.elements.editor.content.innerHTML = item ? item.content : '';
        section.elements.editor.wrapper.style.display = 'block';
        section.elements.newBtn.style.display = 'none';
        section.elements.list.style.display = 'none';
    },
    hideEditor: function (section) {
        section.elements.editor.wrapper.style.display = 'none';
        section.elements.newBtn.style.display = 'block';
        section.elements.list.style.display = 'block';
    },
    saveItem: function (section) {
        const id = section.elements.editor.id.value;
        const title = section.elements.editor.title.value.trim();
        const content = section.elements.editor.content.innerHTML;
        if (!title) { return alert('O título é obrigatório.'); }
        if (id) {
            const index = section.data.findIndex(i => i.id == id);
            if (index > -1) section.data[index] = { id: Number(id), title, content };
        } else { section.data.push({ id: Date.now(), title, content }); }
        localStorage.setItem(section.storageKey, JSON.stringify(section.data));
        this.hideEditor(section);
        this.renderList(section);
    },
    deleteItem: function (section, id) {
        if (confirm('Tem certeza?')) {
            section.data = section.data.filter(i => i.id != id);
            localStorage.setItem(section.storageKey, JSON.stringify(section.data));
            this.renderList(section);
        }
    },
    viewItem: function (item) {
        const viewWindow = window.open('', '_blank');
        viewWindow.document.write(`<html><head><title>${item.title}</title><style>body{font-family:sans-serif;padding:2rem;color:${document.body.classList.contains('dark-theme') ? '#f8f8f2' : '#333'};background:${document.body.classList.contains('dark-theme') ? '#282a36' : '#fff'};} img {max-width: 100%; height: auto;}</style></head><body><h1>${item.title}</h1><hr><div>${item.content}</div></body></html>`);
        viewWindow.document.close();
    }
};

// --- Ponto de Entrada Principal ---
document.addEventListener('DOMContentLoaded', App.init);