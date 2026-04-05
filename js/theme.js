'use strict';

/**
 * ThemeSwitcher — gerencia a alternância entre tema claro e escuro.
 *
 * Correção em relação à versão original:
 *  - O listener de `mousemove` para o efeito spotlight do tema escuro agora é
 *    corretamente anexado e removido conforme o tema muda.
 */
const ThemeSwitcher = {
    init() {
        this._btn = document.getElementById('theme-toggle');
        this._btn.addEventListener('click', () => this.toggleTheme());

        const saved    = localStorage.getItem('theme');
        const osPref   = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        this.applyTheme(saved || osPref);
    },

    applyTheme(theme) {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark-theme', isDark);
        this._btn.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', theme);

        // Spotlight: ativo apenas no tema escuro para economizar CPU
        if (isDark) {
            document.addEventListener('mousemove', App.handleMouseMove);
        } else {
            document.removeEventListener('mousemove', App.handleMouseMove);
            // Reseta a posição do gradiente para o centro
            document.body.style.removeProperty('--mouse-x');
            document.body.style.removeProperty('--mouse-y');
        }
    },

    toggleTheme() {
        const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
        this.applyTheme(current === 'dark' ? 'light' : 'dark');
    },
};
