'use strict';

const App = {
    charts: { status: null, tags: null, workItem: null },
    data: { stats: null },
    CONFIG: {
        WORKING_DAYS: 21,
        CHART_COLORS: {
            light: ['#007bff', '#17a2b8', '#28a745', '#ffc107', '#dc3545', '#6c757d'],
            dark: ['#ff79c6', '#8be9fd', '#50fa7b', '#f1fa8c', '#ffb86c', '#ff5555', '#bd93f9']
        }
    },

    init: function () {
        ThemeSwitcher.init();
        App.attachEventListeners();
        App.checkInitialState();
        EditableSection.init('atuacoes', 'principalAtuacoesData');
        EditableSection.init('desenvolvimento', 'meuDesenvolvimentoData');
        GeminiAI.init();
        App.adjustAIPanelHeight(); // <-- CHAMADA ADICIONADA
    },

    checkInitialState: function () {
        try {
            const storedData = localStorage.getItem('dashboardData');
            const storedUserInfo = localStorage.getItem('userInfo');

            if (storedData && storedUserInfo) {
                App.loadDashboard(JSON.parse(storedData), JSON.parse(storedUserInfo));
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
        document.getElementById('clearDataBtn').addEventListener('click', () => App.clearAllData(true));
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
    },

    handleMouseMove: function (e) {
        const { clientX, clientY } = e;
        const x = Math.round((clientX / window.innerWidth) * 100);
        const y = Math.round((clientY / window.innerHeight) * 100);
        document.body.style.setProperty('--mouse-x', `${x}%`);
        document.body.style.setProperty('--mouse-y', `${y}%`);
    },

    loadDashboard: function (data, userInfo) {
        App.data.stats = data;
        App.displayUserInfo(userInfo);
        App.displayData(data);
        App.loadProfilePicture();
        App.initializeChartsDragAndDrop();
        App.initializeMetricsDragAndDrop();
        App.restoreMetricsOrder();
        App.adjustAIPanelHeight(); // <-- CHAMADA ADICIONADA
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
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = App.parseCSV(e.target.result);
                const stats = App.processData(data);
                localStorage.setItem('dashboardData', JSON.stringify(stats));
                App.closeModal('setupModal');
                App.loadDashboard(stats, userInfo);
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
        const countBy = (key) => {
            const counts = {};
            data.forEach(item => {
                let value = item[key] || 'Sem Categoria';
                if (key === 'Tags' && value !== 'Sem Categoria') {
                    const tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
                    tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
                } else {
                    let finalValue = value.trim() === '' ? 'Sem Categoria' : value;
                    counts[finalValue] = (counts[finalValue] || 0) + 1;
                }
            });
            return counts;
        };
        const findMax = (obj) => {
            if (Object.keys(obj).length === 0) return [null, 0];
            return Object.entries(obj).reduce((a, b) => a[1] > b[1] ? a : b);
        };

        const byStatus = countBy('State');
        const byTags = countBy('Tags');
        const byWorkItem = countBy('Work Item Type');

        const [principalWorkItemName, principalWorkItemCount] = findMax(byWorkItem);
        const [principalTagName] = findMax(byTags);

        return {
            totalCards: data.length,
            avgPerDay: (data.length / App.CONFIG.WORKING_DAYS).toFixed(1),
            byStatus, byTags, byWorkItem,
            principalWorkItem: {
                name: principalWorkItemName || 'N/A',
                percentage: data.length > 0 ? ((principalWorkItemCount / data.length) * 100).toFixed(1) : 0
            },
            escalonadoCount: byStatus['Escalonado Engenharia'] || 0,
            principalTag: principalTagName || 'N/A'
        };
    },

    displayData: function (stats) {
        document.getElementById('totalCards').textContent = stats.totalCards;
        document.getElementById('avgPerDay').textContent = stats.avgPerDay;
        document.getElementById('principalTagValue').textContent = stats.principalTag;
        document.getElementById('principalWorkItemValue').textContent = `${stats.principalWorkItem.percentage}%`;
        document.getElementById('principalWorkItemLabel').textContent = `Principal Item (${stats.principalWorkItem.name})`;
        document.getElementById('escalonadoValue').textContent = stats.escalonadoCount;

        App.renderCharts(stats);
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

    renderCharts: function (stats) {
        Object.values(App.charts).forEach(chart => chart?.destroy());
        const isDark = document.body.classList.contains('dark-theme');
        const gridColor = isDark ? 'rgba(248, 248, 242, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#f8f8f2' : '#333';
        const chartColors = isDark ? App.CONFIG.CHART_COLORS.dark : App.CONFIG.CHART_COLORS.light;
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
        App.charts.status = new Chart(ctxStatus, { type: 'doughnut', data: { labels: Object.keys(stats.byStatus), datasets: [{ data: Object.values(stats.byStatus), backgroundColor: chartColors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } } } });
        const ctxTags = document.getElementById('tagsChart').getContext('2d');
        App.charts.tags = new Chart(ctxTags, { type: 'bar', data: { labels: Object.keys(stats.byTags), datasets: [{ data: Object.values(stats.byTags), backgroundColor: isDark ? '#50fa7b' : '#28a745' }] }, options: { ...chartOptions, indexAxis: 'y' } });
        const ctxWorkItem = document.getElementById('workItemChart').getContext('2d');
        App.charts.workItem = new Chart(ctxWorkItem, { type: 'bar', data: { labels: Object.keys(stats.byWorkItem), datasets: [{ data: Object.values(stats.byWorkItem), backgroundColor: chartColors }] }, options: chartOptions });
    },

    initializeChartsDragAndDrop: function () {
        const container = document.getElementById('charts-container');
        if (container) new Sortable(container, { animation: 150, onEnd: App.saveChartOrder });
    },
    saveChartOrder: function (evt) {
        const order = Array.from(evt.from.children).map(child => child.id);
        localStorage.setItem('chartOrder', JSON.stringify(order));
    },
    initializeMetricsDragAndDrop: function () {
        const container = document.getElementById('metrics-grid');
        if (container) new Sortable(container, { animation: 150, onEnd: App.saveMetricsOrder });
    },
    saveMetricsOrder: function (evt) {
        const order = Array.from(evt.from.children).map(child => child.id);
        localStorage.setItem('metricsOrder', JSON.stringify(order));
    },
    restoreMetricsOrder: function () {
        const savedOrder = JSON.parse(localStorage.getItem('metricsOrder'));
        const container = document.getElementById('metrics-grid');
        if (savedOrder && container) {
            savedOrder.forEach(metricId => {
                const metricElement = document.getElementById(metricId);
                if (metricElement) container.appendChild(metricElement);
            });
        }
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

    // ===== NOVA FUNÇÃO PARA AJUSTAR A ALTURA DO PAINEL DA IA =====
    adjustAIPanelHeight: function() {
        // Seleciona os elementos da coluna da esquerda
        const header = document.querySelector('.header');
        const fileControls = document.querySelector('.file-controls');
        const metricsGrid = document.getElementById('metrics-grid');
        const portalsGrid = document.querySelector('.portals-grid');
        const container = document.querySelector('.container');

        if (!header || !fileControls || !metricsGrid || !portalsGrid || !container) {
            console.error("Não foi possível encontrar um dos elementos para calcular a altura.");
            return;
        }

        // Pega o espaçamento (gap) definido no grid do container
        const containerStyle = window.getComputedStyle(container);
        const gridGap = parseFloat(containerStyle.gap) || 20;

        // Soma a altura de cada elemento e os espaçamentos entre eles
        const totalHeight = header.offsetHeight +
                            fileControls.offsetHeight +
                            metricsGrid.offsetHeight +
                            portalsGrid.offsetHeight +
                            (gridGap * 3); // 3 gaps entre os 4 elementos

        // Aplica a altura calculada diretamente ao painel da IA
        const aiPanel = document.getElementById('gemini-ai-panel');
        if (aiPanel) {
            aiPanel.style.height = `${totalHeight}px`;
        }
    },
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
            App.renderCharts(App.data.stats);
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
            if (!button || !button.dataset.command) return;
            e.preventDefault();
            const command = button.dataset.command;
            if (command === 'insertImage') {
                const url = prompt('URL da Imagem:');
                if (url) document.execCommand(command, false, url);
            } else { document.execCommand(command, false, null); }
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

const GeminiAI = {
    API_KEY: "AIzaSyC0i1CDQ44O4P94L_a9fZxD9IsY4WWZhbY",
    model: null,

    init: function () {
        try {
            if (!window.GoogleGenerativeAI) {
                console.error("SDK do Google AI não foi carregado.");
                return;
            }
            const genAI = new window.GoogleGenerativeAI(this.API_KEY);
            this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

            document.getElementById('ai-prompt-form').addEventListener('submit', this.handlePromptSubmit);
        } catch (error) {
            console.error("Erro ao inicializar o Gemini AI:", error);
            this.addMessageToChat("Erro ao inicializar a IA. Verifique a API Key e o console.", "ai");
        }
    },

    handlePromptSubmit: async function (event) {
        event.preventDefault();
        const promptInput = document.getElementById('ai-prompt-input');
        const userPrompt = promptInput.value.trim();

        if (!userPrompt) return;

        GeminiAI.addMessageToChat(userPrompt, "user");
        promptInput.value = '';

        const storedData = localStorage.getItem('dashboardData');
        if (!storedData) {
            GeminiAI.addMessageToChat("Não há dados carregados no dashboard. Por favor, configure o dashboard no modal inicial primeiro.", "ai");
            return;
        }

        const thinkingMessage = GeminiAI.addMessageToChat("Analisando...", "ai");
        const context = JSON.stringify(JSON.parse(storedData));

        const fullPrompt = `Você é um assistente de IA amigável e proativo, integrado a um dashboard de performance profissional. Sua principal função é analisar os dados do dashboard fornecidos em formato JSON.

Siga estas regras:
1. Se a pergunta do usuário for uma saudação ou conversa casual que não se relacione com os dados (ex: 'oi', 'tudo bem?', 'obrigado'), responda de forma educada e cordial, e pergunte como você pode ajudar com a análise dos dados.
2. Se a pergunta for sobre os dados, use o JSON abaixo para fornecer uma resposta clara e direta.
3. Se a pergunta for muito vaga ou não estiver claro como ela se relaciona com os dados (ex: 'teste'), peça educadamente por mais detalhes ou sugira exemplos de perguntas que você pode responder.

Dados para análise:
${context}

Pergunta do usuário:
"${userPrompt}"
`;

        try {
            const result = await GeminiAI.model.generateContent(fullPrompt);
            const response = await result.response;
            const text = response.text();

            thinkingMessage.textContent = text;

        } catch (error) {
            console.error("Erro na API do Gemini:", error);
            thinkingMessage.textContent = "Desculpe, ocorreu um erro ao tentar obter a resposta. Verifique o console para mais detalhes.";
        }
    },

    addMessageToChat: function (text, sender) {
        const chatHistory = document.getElementById('ai-chat-history');
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'user-message' : 'ai-message';
        messageDiv.textContent = text;
        chatHistory.appendChild(messageDiv);

        chatHistory.scrollTop = chatHistory.scrollHeight;

        return messageDiv;
    }
};

// --- Ponto de Entrada Principal ---
document.addEventListener('DOMContentLoaded', App.init);