'use strict';

const App = {
    data: {
        fullRawData: [], // Armazena todos os dados do CSV
        monthlyStatsCache: {}, // Cache para estatísticas mensais para cálculo de variação
    },
    CONFIG: {
        WORKING_DAYS: 21,
        MONTH_COLUMN_NAME: 'Created Date',
        CLIENT_COLUMN_NAME: 'Cliente',
        ANALYST_COLUMN_NAME: 'Assigned To',
        WORK_ITEM_COLUMN_NAME: 'Work Item Type',
        TAGS_COLUMN_NAME: 'Tags',
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
                const rawData = JSON.parse(storedRawData);
                App.data.fullRawData = rawData;
                App.displayUserInfo(JSON.parse(storedUserInfo));
                const analystFilteredData = App.getAnalystFilteredData(true); // Popula com a seleção padrão
                UI.populateAnalystFilter(rawData, analystFilteredData); 
                UI.populateGlobalFilters(analystFilteredData);
                App.updateDashboard(); 
                App.loadProfilePicture();
            } else {
                App.openModal('setupModal');
            }
        } catch (e) {
            console.error("Erro ao verificar estado inicial:", e);
            App.clearAllData(false);
        }
    },

    attachEventListeners: function () {
        // Modal, reset, etc.
        document.getElementById('csvFileInputModal').addEventListener('change', App.handleFileSelect);
        document.getElementById('saveAndStartBtn').addEventListener('click', App.handleSetupSave);
        document.getElementById('reset-btn').addEventListener('click', () => App.clearAllData(true));
        
        // Perfil e Modais de conteúdo
        document.getElementById('profilePicContainer').addEventListener('click', () => document.getElementById('profilePicInput').click());
        document.getElementById('profilePicInput').addEventListener('change', App.handleProfilePicSelect);
        document.getElementById('openAtuacoesModal').addEventListener('click', () => App.openModal('atuacoesModal'));
        document.getElementById('openDesenvolvimentoModal').addEventListener('click', () => App.openModal('desenvolvimentoModal'));
        document.querySelectorAll('.close-btn').forEach(btn => {
            const modalId = btn.dataset.modalId;
            if (modalId) btn.addEventListener('click', () => App.closeModal(modalId));
        });

        // --- CORREÇÃO NA LÓGICA DE EVENTOS ---
        // Filtros
        document.getElementById('analyst-filter').addEventListener('change', App.handleAnalystChange);
        document.querySelector('.tabs-container').addEventListener('click', UI.handleTabClick);
        document.getElementById('global-filters-container').addEventListener('change', App.updateDashboard);

        // Controles de Visualização
        document.getElementById('expand-all-btn').addEventListener('click', UI.expandAll);
        document.getElementById('collapse-all-btn').addEventListener('click', UI.collapseAll);
        
        // Listener delegado para todos os group-headers
        document.querySelector('.container').addEventListener('click', function(event) {
            const header = event.target.closest('.group-header');
            if (header) {
                UI.toggleGroup(header);
            }
        });
    },
    
    // NOVO: Handler específico para a troca de analista
    handleAnalystChange: function() {
        const analystFilteredData = App.getAnalystFilteredData();
        // Recria os filtros globais, pois o universo de dados mudou
        UI.populateGlobalFilters(analystFilteredData);
        // Atualiza o dashboard
        App.updateDashboard();
    },

// script.js

updateDashboard: function() {
    App.data.monthlyStatsCache = {};

    // 1. Pega dados já filtrados pelo analista
    const analystFilteredData = App.getAnalystFilteredData();
    
    // 2. Aplica Filtros Globais (camada 2)
    const { filterType, filterValue } = UI.getActiveGlobalFilter();
    
    // --- NOVA LÓGICA PARA OCULTAR GRUPOS ---
    const isSpecificFilterActive = filterType !== 'geral' && filterValue !== '__ALL__';
    
    // Oculta ou mostra os grupos com base no filtro ativo
    document.getElementById('group-clientes').style.display = (filterType === 'cliente' && isSpecificFilterActive) ? 'none' : 'block';
    document.getElementById('group-tags').style.display = (filterType === 'tag' && isSpecificFilterActive) ? 'none' : 'block';
    document.getElementById('group-estrategico').style.display = (filterType === 'item' && isSpecificFilterActive) ? 'none' : 'block';
    // --- FIM DA NOVA LÓGICA ---

    let finalFilteredData = analystFilteredData;
    if (isSpecificFilterActive) {
        const columnMap = {
            cliente: App.CONFIG.CLIENT_COLUMN_NAME,
            item: App.CONFIG.WORK_ITEM_COLUMN_NAME,
            tag: App.CONFIG.TAGS_COLUMN_NAME
        };
        const filterColumn = columnMap[filterType];
        if (filterColumn) {
            finalFilteredData = analystFilteredData.filter(row => {
                if (filterType === 'tag') {
                    const tags = (row[filterColumn] || '').split(',').map(t => t.trim().toUpperCase());
                    return tags.includes(filterValue);
                }
                return (row[filterColumn] || '').toUpperCase() === filterValue;
            });
        }
    }
    
    // 3. Agrupa por mês e renderiza
    const monthlyData = App.groupDataByMonth(finalFilteredData);
    UI.renderAllMonthlyBlocks(monthlyData);
    UI.applySavedStates();
},

    initializeDashboard: function (rawData, userInfo) {
        App.data.fullRawData = rawData;
        App.displayUserInfo(userInfo);
        const analystFilteredData = App.getAnalystFilteredData(true);
        UI.populateAnalystFilter(rawData, analystFilteredData);
        UI.populateGlobalFilters(analystFilteredData);
        App.updateDashboard();
        App.loadProfilePicture();
    },
    
    getAnalystFilteredData: function(isInitialLoad = false) {
        if (isInitialLoad) return App.data.fullRawData;

        const selectedAnalysts = UI.getSelectedAnalysts();
        if (selectedAnalysts.includes('__OVERALL__') || selectedAnalysts.length === 0) {
            return App.data.fullRawData;
        } else {
            return App.data.fullRawData.filter(row => 
                selectedAnalysts.includes(row[App.CONFIG.ANALYST_COLUMN_NAME])
            );
        }
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
        const byStatus = {};
        const byWorkItem = {};
        const byTags = {};
        const dataByClient = {};
        let totalTagInstances = 0;
        const itemsWithTags = data.filter(item => item.Tags && item.Tags.trim() !== '').length;
        data.forEach(item => {
            const status = (item.State || 'SEM CATEGORIA').toUpperCase();
            const workItem = (item[App.CONFIG.WORK_ITEM_COLUMN_NAME] || 'SEM CATEGORIA').toUpperCase();
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
        const avgPerDay = totalCards > 0 ? (totalCards / App.CONFIG.WORKING_DAYS).toFixed(1) : '0.0';
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
            const workItem = (item[App.CONFIG.WORK_ITEM_COLUMN_NAME] || 'SEM CATEGORIA').toUpperCase();
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

    populateGlobalFilters: function(data) {
        const container = document.getElementById('global-filters-container');
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.filterType;
        
        // Salva o valor selecionado antes de limpar, se existir
        const previouslySelectedValue = container.querySelector('select')?.value;

        container.innerHTML = '';
        if (!activeTab || activeTab === 'geral') return;

        let options = [];
        const columnMap = {
            cliente: App.CONFIG.CLIENT_COLUMN_NAME,
            item: App.CONFIG.WORK_ITEM_COLUMN_NAME,
            tag: App.CONFIG.TAGS_COLUMN_NAME
        };
        const column = columnMap[activeTab];

        if (activeTab === 'tag') {
            const allTags = data.flatMap(row => (row[column] || '').split(',').map(t => t.trim().toUpperCase())).filter(Boolean);
            options = [...new Set(allTags)];
        } else {
            options = [...new Set(data.map(row => (row[column] || '').toUpperCase()).filter(Boolean))];
        }
        options.sort();

        const label = document.createElement('label');
        label.textContent = `Filtrar por ${activeTab}:`;
        label.htmlFor = 'global-filter-select';
        
        const select = document.createElement('select');
        select.id = 'global-filter-select';
        select.className = 'global-filter-select';
        select.innerHTML = `<option value="__ALL__">Todos</option>`;
        options.forEach(opt => {
            select.innerHTML += `<option value="${opt}">${opt}</option>`;
        });

        // Restaura a seleção anterior se ela ainda for uma opção válida
        if (previouslySelectedValue && options.includes(previouslySelectedValue)) {
            select.value = previouslySelectedValue;
        }

        container.append(label, select);
    },

    getActiveGlobalFilter: function() {
        const filterType = document.querySelector('.tab-btn.active')?.dataset.filterType || 'geral';
        const select = document.getElementById('global-filter-select');
        const filterValue = select ? select.value : null;
        return { filterType, filterValue };
    },

    handleTabClick: function(event) {
        if (event.target.classList.contains('tab-btn')) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            // Recria os filtros globais para a nova aba
            const analystFilteredData = App.getAnalystFilteredData();
            UI.populateGlobalFilters(analystFilteredData);
            // Atualiza o dashboard
            App.updateDashboard();
        }
    },

    renderAllMonthlyBlocks: function(monthlyData) {
        const containers = { status: document.getElementById('status-group-content'), estrategico: document.getElementById('estrategico-group-content'), clientes: document.getElementById('clientes-group-content'), tags: document.getElementById('tags-group-content') };
        Object.values(containers).forEach(container => { if (container) container.innerHTML = ''; });
        
        const sortedMonths = Object.keys(monthlyData).sort();
        
        sortedMonths.forEach(month => { App.data.monthlyStatsCache[month] = App.processData(monthlyData[month]); });

        sortedMonths.forEach((month, index) => {
            const monthStats = App.data.monthlyStatsCache[month];
            const prevMonth = sortedMonths[index - 1];
            const prevMonthStats = prevMonth ? App.data.monthlyStatsCache[prevMonth] : null;

            for (const groupType in containers) {
                if (containers[groupType]) {
                    const subGroup = this.createMonthlySubgroup(month, monthStats, prevMonthStats, groupType);
                    containers[groupType].appendChild(subGroup);
                }
            }
        });
    },

    createMonthlySubgroup: function(month, stats, prevStats, groupType) {
        const subGroupWrapper = document.createElement('div');
        subGroupWrapper.className = 'monthly-subgroup'; 
        const groupId = `subgroup-${groupType}-${month.replace(/\s+/g, '-')}`;
        subGroupWrapper.id = groupId;
        const header = document.createElement('h3');
        header.className = 'group-header collapsed';
        header.innerHTML = `<span>${month}</span><span class="toggle-icon">+</span>`;
        const content = document.createElement('div');
        content.className = 'group-content collapsed';
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'metrics-grid';
        const cards = this.getCardsForGroup(stats, prevStats, groupType);
        gridWrapper.append(...cards);
        content.appendChild(gridWrapper);
        subGroupWrapper.append(header, content);
        return subGroupWrapper;
    },

    getCardsForGroup: function(stats, prevStats, groupType) {
        const cards = [];
        const getVar = (field) => this.getVariationHtml(stats, prevStats, field);
        switch(groupType) {
            case 'status':
                cards.push(this.createMetricCard(stats.avgPerDay, 'Média / Dia Útil', false, getVar('avgPerDay')), this.createMetricCard(stats.totalAtivos, 'Tickets Ativos', false, getVar('totalAtivos')), this.createListCard('Distribuição por Status', stats.byStatus));
                break;
            case 'estrategico':
                cards.push(this.createMetricCard(stats.totalCards, 'Total de Work Items', false, getVar('totalCards')), this.createMetricCard(stats.principalWorkItemName, 'Principal Work Item', true), this.createMetricCard(stats.topEscalatedWorkItem, 'Item com Maior Taxa de Escalonamento', true), this.createListCard('Distribuição por Tipo de Item', stats.byWorkItem));
                break;
            case 'clientes':
                const escalatedTextClient = stats.topEscalatedClient !== 'N/A' ? `${stats.topEscalatedClient} (${stats.topEscalatedCount})` : 'N/A';
                const resolverText = stats.topResolverClient !== 'N/A' ? `${stats.topResolverClient} (${stats.topResolverCount})` : 'N/A';
                const listCardDataClient = Object.fromEntries(stats.top5Clientes.map(item => [item.name, item.count]));
                cards.push(this.createMetricCard(stats.totalClientesUnicos, 'Clientes Únicos', false, getVar('totalClientesUnicos')), this.createMetricCard(escalatedTextClient, 'Cliente Mais Escalonado', true), this.createMetricCard(resolverText, 'Cliente com Mais Resolvidos', true), this.createListCard('Top 5 Clientes', listCardDataClient));
                break;
            case 'tags':
                const escalatedTextTag = stats.topEscalatedTag !== 'N/A' ? `${stats.topEscalatedTag} (${stats.topEscalatedTagCount})` : 'N/A';
                const listCardDataTag = Object.fromEntries(stats.top5Tags);
                cards.push(this.createMetricCard(stats.totalTagsUnicas, 'Tags Únicas', false, getVar('totalTagsUnicas')), this.createMetricCard(stats.avgTagsPerItem, 'Média de Tags por Item', false, getVar('avgTagsPerItem')), this.createMetricCard(escalatedTextTag, 'Tag Mais Escalonada', true), this.createListCard('Top 5 Tags', listCardDataTag));
                break;
        }
        return cards;
    },
    
    createMetricCard: function(value, label, isTextValue = false, variationHtml = '') {
        const card = document.createElement('div');
        card.className = isTextValue ? 'metric-card card metric-card--text-value' : 'metric-card card';
        card.innerHTML = `<p class="value">${value}</p><div class="label"><span>${label}</span>${variationHtml}</div>`;
        return card;
    },

    getVariationHtml: function(currentStats, prevStats, field) {
        if (!prevStats) return '';
        const current = parseFloat(currentStats[field]);
        const previous = parseFloat(prevStats[field]);
        if (isNaN(current) || isNaN(previous) || previous === 0) return '';
        const diff = current - previous;
        const variation = (diff / previous) * 100;
        if (Math.abs(variation) < 0.1) return `<span class="kpi-variation neutral">(→ 0.0%)</span>`;
        const symbol = diff > 0 ? '↑' : '↓';
        const cssClass = diff > 0 ? 'up' : 'down';
        return `<span class="kpi-variation ${cssClass}">(${symbol} ${variation.toFixed(1)}%)</span>`;
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
        if (!content) return;
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
                if (!content) return;
                const icon = header.querySelector('.toggle-icon');
                content.style.transition = 'none';
                header.classList.remove('collapsed');
                content.classList.remove('collapsed');
                icon.textContent = '-';
                content.style.maxHeight = content.scrollHeight + 'px';
                this.updateParentHeight(header);
                setTimeout(() => { content.style.transition = ''; }, 50);
            }
        });
    },

    expandAll: function() {
        document.querySelectorAll('.metrics-group > .group-header').forEach(header => {
            if (header.classList.contains('collapsed')) UI.toggleGroup(header);
        });
    },

    collapseAll: function() {
        document.querySelectorAll('.group-header').forEach(header => {
            if (!header.classList.contains('collapsed')) UI.toggleGroup(header);
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