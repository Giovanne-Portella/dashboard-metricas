'use strict';

/**
 * DataProcessor — agrupa e processa os dados brutos do CSV.
 */
const DataProcessor = {
    MONTH_NAMES: [
        'Janeiro', 'Fevereiro', 'Março',    'Abril',   'Maio',     'Junho',
        'Julho',   'Agosto',    'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ],

    /**
     * Agrupa as linhas do CSV por mês/ano.
     * Aceita datas no formato dd/mm/aaaa ou dd/mm/aaaa hh:mm.
     * @param {Object[]} data
     * @returns {{ [monthKey: string]: Object[] }}
     */
    groupByMonth(data) {
        const col    = CONFIG.MONTH_COLUMN_NAME;
        const groups = {};

        data.forEach(row => {
            const dateStr = row[col];
            if (!dateStr) return;

            const datePart = dateStr.split(' ')[0];
            const parts    = datePart.split('/');
            if (parts.length !== 3) return;

            const month = parseInt(parts[1], 10);
            const year  = parseInt(parts[2], 10);
            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return;

            const key = `${this.MONTH_NAMES[month - 1]}/${year}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });

        return groups;
    },

    /**
     * Calcula todas as métricas para um conjunto de dados de um período.
     * @param {Object[]} data
     * @returns {Object} Objeto com todas as métricas calculadas.
     */
    process(data) {
        const findMax = (obj) => {
            const entries = Object.entries(obj);
            return entries.length === 0
                ? [null, 0]
                : entries.reduce((a, b) => (a[1] > b[1] ? a : b));
        };

        const normalizeClient = (name) => {
            if (typeof name !== 'string' || !name.trim()) return 'SEM CATEGORIA';
            return name.trim().toUpperCase().split(' ')[0];
        };

        // ── Horas úteis ──────────────────────────────────────────────────────────
        const horasValidas = data
            .map(row => parseFloat(String(row[CONFIG.HORAS_UTEIS_COLUMN_NAME] || '').replace(',', '.')))
            .filter(h => !isNaN(h) && h > 0);
        const totalHoras   = horasValidas.reduce((s, h) => s + h, 0);
        const avgHoras     = horasValidas.length > 0 ? totalHoras / horasValidas.length : 0;

        // ── Agregações principais ────────────────────────────────────────────────
        const byStatus = {}, byWorkItem = {}, byTags = {}, dataByClient = {};
        let totalTagInstances = 0;
        const itemsWithTags = data.filter(r => r.Tags && r.Tags.trim() !== '').length;

        data.forEach(item => {
            const status   = (item.State                           || 'SEM CATEGORIA').toUpperCase();
            const workItem = (item[CONFIG.WORK_ITEM_COLUMN_NAME]   || 'SEM CATEGORIA').toUpperCase();
            const client   = normalizeClient(item[CONFIG.CLIENT_COLUMN_NAME]);

            byStatus[status]     = (byStatus[status]     || 0) + 1;
            byWorkItem[workItem] = (byWorkItem[workItem] || 0) + 1;

            if (!dataByClient[client]) dataByClient[client] = [];
            dataByClient[client].push(item);

            const tags = (item.Tags || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            totalTagInstances += tags.length;
            tags.forEach(tag => { byTags[tag] = (byTags[tag] || 0) + 1; });
        });

        const totalCards        = data.length;
        const closedStates      = ['FECHADO', 'RESOLVIDO'];
        const totalAtivos       = totalCards - closedStates.reduce((s, st) => s + (byStatus[st] || 0), 0);
        const avgPerDay         = totalCards > 0 ? (totalCards / CONFIG.WORKING_DAYS).toFixed(1) : '0.0';
        const totalClientesUnicos = Object.keys(dataByClient)
            .filter(n => n !== 'GERAL' && n !== 'SEM CATEGORIA').length;
        const top5Clientes      = Object.entries(dataByClient)
            .map(([name, items]) => ({ name, count: items.length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // ── Escalonados ──────────────────────────────────────────────────────────
        const escalatedItems = data.filter(r => (r.State || '').toUpperCase() === 'ESCALONADO ENGENHARIA');

        const escalatedClientCounts = {};
        escalatedItems.forEach(item => {
            const c = normalizeClient(item[CONFIG.CLIENT_COLUMN_NAME]);
            if (c !== 'GERAL' && c !== 'SEM CATEGORIA') {
                escalatedClientCounts[c] = (escalatedClientCounts[c] || 0) + 1;
            }
        });
        const [topEscalatedClient, topEscalatedCount] = findMax(escalatedClientCounts);

        // ── Resolvidos ───────────────────────────────────────────────────────────
        const resolvedClientCounts = {};
        data.filter(r => closedStates.includes((r.State || '').toUpperCase()))
            .forEach(item => {
                const c = normalizeClient(item[CONFIG.CLIENT_COLUMN_NAME]);
                if (c !== 'GERAL' && c !== 'SEM CATEGORIA') {
                    resolvedClientCounts[c] = (resolvedClientCounts[c] || 0) + 1;
                }
            });
        const [topResolverClient, topResolverCount] = findMax(resolvedClientCounts);

        // ── Work Items por taxa de escalação ────────────────────────────────────
        const [principalWorkItemName] = findMax(byWorkItem);
        const escalatedWorkItemCounts = {};
        escalatedItems.forEach(item => {
            const wi = (item[CONFIG.WORK_ITEM_COLUMN_NAME] || 'SEM CATEGORIA').toUpperCase();
            escalatedWorkItemCounts[wi] = (escalatedWorkItemCounts[wi] || 0) + 1;
        });

        let topEscalatedWorkItem = 'N/A';
        let maxRate = -1;
        for (const wi in byWorkItem) {
            const rate = (escalatedWorkItemCounts[wi] || 0) / byWorkItem[wi];
            if (rate > maxRate) {
                maxRate = rate;
                topEscalatedWorkItem = `${wi} (${(maxRate * 100).toFixed(0)}%)`;
            }
        }

        // ── Tags ─────────────────────────────────────────────────────────────────
        const totalTagsUnicas = Object.keys(byTags).length;
        const top5Tags        = Object.entries(byTags).sort(([, a], [, b]) => b - a).slice(0, 5);
        const avgTagsPerItem  = itemsWithTags > 0 ? (totalTagInstances / itemsWithTags).toFixed(1) : '0.0';

        const escalatedTagCounts = {};
        escalatedItems.forEach(item => {
            (item.Tags || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
                .forEach(tag => { escalatedTagCounts[tag] = (escalatedTagCounts[tag] || 0) + 1; });
        });
        const [topEscalatedTag, topEscalatedTagCount] = findMax(escalatedTagCounts);

        // ── Produtividade e custo ────────────────────────────────────────────────
        const productivity     = totalHoras > 0 ? (totalCards / totalHoras).toFixed(2) : 0;
        const avgCostPerTicket = avgHoras > 0 && CONFIG.COST_PER_HOUR > 0
            ? avgHoras * CONFIG.COST_PER_HOUR : 0;

        return {
            totalCards,
            avgPerDay,
            byStatus,
            totalAtivos,
            totalClientesUnicos,
            top5Clientes,
            topEscalatedClient:    topEscalatedClient    || 'N/A',
            topEscalatedCount:     topEscalatedCount     || 0,
            topResolverClient:     topResolverClient     || 'N/A',
            topResolverCount:      topResolverCount      || 0,
            byWorkItem,
            principalWorkItemName: principalWorkItemName || 'N/A',
            topEscalatedWorkItem,
            totalTagsUnicas,
            top5Tags,
            avgTagsPerItem,
            topEscalatedTag:       topEscalatedTag       || 'N/A',
            topEscalatedTagCount:  topEscalatedTagCount  || 0,
            avgHorasUteis:         avgHoras > 0 ? avgHoras.toFixed(2) : 'N/A',
            productivity:          productivity > 0 ? productivity : 'N/A',
            avgCostPerTicket:      avgCostPerTicket > 0 ? `R$ ${avgCostPerTicket.toFixed(2)}` : 'N/A',
        };
    },
};
