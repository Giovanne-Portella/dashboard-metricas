# 📊 Dashboard de Métricas Profissional

> Dashboard 100% client-side para acompanhamento de métricas de trabalho, construído com HTML, CSS e JavaScript puro — sem dependências de servidor ou build tools.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Como Usar](#-como-usar)
- [Formato do CSV](#-formato-do-csv)
- [Configuração](#-configuração)
- [Tecnologias](#-tecnologias)
- [Decisões de Arquitetura](#-decisões-de-arquitetura)
- [Licença](#-licença)

---

## 🌟 Visão Geral

O **Dashboard de Métricas Profissional** é uma aplicação web estática que permite a qualquer profissional importar seus dados de trabalho (via CSV) e visualizar métricas consolidadas por mês, analista, cliente, tipo de item e tag.

Toda a persistência é feita via **`localStorage`** do navegador — nenhum dado é enviado para servidores externos.

---

## ✅ Funcionalidades

| Categoria | Funcionalidade |
|---|---|
| **Dados** | Importação de arquivo CSV (`;` ou `,` como delimitador) |
| **Dados** | Parser robusto com suporte a campos entre aspas |
| **Filtros** | Filtragem por analista (múltipla seleção) |
| **Filtros** | Filtro por cliente, tipo de item ou tag |
| **Métricas** | Média diária, tickets ativos, tempo médio de atuação |
| **Métricas** | Produtividade (tickets/hora), custo médio por ticket |
| **Métricas** | Top 5 clientes, top 5 tags, distribuição por status |
| **Métricas** | KPIs de variação mês a mês (↑↓) |
| **Temas** | Alternância claro/escuro (Dracula palette) |
| **Temas** | Efeito spotlight no tema escuro (segue o cursor) |
| **Perfil** | Foto de perfil com persistência |
| **Conteúdo** | Seções editáveis "Atuações" e "Projetos" com editor rich-text |
| **UX** | Grupos acordeão com estado persistido |
| **UX** | Expandir / Recolher todos os grupos |
| **UX** | Tecla Escape para fechar modais |
| **UX** | Responsivo para mobile, tablet e desktop |

---

## 📁 Estrutura do Projeto

```
dashboard-metricas/
│
├── index.html               # Estrutura HTML e referência aos assets
├── style.css                # Estilos globais, variáveis e temas
│
├── css/
│   └── responsive.css       # Media queries (mobile-first, ≤ 1024px, ≤ 768px, ≤ 480px)
│
├── js/
│   ├── config.js            # Constantes e configurações (colunas do CSV, custos)
│   ├── csv-parser.js        # Parser de CSV com auto-detecção de delimitador
│   ├── data-processor.js    # Agregação, cálculo de métricas e agrupamento por mês
│   ├── ui.js                # Renderização do DOM e interações de interface
│   ├── theme.js             # Alternância tema claro/escuro + efeito spotlight
│   ├── editable-section.js  # CRUD das seções editáveis (Atuações / Projetos)
│   └── app.js               # Controlador principal — inicialização e fluxo de dados
│
├── script.js                # ⚠️ Versão legada (não utilizada — apenas histórico)
└── README.md
```

> **Ordem de carregamento dos scripts** (respeitada no `index.html`):
> `config` → `csv-parser` → `data-processor` → `ui` → `theme` → `editable-section` → `app`

---

## 🚀 Como Usar

### 1. Abrir o dashboard

Basta abrir o arquivo `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge, Safari).

> Não é necessário servidor web — funciona diretamente via `file://`.

### 2. Configuração Inicial

Na primeira abertura, um modal solicitará:

- **Nome**: seu nome completo (exibido no cabeçalho)
- **Cargo**: seu cargo/função (exibido abaixo do nome)
- **Arquivo CSV**: o arquivo com seus dados de trabalho

Clique em **"Salvar e Iniciar"** para carregar o dashboard.

### 3. Filtros

- **Visão do Analista**: filtra os dados por um ou mais analistas (use `Ctrl/Cmd` para seleção múltipla)
- **Abas de tipo**: alterna entre visão Geral, Por Cliente, Por Item ou Por Tag
- **Select de valor**: ao selecionar uma aba específica, um select adicional permite filtrar por valor exato

### 4. Grupos Acordeão

Cada grupo (Status, Estratégico, Clientes, Tags) pode ser expandido/recolhido individualmente ou via os botões **"Expandir Tudo"** / **"Recolher Tudo"**. O estado é salvo automaticamente.

### 5. Atuações e Projetos

Clique nos cards do topo para abrir as seções editáveis. Cada seção suporta:
- Títulos e conteúdo rich-text (negrito, itálico, sublinhado, listas, imagens via URL)
- Criar, editar e excluir itens

### 6. Foto de Perfil

Clique no avatar no cabeçalho para selecionar uma imagem do seu dispositivo.

### 7. Resetar

O botão 🔄 (canto inferior esquerdo) apaga todos os dados do `localStorage` e reinicia o dashboard.

---

## 📄 Formato do CSV

O arquivo CSV deve conter **pelo menos** as colunas abaixo. O delimitador pode ser `;` *(padrão)* ou `,` *(detectado automaticamente)*.

| Coluna (padrão) | Tipo | Descrição |
|---|---|---|
| `Created Date` | String | Data de criação: `dd/mm/aaaa` ou `dd/mm/aaaa hh:mm` |
| `Cliente` | String | Nome do cliente (usa apenas a primeira palavra como identificador) |
| `Assigned To` | String | Nome do analista responsável |
| `Work Item Type` | String | Tipo do item de trabalho (Bug, Feature, Task...) |
| `Tags` | String | Tags separadas por vírgula (ex: `Frontend,Urgente`) |
| `State` | String | Estado atual (`Fechado`, `Resolvido`, `Escalonado Engenharia`...) |
| `Horas Uteis` | Number | Horas trabalhadas no item (aceita `,` ou `.` como decimal) |

### Exemplo de CSV

```csv
Created Date;Cliente;Assigned To;Work Item Type;Tags;State;Horas Uteis
01/01/2025 09:00;EMPRESA ABC;João Silva;Bug;Frontend,Urgente;Fechado;2,5
15/01/2025 14:30;EMPRESA XYZ;Maria Costa;Feature;Backend;Em Andamento;1,0
20/01/2025 08:00;EMPRESA ABC;João Silva;Task;Documentação;Resolvido;0,5
05/02/2025 10:00;EMPRESA DEF;João Silva;Bug;Frontend;Escalonado Engenharia;3,0
```

> **Dica:** O nome das colunas pode ser personalizado em `js/config.js`.

---

## ⚙️ Configuração

Edite o arquivo `js/config.js` para adaptar o dashboard ao seu contexto:

```javascript
const CONFIG = Object.freeze({
    // Dias úteis no mês — usado para calcular média diária
    WORKING_DAYS: 22,

    // Custo da sua hora em Reais — usado para calcular custo médio por ticket
    COST_PER_HOUR: 18,

    // Nomes exatos das colunas no seu CSV
    MONTH_COLUMN_NAME:       'Created Date',
    CLIENT_COLUMN_NAME:      'Cliente',
    ANALYST_COLUMN_NAME:     'Assigned To',
    WORK_ITEM_COLUMN_NAME:   'Work Item Type',
    TAGS_COLUMN_NAME:        'Tags',
    HORAS_UTEIS_COLUMN_NAME: 'Horas Uteis',
});
```

---

## 🛠 Tecnologias

| Tecnologia | Uso |
|---|---|
| **HTML5** semântico | Estrutura e acessibilidade (aria-labels, roles) |
| **CSS3** | Custom Properties, CSS Grid, Flexbox, animações |
| **JavaScript ES6+** | Objetos literais modulares, arrow functions, destructuring |
| **`localStorage` API** | Persistência de dados, preferências e estado |
| **`FileReader` API** | Leitura de arquivos CSV locais sem upload |
| **`document.execCommand`** | Editor rich-text inline (deprecated, mas ainda suportado) |
| **[SortableJS](https://sortablejs.github.io/Sortable/)** | Dependência externa — disponível para drag-and-drop futuro |

---

## 🏗 Decisões de Arquitetura

### Por que sem framework?

O dashboard é intencionalmente **zero-dependency** (exceto SortableJS, já incluso via CDN). Isso garante:
- Funcionamento estável sem `npm install` ou build tools
- Abertura direta via `file://` sem servidor
- Total controle e legibilidade do código

### Módulos via script tags

Como não há bundler, os módulos são carregados como scripts globais em ordem de dependência. Cada arquivo expõe um único objeto global (`CONFIG`, `CSVParser`, `DataProcessor`, `UI`, `ThemeSwitcher`, `EditableSection`, `App`).

### Segurança

- URLs de imagem são validadas para aceitar apenas `http://` e `https://` — bloqueando `javascript:` e `data:` URIs
- A foto de perfil é inserida via `createElement('img')`, nunca `innerHTML`
- Dados persistidos são lidos apenas do `localStorage` local do usuário

---

## 📝 Licença

Este projeto está licenciado sob a [MIT License](https://opensource.org/licenses/MIT).

---

<p align="center">Feito com ❤️ para profissionais que gostam de dados</p>
