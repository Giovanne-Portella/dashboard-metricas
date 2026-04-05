'use strict';

/**
 * CSVParser — responsável por ler e converter texto CSV em array de objetos.
 *
 * Melhorias em relação à versão original:
 *  - Auto-detecção de delimitador (`;` ou `,`)
 *  - Suporte a campos entre aspas (incluindo campos com o delimitador dentro)
 *  - Tratamento robusto de quebras de linha (\r\n, \r, \n)
 *  - Validação de arquivo vazio
 */
const CSVParser = {
    /**
     * Converte texto CSV em array de objetos.
     * @param {string} text - Conteúdo bruto do arquivo CSV.
     * @returns {Object[]} Array de objetos com as colunas como chaves.
     */
    parse(text) {
        const normalized = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalized.split('\n');

        if (lines.length < 2) return [];

        const delimiter = this._detectDelimiter(lines[0]);
        const headers = this._splitLine(lines[0], delimiter);

        return lines
            .slice(1)
            .filter(line => line.trim() !== '')
            .map(line => {
                const values = this._splitLine(line, delimiter);
                const obj = {};
                headers.forEach((key, i) => {
                    obj[key] = values[i] !== undefined ? values[i] : '';
                });
                return obj;
            });
    },

    /**
     * Detecta automaticamente o delimitador da primeira linha.
     * @param {string} headerLine
     * @returns {string} ';' ou ','
     */
    _detectDelimiter(headerLine) {
        const semis  = (headerLine.match(/;/g)  || []).length;
        const commas = (headerLine.match(/,/g) || []).length;
        return semis >= commas ? ';' : ',';
    },

    /**
     * Divide uma linha respeitando campos entre aspas duplas.
     * @param {string} line
     * @param {string} delimiter
     * @returns {string[]}
     */
    _splitLine(line, delimiter) {
        const result = [];
        let current  = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                // Aspas duplas escapadas dentro do campo: ""
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    },
};
