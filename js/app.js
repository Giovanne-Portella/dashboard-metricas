'use strict';

/**
 * App — controlador principal da aplicação.
 *
 * Melhorias em relação à versão original:
 *  - Referências a `this` corretamente vinculadas via arrow functions
 *  - Validação de CSV vazio após o parse
 *  - Leitura do arquivo com encoding UTF-8 explícito
 *  - Fechar modal de setup ao clicar no backdrop
 *  - Fechar modais fullscreen com tecla Escape
 *  - `handleMouseMove` agora é função nomeada para poder ser removida como listener
 *  - `_displayProfilePicture` cria elemento <img> sem innerHTML (evita XSS)
 */
const App = {
    data: {
        /** @type {Object[]} Todos os registros do CSV carregado */
        fullRawData:       [],
        /** @type {{ [monthKey: string]: Object }} Cache de métricas por mês */
        monthlyStatsCache: {},
    },

    // ─── Inicialização ────────────────────────────────────────────────────────

    init() {
        ThemeSwitcher.init();
        this._attachEventListeners();
        this._checkInitialState();
        EditableSection.init('atuacoes',      'principalAtuaacoesData');
        EditableSection.init('desenvolvimento','meuDesenvolvimentoData');
    },

    _checkInitialState() {
        try {
            const storedData = localStorage.getItem('rawDashboardData');
            const storedUser = localStorage.getItem('userInfo');

            if (storedData && storedUser) {
                const rawData  = JSON.parse(storedData);
                const userInfo = JSON.parse(storedUser);
                this.data.fullRawData = rawData;
                this._displayUserInfo(userInfo);

                const filtered = this.getAnalystFilteredData(true);
                UI.populateAnalystFilter(rawData);
                UI.populateGlobalFilters(filtered);
                this.updateDashboard();
                this._loadProfilePicture();
            } else {
                this._openModal('setupModal');
            }
        } catch (e) {
            console.error('Erro ao verificar estado inicial:', e);
            this.clearAllData(false);
        }
    },

    // ─── Event Listeners ─────────────────────────────────────────────────────

    _attachEventListeners() {
        // Modal de configuração inicial
        document.getElementById('csvFileInputModal')
            .addEventListener('change', (e) => this._handleFileSelect(e));
        document.getElementById('saveAndStartBtn')
            .addEventListener('click', () => this._handleSetupSave());

        // Fechar modal de setup ao clicar no backdrop
        document.getElementById('setupModal')
            .addEventListener('click', (e) => {
                if (e.target === e.currentTarget) this._closeModal('setupModal');
            });

        // Reset geral
        document.getElementById('reset-btn')
            .addEventListener('click', () => this.clearAllData(true));

        // Foto de perfil
        document.getElementById('profilePicContainer')
            .addEventListener('click', () => document.getElementById('profilePicInput').click());
        document.getElementById('profilePicInput')
            .addEventListener('change', (e) => this._handleProfilePicSelect(e));

        // Modais de conteúdo
        document.getElementById('openAtuacoesModal')
            .addEventListener('click', () => this._openModal('atuacoesModal'));
        document.getElementById('openDesenvolvimentoModal')
            .addEventListener('click', () => this._openModal('desenvolvimentoModal'));
        document.querySelectorAll('.close-btn[data-modal-id]').forEach(btn => {
            btn.addEventListener('click', () => this._closeModal(btn.dataset.modalId));
        });

        // Fechar modais fullscreen com Escape
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            ['atuacoesModal', 'desenvolvimentoModal'].forEach(id => {
                if (!document.getElementById(id).classList.contains('modal--hidden')) {
                    this._closeModal(id);
                }
            });
        });

        // Filtros
        document.getElementById('analyst-filter')
            .addEventListener('change', () => this._handleAnalystChange());
        document.querySelector('.tabs-container')
            .addEventListener('click', (e) => UI.handleTabClick(e));
        document.getElementById('global-filters-container')
            .addEventListener('change', () => this.updateDashboard());

        // Controles de visualização (expandir/recolher tudo)
        document.getElementById('expand-all-btn')
            .addEventListener('click', () => UI.expandAll());
        document.getElementById('collapse-all-btn')
            .addEventListener('click', () => UI.collapseAll());

        // Delegação para headers de acordeão
        document.querySelector('.container').addEventListener('click', (e) => {
            const header = e.target.closest('.group-header');
            if (header) UI.toggleGroup(header);
        });
    },

    // ─── Fluxo de dados ───────────────────────────────────────────────────────

    _handleAnalystChange() {
        const filtered = this.getAnalystFilteredData();
        UI.populateGlobalFilters(filtered);
        this.updateDashboard();
    },

    /**
     * Recalcula e re-renderiza todo o dashboard com os filtros ativos.
     */
    updateDashboard() {
        this.data.monthlyStatsCache = {};

        const analystFiltered = this.getAnalystFilteredData();
        const { filterType, filterValue } = UI.getActiveGlobalFilter();
        const isSpecific = filterType !== 'geral' && filterValue !== '__ALL__';

        // Oculta grupos que não fazem sentido quando um filtro específico está ativo
        document.getElementById('group-clientes').style.display   =
            (filterType === 'cliente' && isSpecific) ? 'none' : 'block';
        document.getElementById('group-tags').style.display       =
            (filterType === 'tag'     && isSpecific) ? 'none' : 'block';
        document.getElementById('group-estrategico').style.display =
            (filterType === 'item'    && isSpecific) ? 'none' : 'block';

        let finalData = analystFiltered;
        if (isSpecific) {
            const columnMap = {
                cliente: CONFIG.CLIENT_COLUMN_NAME,
                item:    CONFIG.WORK_ITEM_COLUMN_NAME,
                tag:     CONFIG.TAGS_COLUMN_NAME,
            };
            const col = columnMap[filterType];
            if (col) {
                finalData = analystFiltered.filter(row => {
                    if (filterType === 'tag') {
                        return (row[col] || '').split(',')
                            .map(t => t.trim().toUpperCase())
                            .includes(filterValue);
                    }
                    return (row[col] || '').toUpperCase() === filterValue;
                });
            }
        }

        const monthlyData = DataProcessor.groupByMonth(finalData);
        UI.renderAllMonthlyBlocks(monthlyData);
        UI.applySavedStates();
    },

    /**
     * Retorna os dados filtrados conforme analistas selecionados.
     * @param {boolean} isInitialLoad - Se `true`, retorna todos os dados sem filtro.
     */
    getAnalystFilteredData(isInitialLoad = false) {
        if (isInitialLoad) return this.data.fullRawData;

        const selected = UI.getSelectedAnalysts();
        if (selected.includes('__OVERALL__') || selected.length === 0) {
            return this.data.fullRawData;
        }
        return this.data.fullRawData.filter(row =>
            selected.includes(row[CONFIG.ANALYST_COLUMN_NAME])
        );
    },

    _initializeDashboard(rawData, userInfo) {
        this.data.fullRawData = rawData;
        this._displayUserInfo(userInfo);
        const filtered = this.getAnalystFilteredData(true);
        UI.populateAnalystFilter(rawData);
        UI.populateGlobalFilters(filtered);
        this.updateDashboard();
        this._loadProfilePicture();
    },

    // ─── Handlers de formulário ───────────────────────────────────────────────

    _handleFileSelect(event) {
        const file = event.target.files[0];
        document.getElementById('modalFileName').textContent =
            file ? file.name : 'Nenhum arquivo selecionado';
        document.getElementById('saveAndStartBtn').disabled = !file;
    },

    _handleSetupSave() {
        const name  = document.getElementById('userName').value.trim();
        const role  = document.getElementById('userRole').value.trim();
        const file  = document.getElementById('csvFileInputModal').files[0];

        if (!name || !role || !file) {
            alert('Preencha todos os campos e selecione o arquivo CSV.');
            return;
        }

        const userInfo = { name, role };
        const reader   = new FileReader();

        reader.onerror = () => alert('Erro ao ler o arquivo. Tente novamente.');
        reader.onload  = (e) => {
            try {
                const rawData = CSVParser.parse(e.target.result);
                if (rawData.length === 0) {
                    alert('O arquivo CSV está vazio ou com formato inválido.\nVerifique se o delimitador é ";" ou ",".');
                    return;
                }
                localStorage.setItem('rawDashboardData', JSON.stringify(rawData));
                localStorage.setItem('userInfo',         JSON.stringify(userInfo));
                this._closeModal('setupModal');
                this._initializeDashboard(rawData, userInfo);
            } catch (err) {
                alert('Erro ao processar o arquivo CSV. Verifique o formato do arquivo.');
                console.error('Erro no CSV:', err);
            }
        };

        reader.readAsText(file, 'UTF-8');
    },

    _displayUserInfo(userInfo) {
        document.getElementById('headerName').textContent = userInfo.name;
        document.getElementById('headerRole').textContent = userInfo.role;
    },

    // ─── Foto de perfil ───────────────────────────────────────────────────────

    _loadProfilePicture() {
        const url = localStorage.getItem('profilePicture');
        if (url) this._displayProfilePicture(url);
    },

    _handleProfilePicSelect(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            localStorage.setItem('profilePicture', e.target.result);
            this._displayProfilePicture(e.target.result);
        };
        reader.readAsDataURL(file);
    },

    /** Exibe a foto de perfil sem usar innerHTML para evitar XSS. */
    _displayProfilePicture(url) {
        const container = document.getElementById('profilePicContainer');
        container.innerHTML = '';
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Foto de Perfil';
        container.appendChild(img);
    },

    // ─── Utilitários ─────────────────────────────────────────────────────────

    /**
     * Apaga todos os dados e recarrega a página.
     * @param {boolean} confirmFirst - Se true, exibe diálogo de confirmação.
     */
    clearAllData(confirmFirst) {
        if (confirmFirst && !confirm(
            'Tem certeza que deseja apagar todos os dados?\n' +
            'Isso limpará o dashboard e exigirá uma nova configuração.'
        )) return;

        localStorage.clear();
        window.location.reload();
    },

    _openModal(modalId)  { document.getElementById(modalId)?.classList.remove('modal--hidden'); },
    _closeModal(modalId) { document.getElementById(modalId)?.classList.add('modal--hidden'); },

    /**
     * Atualiza as variáveis CSS do efeito spotlight no tema escuro.
     * Deve ser uma função nomeada (não arrow) para poder ser removida como listener.
     */
    handleMouseMove(e) {
        const x = Math.round((e.clientX / window.innerWidth)  * 100);
        const y = Math.round((e.clientY / window.innerHeight) * 100);
        document.body.style.setProperty('--mouse-x', `${x}%`);
        document.body.style.setProperty('--mouse-y', `${y}%`);
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
