'use strict';

/**
 * EditableSection — gerencia seções de conteúdo editável (Atuações / Projetos).
 *
 * Melhorias em relação à versão original:
 *  - Métodos privados com prefixo `_`
 *  - Validação de URL ao inserir imagem (bloqueia protocolo javascript:)
 *  - Mensagem de lista vazia
 *  - Foco automático no campo de título ao abrir editor
 *  - aria-label nos botões de ação para acessibilidade
 */
const EditableSection = {
    /**
     * Inicializa uma seção editável.
     * @param {string} sectionId   - ID base dos elementos da seção no DOM (ex: 'atuacoes').
     * @param {string} storageKey  - Chave do localStorage para persistência.
     */
    init(sectionId, storageKey) {
        const section = {
            id:         sectionId,
            storageKey: storageKey,
            data:       JSON.parse(localStorage.getItem(storageKey)) || [],
            elements: {
                newBtn: document.getElementById(`${sectionId}-new-btn`),
                list:   document.getElementById(`${sectionId}-list`),
                editor: {
                    wrapper:   document.getElementById(`${sectionId}-editor`),
                    id:        document.querySelector(`#${sectionId}-editor .editor-id`),
                    title:     document.querySelector(`#${sectionId}-editor .editor-title`),
                    content:   document.querySelector(`#${sectionId}-editor .editor-content`),
                    saveBtn:   document.querySelector(`#${sectionId}-editor .editor-save`),
                    cancelBtn: document.querySelector(`#${sectionId}-editor .editor-cancel`),
                    toolbar:   document.querySelector(`#${sectionId}-editor .editor-toolbar`),
                },
            },
        };

        this._attachListeners(section);
        this._renderList(section);
    },

    _attachListeners(section) {
        const { newBtn, list, editor } = section.elements;

        newBtn.addEventListener('click', () => this._showEditor(section, null));
        editor.saveBtn.addEventListener('click',   () => this._saveItem(section));
        editor.cancelBtn.addEventListener('click', () => this._hideEditor(section));

        // Delegação de eventos para editar / excluir
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-id]');
            if (!btn) return;
            const item = section.data.find(i => i.id == btn.dataset.id);
            if (btn.classList.contains('edit-btn'))   this._showEditor(section, item);
            if (btn.classList.contains('delete-btn')) this._deleteItem(section, btn.dataset.id);
        });

        // Barra de ferramentas do editor rich-text
        editor.toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-command]');
            if (!btn) return;
            e.preventDefault();

            const command = btn.dataset.command;
            if (command === 'insertImage') {
                this._insertImageSafe();
            } else {
                document.execCommand(command, false, null);
            }
        });
    },

    /**
     * Insere uma imagem via URL validada (bloqueia javascript: e data:).
     */
    _insertImageSafe() {
        const input = prompt('Cole a URL da imagem (https://...):');
        if (!input) return;

        let url;
        try {
            url = new URL(input);
        } catch {
            alert('URL inválida. Verifique o endereço.');
            return;
        }

        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            alert('URL inválida. Use apenas endereços com https:// ou http://');
            return;
        }

        document.execCommand('insertImage', false, url.href);
    },

    _renderList(section) {
        section.elements.list.innerHTML = '';

        if (section.data.length === 0) {
            section.elements.list.innerHTML =
                '<p class="empty-list-msg">Nenhum item cadastrado ainda.</p>';
            return;
        }

        section.data.forEach(item => {
            const el = document.createElement('div');
            el.className = 'item';
            el.innerHTML = `
                <span class="item-title">${item.title}</span>
                <div class="item-actions">
                    <button data-id="${item.id}" class="edit-btn"   aria-label="Editar">✏️</button>
                    <button data-id="${item.id}" class="delete-btn" aria-label="Excluir">🗑️</button>
                </div>`;
            section.elements.list.appendChild(el);
        });
    },

    _showEditor(section, item) {
        section.elements.editor.id.value      = item ? item.id      : '';
        section.elements.editor.title.value   = item ? item.title   : '';
        section.elements.editor.content.innerHTML = item ? item.content : '';

        section.elements.editor.wrapper.style.display = 'block';
        section.elements.newBtn.style.display          = 'none';
        section.elements.list.style.display            = 'none';
        section.elements.editor.title.focus();
    },

    _hideEditor(section) {
        section.elements.editor.wrapper.style.display = 'none';
        section.elements.newBtn.style.display          = 'block';
        section.elements.list.style.display            = 'block';
    },

    _saveItem(section) {
        const id      = section.elements.editor.id.value;
        const title   = section.elements.editor.title.value.trim();
        const content = section.elements.editor.content.innerHTML;

        if (!title) {
            alert('O título é obrigatório.');
            section.elements.editor.title.focus();
            return;
        }

        if (id) {
            const idx = section.data.findIndex(i => i.id == id);
            if (idx > -1) section.data[idx] = { id: Number(id), title, content };
        } else {
            section.data.push({ id: Date.now(), title, content });
        }

        localStorage.setItem(section.storageKey, JSON.stringify(section.data));
        this._hideEditor(section);
        this._renderList(section);
    },

    _deleteItem(section, id) {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        section.data = section.data.filter(i => i.id != id);
        localStorage.setItem(section.storageKey, JSON.stringify(section.data));
        this._renderList(section);
    },
};
