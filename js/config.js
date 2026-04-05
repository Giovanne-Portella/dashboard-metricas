'use strict';

/**
 * CONFIG — Constantes globais da aplicação.
 * Altere os valores aqui para adaptar o dashboard ao seu contexto.
 */
const CONFIG = Object.freeze({
    /** Número de dias úteis usados no cálculo de média diária */
    WORKING_DAYS: 22,

    /** Custo da hora de trabalho em Reais (R$), usado no cálculo de custo por ticket */
    COST_PER_HOUR: 18,

    // ─── Nomes das colunas do CSV ────────────────────────────────────────────────
    MONTH_COLUMN_NAME:      'Created Date',
    CLIENT_COLUMN_NAME:     'Cliente',
    ANALYST_COLUMN_NAME:    'Assigned To',
    WORK_ITEM_COLUMN_NAME:  'Work Item Type',
    TAGS_COLUMN_NAME:       'Tags',
    HORAS_UTEIS_COLUMN_NAME:'Horas Uteis',
});
