# 💰 Minhas Economias - Painel Financeiro Premium

Um Progressive Web App (PWA) de gestão financeira pessoal completo, desenvolvido com foco em performance, experiência do usuário (UX) premium (Tema Dark Gold) e arquitetura modular. O aplicativo permite rastrear receitas e despesas, gerenciar orçamentos com barras de progresso, visualizar projeções futuras e analisar o comportamento financeiro através de relatórios avançados.

## ✨ Funcionalidades Principais

### 📊 Dashboard Dinâmico
* **Visão de Saldos:** Acompanhamento do Saldo Atual e Projeção do Saldo no Final do Mês.
* **Orçamentos Fixados:** Cards de progresso no painel principal para categorias prioritárias.
* **Navegação Temporal:** Deslocamento entre meses passados e projeções de meses futuros.

### 💸 Gestão de Lançamentos
* **Tipos de Lançamento:** Receitas e Despesas.
* **Inteligência de Recorrência:** Suporte para lançamentos únicos, compras parceladas e contas recorrentes (fixas).
* **Gestão de Exceções:** Capacidade de editar, reajustar ou cancelar uma ocorrência específica de uma conta recorrente sem quebrar o histórico passado.
* **Meios de Pagamento:** Rastreamento por método (Débito, Cartão Passaí, Cartão CEF) com interface de "chips" cíclicos.

### 🗂️ Gestão Avançada de Categorias
* **Hierarquia de Grupos:** Categorias são filhas de grandes Macro-Grupos (Moradia, Alimentação, Transporte, etc.).
* **Gerenciador Integrado:** Adição, edição e exclusão de categorias com proteção contra deleção de categorias do sistema (ex: "Sem Categoria").
* **Gráficos Agrupados:** O gráfico de barras no Dashboard agrupa despesas automaticamente sob os Macro-Grupos, permitindo expansão (drill-down) para ver as subcategorias.

### 🎯 Orçamentos Mensais
* **Definição de Metas:** Estabeleça limites de gastos por categoria (recorrentes ou apenas para um mês específico).
* **Feedback Visual:** Barras de progresso que mudam de cor (Verde, Amarelo, Vermelho) conforme o consumo do orçamento.
* **Totalizador:** Acompanhamento do uso global do orçamento do mês.

### 🧾 Extrato Inteligente
* **Agrupamento Diário:** Lançamentos organizados por dia com cálculo de saldo diário.
* **Conferência (Check):** Sistema para marcar lançamentos como "conferidos" (simulando conciliação bancária).
* **Filtros:** Alternância rápida entre visualização de todos, apenas conferidos ou apenas pendentes.
* **Projeção:** Exibição de contas recorrentes projetadas que ainda não venceram no mês atual.

### 📈 Centro de Análise Financeira (Relatórios)
1. **Desvio Orçamentário:** Compara o previsto vs. real, ordenando do maior estouro ao maior saldo.
2. **Radar de Comprometimento:** Gráfico de barras que projeta o peso de despesas fixas e parcelas para os próximos 6 meses.
3. **Engessamento da Renda:** Gráfico em anel (Doughnut) indicando qual a porcentagem da renda já comprometida com o básico.
4. **Gastos por Pagamento:** Totalização de despesas segmentadas pelo método de pagamento escolhido (Débito, Cartões).

### ☁️ Sincronização em Nuvem (Firebase)
* **Autenticação:** Login seguro via E-mail/Senha.
* **Sincronização Real-time:** Backup e sync de Lançamentos, Categorias, Orçamentos e Preferências de UI na nuvem (Firestore).
* **Persistência Offline:** O app continua funcionando e salvando dados localmente mesmo sem internet, sincronizando automaticamente quando a conexão é restabelecida.

---

## 🛠️ Arquitetura e Tecnologias

O projeto foi construído utilizando **Vanilla JavaScript (ES6+)**, HTML5 e CSS3, sem dependência de frameworks pesados (como React ou Angular), garantindo um carregamento ultrarrápido.

* **Padrão de Projeto:** Modular Pattern (IIFE) para encapsulamento lógico.
* **Armazenamento:** `localStorage` (Cache Local) + `Firebase Firestore` (Nuvem).
* **Estilização:** CSS puro com variáveis globais (CSS Custom Properties) para facilidade de manutenção do Tema Premium (Ouro & Creme).
* **Ícones:** SVG inline para máxima performance e controle de cor.

### Estrutura de Arquivos

* `index.html`: Estrutura principal e chamadas de modais (Dialogs).
* `style.css`: Estilos globais, temas, responsividade e animações.
* `js/script.js`: Core da aplicação, gestão de estado global, UI do formulário e Dashboard.
* `js/category-groups.js`: Motor estático dos Macro-Grupos (Pais).
* `js/category-manager.js`: CRUD das Categorias e sincronização de vínculos.
* `js/budget.js`: Lógica do módulo de Orçamentos e barras de progresso.
* `js/extract.js`: Lógica de renderização do extrato e sistema de conciliação.
* `js/reports.js`: Lógica de cálculos e UI do Centro de Análise Financeira.
* `js/payment-config.js`: Central de configurações visuais e lógicas dos Meios de Pagamento.
* `js/firebase-service.js`: Wrapper de conexão com o Firebase Auth e Firestore.
* `js/changelog.js`: Controle de versões e histórico de atualizações (Modal de Versão).

---

## 🚀 Como Executar o Projeto Localmente

1. **Clonar o repositório** (ou baixar os arquivos).
2. **Servidor Local:** Como o projeto utiliza módulos e chamadas de API do Firebase, ele deve ser executado através de um servidor local para evitar bloqueios de CORS (protocolo `file://`).
   * *Sugestão:* Use a extensão **Live Server** no VS Code.
   * *Alternativa:* Via terminal com Python: `python -m http.server 8000`
3. Acessar no navegador: `http://localhost:8000`

### Configuração do Firebase
O projeto utiliza uma configuração do Firebase via CDN. Para conectar ao seu próprio banco de dados:
1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Ative o **Authentication** (E-mail/Senha) e o **Firestore Database**.
3. Substitua o objeto `firebaseConfig` no arquivo `js/firebase-service.js` com as chaves do seu projeto.
4. (Opcional) Configure as regras de segurança do Firestore para permitir leitura/escrita apenas para usuários autenticados comparando o `uid`.

---

## 🔮 Roadmap / Próximos Passos (Oportunidades Arquiteturais)

- [ ] **Edição de Grupos na UI:** Permitir ao usuário reclassificar o Macro-Grupo de uma categoria existente na tela de Gestão de Categorias.
- [ ] **Customização de Macro-Grupos:** Permitir a criação de Macro-grupos totalmente customizados pelo usuário (salvos no Firebase).
- [ ] **Importação/Exportação:** Adicionar capacidade de exportar dados para CSV/Excel.
- [ ] **Notificações Push (PWA):** Alertar o usuário sobre limites de orçamento atingidos e contas próximas ao vencimento utilizando o Service Worker.

---
*Desenvolvido com foco na simplicidade, elegância e precisão contábil.*
