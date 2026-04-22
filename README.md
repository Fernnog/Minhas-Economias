# Motor Financeiro (Minhas Economias)

Um aplicativo web de gestão financeira pessoal com arquitetura *mobile-first*, focado em alta performance, usabilidade minimalista e sincronização em tempo real. Construído com JavaScript modular puro (Vanilla JS), o sistema oferece projeção inteligente de gastos recorrentes, controle de orçamentos e uma interface otimizada para navegação via dispositivos móveis.

## 🚀 Principais Funcionalidades

* **Dashboard Mobile-First:** Interface focada em ergonomia, com menu de navegação inferior (bottom bar) e carrossel magnético (*scroll-snap*) horizontal para acesso rápido aos orçamentos mais importantes (Pinned Budgets).
* **Gestão Inteligente de Recorrências:** Lógica avançada para tratar despesas recorrentes, incluindo a capacidade de projetar compras parceladas, aplicar reajustes futuros ou registrar exceções isoladas em meses específicos.
* **Módulo de Orçamentos Visuais:** Definição de metas financeiras (mensais ou pontuais) com barras de progresso que mudam de cor dinamicamente (Verde, Âmbar, Vermelho) conforme o consumo do saldo.
* **Sincronização em Nuvem (Offline-Ready):** Integração com Firebase (Authentication e Firestore) que trabalha em conjunto com o `LocalStorage`. O app funciona perfeitamente offline e sincroniza os dados assim que a conexão é estabelecida.
* **Categorização Dinâmica:** Suporte a gráficos visuais e injeção automática de categorias de fallback (ex: "Sem Categoria").

## 🛠 Tecnologias e Arquitetura

O projeto adota uma abordagem limpa e sem frameworks pesados, garantindo carregamento rápido e facilidade de manutenção:

* **Frontend:** HTML5 Semântico, CSS3 (CSS Variables, Flexbox, CSS Grid) e JavaScript Moderno (ES6+).
* **Backend / BaaS:** Firebase v10 (Compat API) para Autenticação e Banco de Dados NoSQL (Firestore).
* **Padrão de Projeto:** Módulos Auto-Executáveis (IIFE - *Immediately Invoked Function Expression*) para isolamento de escopo e responsabilidades.

## 📂 Estrutura de Arquivos (Modularização)

A lógica de negócios foi separada em domínios específicos para facilitar a escalabilidade:

| Arquivo | Responsabilidade Principal |
| :--- | :--- |
| `index.html` | Estrutura semântica, divisão de *views* (SPA) e templates dos formulários. |
| `style.css` | Sistema de design minimalista, responsividade e variáveis globais de cor. |
| `script.js` | Motor central. Gerencia o roteamento de telas, cálculos gerais de saldo, renderização de gráficos, escopo de transações e persistência de preferências de interface (ex: Orçamentos Fixados). |
| `budget.js` | `BudgetModule`: Lida exclusivamente com o CRUD e a validação de dados de orçamentos e renderização das barras de progresso. |
| `extract.js` | `ExtractModule`: Processa a exibição temporal das transações, projetando lançamentos futuros na tabela do extrato mensal. |
| `firebase-service.js` | `FirebaseModule`: Centraliza a autenticação de usuários, escuta de estados (Auth) e o sincronismo bidirecional (Upload/Download) das coleções de dados. |
| `changelog.js` | Módulo isolado para injeção dinâmica do histórico de versões e notas de atualização no modal da aplicação. |

## 🔄 Evoluções Recentes (v1.0.4)

A aplicação passou por uma recente reestruturação arquitetural de UI/UX com foco no usuário final:
1. **Pinned Budgets (Orçamentos Fixados):** Implementação de preferências de usuário, permitindo fixar cartões de orçamento específicos na tela inicial. As preferências são salvas localmente e sincronizadas no Firebase (`preferences/pinned`).
2. **Desacoplamento Visual:** Movimentação de gráficos complexos (Despesas por Categoria) para uma *view* dedicada, limpando a carga cognitiva da página inicial.
3. **Ergonomia Mobile:** Transição das ações principais para uma barra inferior unificada, facilitando o uso com apenas uma mão.

## ⚙️ Como Executar o Projeto

1. Clone o repositório.
2. Não há necessidade de processos de build (Node.js/NPM). Sendo *Vanilla*, basta abrir o arquivo `index.html` em qualquer navegador moderno.
3. Para testar o Firebase localmente e evitar bloqueios de CORS, recomenda-se o uso de extensões como *Live Server* (VS Code) ou hospedar os arquivos estáticos.

---
*Projetado com foco em arquitetura PWA e código limpo.*
