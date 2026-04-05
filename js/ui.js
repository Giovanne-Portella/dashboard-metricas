'use strict';

/**
 * UI — responsável por toda a renderização e interação com o DOM.
 */
const UI = {

    // ─── Filtros de analista ──────────────────────────────────────────────────

    /**
     * Preenche o select de filtragem por analista.
     * @param {Object[]} rawData - Dados completos do CSV.
     */
    populateAnalystFilter(rawData) {
        const select = document.getElementById('analyst-filter');
        select.innerHTML = '';

        const names = [...new Set(
            rawData.map(row => row[CONFIG.ANALYST_COLUMN_NAME]).filter(Boolean)
        )].sort();

        const overall = document.createElement('option');
        overall.value    = '__OVERALL__';
        overall.textContent = 'Visão Geral';
        overall.selected = true;
        select.appendChild(overall);

        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value       = name;
            opt.textContent = name.split('<')[0].trim(); // remove e-mail se vier junto
            select.appendChild(opt);
        });
    },

    /**
     * Retorna os analistas atualmente selecionados.
     * @returns {string[]}
     */
    getSelectedAnalysts() {
        return Array.from(
            document.getElementById('analyst-filter').selectedOptions
        ).map(o => o.value);
    },

    // ─── Filtros globais (aba ativa) ─────────────────────────────────────────

    /**
     * Popula o select de filtro global conforme a aba ativa.
     * @param {Object[]} data - Dados já filtrados por analista.
     */
    populateGlobalFilters(data) {
        const container   = document.getElementById('global-filters-container');
        const activeTab   = document.querySelector('.tab-btn.active')?.dataset.filterType;
        const prevValue   = container.querySelector('select')?.value;
        container.innerHTML = '';

        if (!activeTab || activeTab === 'geral') return;

        const columnMap = {
            cliente: CONFIG.CLIENT_COLUMN_NAME,
            item:    CONFIG.WORK_ITEM_COLUMN_NAME,
            tag:     CONFIG.TAGS_COLUMN_NAME,
        };
        const column = columnMap[activeTab];
        let options  = [];

        if (activeTab === 'tag') {
            const allTags = data.flatMap(row =>
                (row[column] || '').split(',').map(t => t.trim().toUpperCase())
            ).filter(Boolean);
            options = [...new Set(allTags)];
        } else {
            options = [...new Set(
                data.map(row => (row[column] || '').toUpperCase()).filter(Boolean)
            )];
        }
        options.sort();

        const label = document.createElement('label');
        label.textContent = `Filtrar por ${activeTab}:`;
        label.htmlFor     = 'global-filter-select';

        const select = document.createElement('select');
        select.id        = 'global-filter-select';
        select.className = 'global-filter-select';

        const allOpt = document.createElement('option');
        allOpt.value = '__ALL__';
        allOpt.textContent = 'Todos';
        select.appendChild(allOpt);

        options.forEach(opt => {
            const o = document.createElement('option');
            o.value       = opt;
            o.textContent = opt;
            select.appendChild(o);
        });

        if (prevValue && options.includes(prevValue)) select.value = prevValue;

        container.append(label, select);
    },

    /**
     * Retorna o filtro global ativo (tipo + valor selecionado).
     * @returns {{ filterType: string, filterValue: string|null }}
     */
    getActiveGlobalFilter() {
        const filterType = document.querySelector('.tab-btn.active')?.dataset.filterType || 'geral';
        const select     = document.getElementById('global-filter-select');
        return { filterType, filterValue: select ? select.value : null };
    },

    /** Trata clique nas abas de tipo de filtro. */
    handleTabClick(event) {
        if (!event.target.classList.contains('tab-btn')) return;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        UI.populateGlobalFilters(App.getAnalystFilteredData());
        App.updateDashboard();
    },

    // ─── Renderização dos blocos mensais ─────────────────────────────────────

    /**
     * Renderiza todos os subgrupos mensais em seus respectivos contêineres.
     * @param {{ [monthKey: string]: Object[] }} monthlyData
     */
    renderAllMonthlyBlocks(monthlyData) {
        const containers = {
            status:     document.getElementById('status-group-content'),
            estrategico:document.getElementById('estrategico-group-content'),
            clientes:   document.getElementById('clientes-group-content'),
            tags:       document.getElementById('tags-group-content'),
        };
        Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });

        // Ordenação cronológica correta
        const monthOrder  = DataProcessor.MONTH_NAMES;
        const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
            const [mA, yA] = a.split('/');
            const [mB, yB] = b.split('/');
            const yearDiff = parseInt(yA, 10) - parseInt(yB, 10);
            if (yearDiff !== 0) return yearDiff;
            return monthOrder.indexOf(mA) - monthOrder.indexOf(mB);
        });

        // Pré-processa para permitir cálculo de variação entre meses
        sortedMonths.forEach(month => {
            App.data.monthlyStatsCache[month] = DataProcessor.process(monthlyData[month]);
        });

        sortedMonths.forEach((month, index) => {
            const stats     = App.data.monthlyStatsCache[month];
            const prevMonth = sortedMonths[index - 1];
            const prevStats = prevMonth ? App.data.monthlyStatsCache[prevMonth] : null;

            for (const groupType in containers) {
                if (containers[groupType]) {
                    containers[groupType].appendChild(
                        this._createMonthlySubgroup(month, stats, prevStats, groupType)
                    );
                }
            }
        });
    },

    /**
     * Cria o wrapper de um mês dentro de um grupo.
     */
    _createMonthlySubgroup(month, stats, prevStats, groupType) {
        const wrapper = document.createElement('div');
        wrapper.className = 'monthly-subgroup';
        wrapper.id        = `subgroup-${groupType}-${month.replace(/\s+/g, '-')}`;

        const header  = document.createElement('h3');
        header.className = 'group-header collapsed';
        header.innerHTML = `<span>${month}</span><span class="toggle-icon">+</span>`;

        const content = document.createElement('div');
        content.className = 'group-content collapsed';

        const grid = document.createElement('div');
        grid.className = 'metrics-grid';
        grid.append(...this._getCardsForGroup(stats, prevStats, groupType));

        content.appendChild(grid);
        wrapper.append(header, content);
        return wrapper;
    },

    /**
     * Retorna os cards de métricas para o tipo de grupo especificado.
     */
    _getCardsForGroup(stats, prevStats, groupType) {
        const cards  = [];
        const getVar = (field) => this._getVariationHtml(stats, prevStats, field);

        switch (groupType) {
            case 'status':
                cards.push(
                    this._createMetricCard(stats.avgPerDay,      'Média / Dia Útil',         false, getVar('avgPerDay')),
                    this._createMetricCard(stats.totalAtivos,    'Tickets Ativos',            false, getVar('totalAtivos')),
                    this._createMetricCard(`${stats.avgHorasUteis} h`, 'Tempo Médio de Atuação', false, getVar('avgHorasUteis')),
                    this._createListCard('Distribuição por Status', stats.byStatus),
                );
                break;

            case 'estrategico':
                cards.push(
                    this._createMetricCard(stats.totalCards,            'Total de Work Items',     false, getVar('totalCards')),
                    this._createMetricCard(stats.principalWorkItemName, 'Principal Work Item',     true),
                    this._createMetricCard(stats.productivity,          'Tickets / Hora',          false, getVar('productivity')),
                    this._createMetricCard(stats.avgCostPerTicket,      'Custo Médio / Ticket',    false, getVar('avgCostPerTicket')),
                    this._createListCard('Distribuição por Tipo de Item', stats.byWorkItem),
                );
                break;

            case 'clientes': {
                const escalatedText = stats.topEscalatedClient !== 'N/A'
                    ? `${stats.topEscalatedClient} (${stats.topEscalatedCount})` : 'N/A';
                const top5Data = Object.fromEntries(stats.top5Clientes.map(i => [i.name, i.count]));
                cards.push(
                    this._createMetricCard(stats.totalClientesUnicos, 'Clientes Únicos',           false, getVar('totalClientesUnicos')),
                    this._createMetricCard(escalatedText,             'Cliente Mais Escalonado',   true),
                    this._createMetricCard(`${stats.avgHorasUteis} h`,'Tempo Médio de Atuação',   false, getVar('avgHorasUteis')),
                    this._createListCard('Top 5 Clientes', top5Data),
                );
                break;
            }

            case 'tags': {
                const escalatedText = stats.topEscalatedTag !== 'N/A'
                    ? `${stats.topEscalatedTag} (${stats.topEscalatedTagCount})` : 'N/A';
                const top5Data = Object.fromEntries(stats.top5Tags);
                cards.push(
                    this._createMetricCard(stats.totalTagsUnicas, 'Tags Únicas',              false, getVar('totalTagsUnicas')),
                    this._createMetricCard(stats.avgTagsPerItem,  'Média de Tags por Item',   false, getVar('avgTagsPerItem')),
                    this._createMetricCard(`${stats.avgHorasUteis} h`, 'Tempo Médio de Atuação', false, getVar('avgHorasUteis')),
                    this._createListCard('Top 5 Tags', top5Data),
                );
                break;
            }
        }
        return cards;
    },

    /**
     * Cria um card de métrica simples.
     * @param {*}       value        - Valor a exibir.
     * @param {string}  label        - Rótulo.
     * @param {boolean} isTextValue  - Se true, usa estilos de texto longo.
     * @param {string}  variationHtml- HTML do indicador de variação (KPI ↑↓).
     */
    _createMetricCard(value, label, isTextValue = false, variationHtml = '') {
        const card = document.createElement('div');
        card.className = `metric-card card${isTextValue ? ' metric-card--text' : ''}`;
        card.innerHTML = `
            <p class="value">${value}</p>
            <div class="label">
                <span>${label}</span>
                ${variationHtml}
            </div>`;
        return card;
    },

    /**
     * Gera o HTML do indicador de variação entre dois períodos.
     */
    _getVariationHtml(currentStats, prevStats, field) {
        if (!prevStats) return '';
        const current  = parseFloat(currentStats[field]);
        const previous = parseFloat(prevStats[field]);
        if (isNaN(current) || isNaN(previous) || previous === 0) return '';

        const diff      = current - previous;
        const variation = (diff / previous) * 100;

        if (Math.abs(variation) < 0.1) {
            return `<span class="kpi-variation neutral">(→ 0.0%)</span>`;
        }
        const symbol   = diff > 0 ? '↑' : '↓';
        const cssClass = diff > 0 ? 'up' : 'down';
        return `<span class="kpi-variation ${cssClass}">(${symbol} ${variation.toFixed(1)}%)</span>`;
    },

    /**
     * Cria um card de lista (distribuição).
     */
    _createListCard(title, data) {
        const card = document.createElement('div');
        card.className = 'metric-card card list-card';

        const titleEl = document.createElement('p');
        titleEl.className   = 'list-title';
        titleEl.textContent = title;
        card.appendChild(titleEl);

        const list       = document.createElement('ul');
        list.className   = 'status-list';
        const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);

        if (sortedData.length > 0) {
            sortedData.forEach(([name, count]) => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="status-name">${name.toLowerCase()}</span><span class="status-count">${count}</span>`;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li>Nenhum dado.</li>';
        }

        card.appendChild(list);
        return card;
    },

    // ─── Acordeão ────────────────────────────────────────────────────────────

    /**
     * Abre ou fecha um grupo acordeão.
     * @param {HTMLElement} header - O elemento .group-header clicado.
     */
    toggleGroup(header) {
        const content  = header.nextElementSibling;
        if (!content) return;
        const icon     = header.querySelector('.toggle-icon');
        const parentId = header.parentElement.id;
        const isCollapsed = content.classList.contains('collapsed');

        if (isCollapsed) {
            content.classList.remove('collapsed');
            header.classList.remove('collapsed');
            if (icon) icon.textContent = '−';
            content.style.maxHeight = content.scrollHeight + 'px';
            if (parentId) localStorage.setItem(`groupState-${parentId}`, 'expanded');
        } else {
            content.classList.add('collapsed');
            header.classList.add('collapsed');
            if (icon) icon.textContent = '+';
            content.style.maxHeight = null;
            if (parentId) localStorage.setItem(`groupState-${parentId}`, 'collapsed');
        }
        this._updateParentHeight(header);
    },

    /** Propaga a atualização de altura para contêineres ancestor. */
    _updateParentHeight(element) {
        const parentContent = element.parentElement.closest('.group-content');
        if (parentContent && !parentContent.classList.contains('collapsed')) {
            setTimeout(() => {
                parentContent.style.maxHeight = parentContent.scrollHeight + 'px';
                this._updateParentHeight(parentContent);
            }, 420);
        }
    },

    /** Restaura os estados expandidos/colapsados salvos no localStorage. */
    applySavedStates() {
        document.querySelectorAll('.group-header').forEach(header => {
            const parentId = header.parentElement.id;
            if (!parentId) return;
            if (localStorage.getItem(`groupState-${parentId}`) !== 'expanded') return;

            const content = header.nextElementSibling;
            if (!content) return;
            const icon = header.querySelector('.toggle-icon');

            content.style.transition = 'none';
            header.classList.remove('collapsed');
            content.classList.remove('collapsed');
            if (icon) icon.textContent = '−';
            content.style.maxHeight = content.scrollHeight + 'px';
            this._updateParentHeight(header);
            setTimeout(() => { content.style.transition = ''; }, 50);
        });
    },

    /** Expande todos os grupos de nível superior. */
    expandAll() {
        document.querySelectorAll('.metrics-group > .group-header').forEach(header => {
            if (header.classList.contains('collapsed')) this.toggleGroup(header);
        });
    },

    /** Colapsa todos os grupos. */
    collapseAll() {
        document.querySelectorAll('.group-header').forEach(header => {
            if (!header.classList.contains('collapsed')) this.toggleGroup(header);
        });
    },
};
