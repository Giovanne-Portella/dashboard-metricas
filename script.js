'use strict';

const App = {
    data: {
        fullRawData: [], // Armazena todos os dados do CSV
    },
    CONFIG: {
        WORKING_DAYS: 21,
        MONTH_COLUMN_NAME: 'Created Date',
        CLIENT_COLUMN_NAME: 'Cliente',
        ANALYST_COLUMN_NAME: 'Assigned To', // Nova configuração para a coluna do analista
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
                // Se houver dados salvos, inicializa o dashboard com eles
                const rawData = JSON.parse(storedRawData);
                App.data.fullRawData = rawData;
                App.displayUserInfo(JSON.parse(storedUserInfo));
                UI.populateAnalystFilter(rawData); // Popula o filtro de analistas
                App.updateDashboard(); // Renderiza o dashboard com a visão padrão
                App.loadProfilePicture();
            } else {
                // Se não, mostra a tela de login/setup
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
        document.getElementById('openAtuacoesModal').addEventListener('click', () => App.openModal('atuacoesModal'));
        document.getElementById('openDesenvolvimentoModal').addEventListener('click', () => App.openModal('desenvolvimentoModal'));

        document.querySelectorAll('.close-btn').forEach(btn => {
            const modalId = btn.dataset.modalId;
            if (modalId) btn.addEventListener('click', () => App.closeModal(modalId));
        });

        // Event listener para o novo filtro de analistas
        document.getElementById('analyst-filter').addEventListener('change', () => {
            App.updateDashboard();
        });
        
        // CORREÇÃO: Voltando ao método anterior de adicionar listeners, que é mais estável.
        // Adiciona o evento de clique para os cabeçalhos dos grupos PRINCIPAIS que já existem na página.
        document.querySelectorAll('.metrics-group > .group-header').forEach(header => {
            header.addEventListener('click', () => UI.toggleGroup(header));
        });
    },

    // Função central que agora re-renderiza todo o dashboard com base nos filtros
    updateDashboard: function() {
        // 1. Pega os analistas selecionados no filtro
        const selectedAnalysts = UI.getSelectedAnalysts();

        // 2. Filtra os dados brutos com base na seleção
        let filteredData;
        if (selectedAnalysts.includes('__OVERALL__') || selectedAnalysts.length === 0) {
            // Se "Visão Geral" está selecionada ou nada selecionado, usa todos os dados
            filteredData = App.data.fullRawData;
        } else {
            // Senão, filtra pelos nomes dos analistas
            filteredData = App.data.fullRawData.filter(row => 
                selectedAnalysts.includes(row[this.CONFIG.ANALYST_COLUMN_NAME])
            );
        }
        
        // 3. Agrupa os dados filtrados por mês
        const monthlyData = this.groupDataByMonth(filteredData);
        
        // 4. Renderiza todos os blocos com os dados finais
        UI.renderAllMonthlyBlocks(monthlyData);
        
        // 5. Aplica os estados de expandir/recolher salvos
        UI.applySavedStates();
    },

    // Função de inicialização foi simplificada
    initializeDashboard: function (rawData, userInfo) {
        App.data.fullRawData = rawData;
        App.displayUserInfo(userInfo);
        UI.populateAnalystFilter(rawData);
        App.updateDashboard();
        App.loadProfilePicture();
    },
    
    groupDataByMonth: function(data) {
        const monthColumn = this.CONFIG.MONTH_COLUMN_NAME;
        const groups = {};
        data.forEach(row => {
            const month = row[monthColumn];
            if (month) {
                if (!groups[month]) groups[month] = [];
                groups[month].push(row);
            }
        });
        return groups;
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
                // Salva os dados para persistência
                localStorage.setItem('rawDashboardData', JSON.stringify(rawData));
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
                App.closeModal('setupModal');
                // Inicializa o dashboard pela primeira vez
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
        const byStatus = {};
        const byWorkItem = {};
        const byTags = {};
        const dataByClient = {};
        let totalTagInstances = 0;
        const itemsWithTags = data.filter(item => item.Tags && item.Tags.trim() !== '').length;
        data.forEach(item => {
            const status = (item.State || 'SEM CATEGORIA').toUpperCase();
            const workItem = (item['Work Item Type'] || 'SEM CATEGORIA').toUpperCase();
            byStatus[status] = (byStatus[status] || 0) + 1;
            byWorkItem[workItem] = (byWorkItem[workItem] || 0) + 1;
            const clientName = normalizeClientName(item[App.CONFIG.CLIENT_COLUMN_NAME]);
            if (!dataByClient[clientName]) dataByClient[clientName] = [];
            dataByClient[clientName].push(item);
            const tags = (item.Tags || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            totalTagInstances += tags.length;
            tags.forEach(tag => byTags[tag] = (byTags[tag] || 0) + 1);
        });
        const totalCards = data.length;
        const totalAtivos = totalCards - (byStatus['FECHADO'] || 0) - (byStatus['RESOLVIDO'] || 0);
        const avgPerDay = (totalCards / App.CONFIG.WORKING_DAYS).toFixed(1);
        const totalClientesUnicos = Object.keys(dataByClient).filter(name => name !== 'GERAL' && name !== 'SEM CATEGORIA').length;
        const top5Clientes = Object.entries(dataByClient).map(([name, items]) => ({ name, count: items.length })).sort((a, b) => b.count - a.count).slice(0, 5);
        const escalatedItems = data.filter(item => (item.State || '').toUpperCase() === 'ESCALONADO ENGENHARIA');
        const escalatedClientCounts = {};
        escalatedItems.forEach(item => {
            const clientName = normalizeClientName(item[App.CONFIG.CLIENT_COLUMN_NAME]);
             if (clientName !== 'GERAL' && clientName !== 'SEM CATEGORIA') {
                escalatedClientCounts[clientName] = (escalatedClientCounts[clientName] || 0) + 1;
            }
        });
        const [topEscalatedClient, topEscalatedCount] = findMax(escalatedClientCounts);
        const resolvedItems = data.filter(item => ['FECHADO', 'RESOLVIDO'].includes((item.State || '').toUpperCase()));
        const resolvedClientCounts = {};
        resolvedItems.forEach(item => {
            const clientName = normalizeClientName(item[App.CONFIG.CLIENT_COLUMN_NAME]);
             if (clientName !== 'GERAL' && clientName !== 'SEM CATEGORIA') {
                resolvedClientCounts[clientName] = (resolvedClientCounts[clientName] || 0) + 1;
            }
        });
        const [topResolverClient, topResolverCount] = findMax(resolvedClientCounts);
        const [principalWorkItemName] = findMax(byWorkItem);
        const escalatedWorkItemCounts = {};
        escalatedItems.forEach(item => {
            const workItem = (item['Work Item Type'] || 'SEM CATEGORIA').toUpperCase();
            escalatedWorkItemCounts[workItem] = (escalatedWorkItemCounts[workItem] || 0) + 1;
        });
        let topEscalatedWorkItem = 'N/A';
        let maxRate = -1;
        for (const workItem in byWorkItem) {
            const rate = byWorkItem[workItem] > 0 ? (escalatedWorkItemCounts[workItem] || 0) / byWorkItem[workItem] : 0;
            if (rate > maxRate) {
                maxRate = rate;
                topEscalatedWorkItem = `${workItem} (${(maxRate * 100).toFixed(0)}%)`;
            }
        }
        const totalTagsUnicas = Object.keys(byTags).length;
        const top5Tags = Object.entries(byTags).sort(([,a],[,b]) => b-a).slice(0, 5);
        const avgTagsPerItem = itemsWithTags > 0 ? (totalTagInstances / itemsWithTags).toFixed(1) : '0.0';
        const escalatedTagCounts = {};
        escalatedItems.forEach(item => {
            (item.Tags || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean).forEach(tag => {
                escalatedTagCounts[tag] = (escalatedTagCounts[tag] || 0) + 1;
            });
        });
        const [topEscalatedTag, topEscalatedTagCount] = findMax(escalatedTagCounts);
        return {
            totalCards, avgPerDay, byStatus, totalAtivos, totalClientesUnicos, top5Clientes, topEscalatedClient: topEscalatedClient || 'N/A',
            topEscalatedCount: topEscalatedCount || 0, topResolverClient: topResolverClient || 'N/A', topResolverCount: topResolverCount || 0,
            byWorkItem, principalWorkItemName: principalWorkItemName || 'N/A', topEscalatedWorkItem, totalTagsUnicas, top5Tags, avgTagsPerItem,
            topEscalatedTag: topEscalatedTag || 'N/A', topEscalatedTagCount: topEscalatedTagCount || 0
        };
    },

    clearAllData: function (confirmFirst) {
        if (confirmFirst && !confirm("Tem certeza que deseja apagar todos os dados? Isso limpará o dashboard e exigirá uma nova configuração.")) { return; }
        localStorage.clear();
        window.location.reload();
    },

    openModal: function (modalId) { document.getElementById(modalId)?.classList.remove('modal--hidden'); },
    closeModal: function (modalId) { document.getElementById(modalId)?.classList.add('modal--hidden'); },
    
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
    
    handleMouseMove: function (e) {
        const { clientX, clientY } = e;
        const x = Math.round((clientX / window.innerWidth) * 100);
        const y = Math.round((clientY / window.innerHeight) * 100);
        document.body.style.setProperty('--mouse-x', `${x}%`);
        document.body.style.setProperty('--mouse-y', `${y}%`);
    },
};

const UI = {
    populateAnalystFilter: function(rawData) {
        const filterElement = document.getElementById('analyst-filter');
        filterElement.innerHTML = ''; 

        const analystNames = [...new Set(rawData.map(row => row[App.CONFIG.ANALYST_COLUMN_NAME]).filter(Boolean))];
        analystNames.sort();

        const overallOption = document.createElement('option');
        overallOption.value = '__OVERALL__'; 
        overallOption.textContent = 'Visão Geral';
        overallOption.selected = true; 
        filterElement.appendChild(overallOption);

        analystNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name.split('<')[0].trim();
            filterElement.appendChild(option);
        });
    },

    getSelectedAnalysts: function() {
        const filterElement = document.getElementById('analyst-filter');
        return Array.from(filterElement.selectedOptions).map(option => option.value);
    },

    renderAllMonthlyBlocks: function(monthlyData) {
        const containers = {
            status: document.getElementById('status-group-content'),
            estrategico: document.getElementById('estrategico-group-content'),
            clientes: document.getElementById('clientes-group-content'),
            tags: document.getElementById('tags-group-content')
        };
        Object.values(containers).forEach(container => {
            if (container) container.innerHTML = '';
        });
        const sortedMonths = Object.keys(monthlyData).sort();
        sortedMonths.forEach(month => {
            const monthStats = App.processData(monthlyData[month]);
            for (const groupType in containers) {
                if (containers[groupType]) {
                    const subGroup = this.createMonthlySubgroup(month, monthStats, groupType);
                    containers[groupType].appendChild(subGroup);
                }
            }
        });
    },

    createMonthlySubgroup: function(month, stats, groupType) {
        const subGroupWrapper = document.createElement('div');
        subGroupWrapper.className = 'monthly-subgroup'; 
        const groupId = `subgroup-${groupType}-${month.replace(/\s+/g, '-')}`;
        subGroupWrapper.id = groupId;
        const header = document.createElement('h3');
        header.className = 'group-header collapsed';
        header.innerHTML = `<span>${month}</span><span class="toggle-icon">+</span>`;
        
        // CORREÇÃO: Adicionando listener de clique diretamente ao header criado dinamicamente
        header.addEventListener('click', () => UI.toggleGroup(header));

        const content = document.createElement('div');
        content.className = 'group-content collapsed';
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'metrics-grid';
        const cards = this.getCardsForGroup(stats, groupType);
        gridWrapper.append(...cards);
        content.appendChild(gridWrapper);
        subGroupWrapper.append(header, content);
        return subGroupWrapper;
    },

    getCardsForGroup: function(stats, groupType) {
        const cards = [];
        switch(groupType) {
            case 'status':
                cards.push(this.createMetricCard(stats.avgPerDay, 'Média / Dia Útil'), this.createMetricCard(stats.totalAtivos, 'Tickets Ativos'), this.createListCard('Distribuição por Status', stats.byStatus));
                break;
            case 'estrategico':
                cards.push(this.createMetricCard(stats.totalCards, 'Total de Work Items'), this.createMetricCard(stats.principalWorkItemName, 'Principal Work Item', true), this.createMetricCard(stats.topEscalatedWorkItem, 'Item com Maior Taxa de Escalonamento', true), this.createListCard('Distribuição por Tipo de Item', stats.byWorkItem));
                break;
            case 'clientes':
                const escalatedTextClient = stats.topEscalatedClient !== 'N/A' ? `${stats.topEscalatedClient} (${stats.topEscalatedCount})` : 'N/A';
                const resolverText = stats.topResolverClient !== 'N/A' ? `${stats.topResolverClient} (${stats.topResolverCount})` : 'N/A';
                const listCardDataClient = Object.fromEntries(stats.top5Clientes.map(item => [item.name, item.count]));
                cards.push(this.createMetricCard(stats.totalClientesUnicos, 'Clientes Únicos'), this.createMetricCard(escalatedTextClient, 'Cliente Mais Escalonado', true), this.createMetricCard(resolverText, 'Cliente com Mais Resolvidos', true), this.createListCard('Top 5 Clientes', listCardDataClient));
                break;
            case 'tags':
                const escalatedTextTag = stats.topEscalatedTag !== 'N/A' ? `${stats.topEscalatedTag} (${stats.topEscalatedTagCount})` : 'N/A';
                const listCardDataTag = Object.fromEntries(stats.top5Tags);
                cards.push(this.createMetricCard(stats.totalTagsUnicas, 'Tags Únicas'), this.createMetricCard(stats.avgTagsPerItem, 'Média de Tags por Item'), this.createMetricCard(escalatedTextTag, 'Tag Mais Escalonada', true), this.createListCard('Top 5 Tags', listCardDataTag));
                break;
        }
        return cards;
    },
    
    createMetricCard: function(value, label, isTextValue = false) {
        const card = document.createElement('div');
        card.className = isTextValue ? 'metric-card card metric-card--text-value' : 'metric-card card';
        card.innerHTML = `<p class="value">${value}</p><p class="label">${label}</p>`;
        return card;
    },

    createListCard: function(title, data) {
        const card = document.createElement('div');
        card.className = 'metric-card card list-card';
        this._renderDistributionList(card, title, data);
        return card;
    },
    
    _renderDistributionList: function(container, titleText, dataObject) {
        container.innerHTML = '';
        const title = document.createElement('p');
        title.className = 'list-title';
        title.textContent = titleText;
        container.appendChild(title);
        const list = document.createElement('ul');
        list.className = 'status-list';
        const sortedData = Object.entries(dataObject).sort(([,a],[,b]) => b-a);
        if (sortedData.length > 0) {
            sortedData.forEach(([name, count]) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span class="status-name">${name.toLowerCase()}</span><span class="status-count">${count}</span>`;
                list.appendChild(listItem);
            });
        } else {
            list.innerHTML = '<li>Nenhum dado.</li>';
        }
        container.appendChild(list);
    },

    toggleGroup: function(header) {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.toggle-icon');
        const isCollapsed = content.classList.contains('collapsed');
        const parentId = header.parentElement.id;
        if (isCollapsed) {
            content.classList.remove('collapsed');
            header.classList.remove('collapsed');
            icon.textContent = '-';
            content.style.maxHeight = content.scrollHeight + 'px';
            localStorage.setItem(`groupState-${parentId}`, 'expanded');
        } else {
            content.classList.add('collapsed');
            header.classList.add('collapsed');
            icon.textContent = '+';
            content.style.maxHeight = null;
            localStorage.setItem(`groupState-${parentId}`, 'collapsed');
        }
        this.updateParentHeight(header);
    },

    updateParentHeight: function(element) {
        const parentContent = element.parentElement.closest('.group-content');
        if (parentContent && !parentContent.classList.contains('collapsed')) {
            setTimeout(() => {
                parentContent.style.maxHeight = parentContent.scrollHeight + 'px';
                this.updateParentHeight(parentContent);
            }, 400);
        }
    },

    applySavedStates: function() {
        document.querySelectorAll('.group-header').forEach(header => {
            const parentId = header.parentElement.id;
            if (!parentId) return;
            const savedState = localStorage.getItem(`groupState-${parentId}`);
            if (savedState === 'expanded') {
                const content = header.nextElementSibling;
                const icon = header.querySelector('.toggle-icon');
                content.style.transition = 'none';
                header.classList.remove('collapsed');
                content.classList.remove('collapsed');
                icon.textContent = '-';
                content.style.maxHeight = content.scrollHeight + 'px';
                this.updateParentHeight(header);
setTimeout(() => {
                    content.style.transition = '';
                }, 10);
            }
        });
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
            itemEl.innerHTML = `<span class="item-title">${item.title}</span><div class="item-actions"><button data-id="${item.id}" class="edit-btn">✏️</button><button data-id="${item.id}" class="delete-btn">🗑️</button></div>`;
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
};

document.addEventListener('DOMContentLoaded', App.init);