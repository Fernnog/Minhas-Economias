// === STATE MANAGEMENT ===
let transactions = JSON.parse(localStorage.getItem('fin_transactions')) || [];
let categories = JSON.parse(localStorage.getItem('fin_categories')) || ['Alimentação', 'Moradia', 'Transporte', 'Salário', 'Lazer'];

// === DOM ELEMENTS ===
const form = document.getElementById('transaction-form');
const list = document.getElementById('transaction-list');
const categorySelect = document.getElementById('trans-category');
const categoryForm = document.getElementById('category-form');

// Views
const dashboardView = document.getElementById('dashboard-view');
const managementView = document.getElementById('management-view');

// === INITIALIZATION ===
function init() {
    // Inicializa o sistema de histórico (definido no changelog.js)
    if (typeof initChangelog === 'function') {
        initChangelog();
    }
    
    document.getElementById('header-date').innerText = new Date().toLocaleDateString('pt-BR');
    document.getElementById('trans-date').valueAsDate = new Date();
    
    updateCategorySelect();
    
    // Inicialização dos novos módulos isolados
    if (typeof ExtractModule !== 'undefined') ExtractModule.init();
    if (typeof BudgetModule !== 'undefined') BudgetModule.init();
    
    updateAllViews();
    
    console.log('%cMotor Financeiro Iniciado', 'color: #2e7d32; font-weight: bold; font-size: 14px;');
}

// === ROUTING (SPA) ===
window.showDashboard = function() {
    managementView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    updateAllViews();
};

// Nova lógica de exibição de Views Independentes (Refatorada)
window.showView = function(targetView) {
    dashboardView.classList.add('hidden');
    managementView.classList.remove('hidden');
    
    // Lista de todas as sub-views gerenciadas dentro de managementView
    const subViews = ['view-form', 'view-extract', 'view-budget'];
    
    // Esconde todas as sub-views para garantir um estado limpo
    subViews.forEach(viewId => {
        const viewEl = document.getElementById(viewId);
        if (viewEl) viewEl.classList.add('hidden');
    });
    
    // Mostra a view alvo
    const targetId = `view-${targetView}`;
    const targetEl = document.getElementById(targetId);
    
    if (targetEl) {
        targetEl.classList.remove('hidden');
    }
    
    const gridLayout = document.querySelector('#management-view .grid-layout');
    // Ajusta o layout para ocupar 100% da largura da tela ativa
    if (gridLayout) gridLayout.style.gridTemplateColumns = '1fr';
    
    // Integração com módulos externos: Dispara renderização de orçamentos se necessário
    if (targetView === 'budget' && typeof BudgetModule !== 'undefined') {
        BudgetModule.render();
    }
};

// === LOGIC & CALCULATIONS ===
function saveData() {
    localStorage.setItem('fin_transactions', JSON.stringify(transactions));
    localStorage.setItem('fin_categories', JSON.stringify(categories));
}

// Nova orquestração central de renderização
function updateAllViews() {
    updateDashboardData();
    if (typeof ExtractModule !== 'undefined') ExtractModule.render();
}

function updateDashboardData() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    let saldoAtualTotal = 0;
    let saldoFimMesTotal = 0;
    const gastosPorCategoria = {};

    transactions.forEach(trans => {
        const dataTrans = new Date(trans.date + 'T00:00:00'); 
        const isMesmoMes = dataTrans.getMonth() === mesAtual && dataTrans.getFullYear() === anoAtual;
        
        if (trans.type === 'receita') {
            saldoFimMesTotal += trans.amount;
            if (dataTrans <= hoje) saldoAtualTotal += trans.amount;
        } else {
            saldoFimMesTotal -= trans.amount;
            if (dataTrans <= hoje) saldoAtualTotal -= trans.amount;
            
            if (isMesmoMes) {
                gastosPorCategoria[trans.category] = (gastosPorCategoria[trans.category] || 0) + trans.amount;
            }
        }
    });

    document.getElementById('saldo-atual-display').innerText = saldoAtualTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('saldo-fim-mes-display').innerText = saldoFimMesTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const cardAtual = document.getElementById('card-saldo-atual');
    const cardMes = document.getElementById('card-saldo-mes');
    saldoAtualTotal < 0 ? cardAtual.classList.add('negative') : cardAtual.classList.remove('negative');
    saldoFimMesTotal < 0 ? cardMes.classList.add('negative') : cardMes.classList.remove('negative');

    renderCategoryChart(gastosPorCategoria);
}

// === UI RENDERING ===
function renderCategoryChart(gastos) {
    const chartContainer = document.getElementById('category-chart');
    chartContainer.innerHTML = '';
    
    const categorias = Object.keys(gastos);
    if (categorias.length === 0) {
        chartContainer.innerHTML = '<p style="text-align:center; color:#888; font-size: 0.9rem;">Nenhuma despesa registrada para este mês.</p>';
        return;
    }

    const maxGasto = Math.max(...Object.values(gastos));

    categorias.sort((a, b) => gastos[b] - gastos[a]).forEach(cat => {
        const valor = gastos[cat];
        const percentual = (valor / maxGasto) * 100;
        
        const row = document.createElement('div');
        row.className = 'bar-row';
        row.innerHTML = `
            <div class="bar-label" title="${cat}">${cat}</div>
            <div class="bar-track">
                <div class="bar-fill" style="width: 0%;" data-target-width="${percentual}%"></div>
            </div>
            <div class="bar-value">${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        `;
        chartContainer.appendChild(row);
    });

    setTimeout(() => {
        document.querySelectorAll('.bar-fill').forEach(bar => {
            bar.style.width = bar.getAttribute('data-target-width');
        });
    }, 50);
}

function updateCategorySelect() {
    categorySelect.innerHTML = '';
    categories.sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.innerText = cat;
        categorySelect.appendChild(option);
    });
}

// === EVENT HANDLERS ===
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('trans-id').value;
    const type = document.getElementById('trans-type').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const category = document.getElementById('trans-category').value;
    const date = document.getElementById('trans-date').value;
    const desc = document.getElementById('trans-desc').value;
    const isRecurring = document.getElementById('trans-recurrence').checked;

    const transactionData = {
        id: id ? id : Date.now().toString(),
        type, amount, category, date, desc, isRecurring
    };

    if (id) {
        const index = transactions.findIndex(t => t.id === id);
        transactions[index] = transactionData;
        document.getElementById('btn-save').innerText = 'Salvar Lançamento';
    } else {
        transactions.push(transactionData);
        
        if(isRecurring) {
            const nextDate = new Date(date + 'T00:00:00');
            nextDate.setMonth(nextDate.getMonth() + 1);
            transactions.push({
                ...transactionData,
                id: (Date.now() + 1).toString(),
                date: nextDate.toISOString().split('T')[0],
                desc: desc + ' (Recorrente)'
            });
        }
    }

    saveData();
    updateAllViews();
    
    form.reset();
    document.getElementById('trans-id').value = '';
    document.getElementById('trans-date').valueAsDate = new Date();
    
    showDashboard();
});

categoryForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const newCat = document.getElementById('new-category').value.trim();
    const formattedCat = newCat.charAt(0).toUpperCase() + newCat.slice(1);
    
    if (formattedCat && !categories.includes(formattedCat)) {
        categories.push(formattedCat);
        saveData();
        updateCategorySelect();
        document.getElementById('new-category').value = '';
        categorySelect.value = formattedCat;
    }
});

// === CRUD ACTIONS ===
window.deleteTransaction = function(id) {
    if (confirm('Deseja realmente excluir este lançamento?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        updateAllViews();
    }
};

window.editTransaction = function(id) {
    const trans = transactions.find(t => t.id === id);
    if (trans) {
        document.getElementById('trans-id').value = trans.id;
        document.getElementById('trans-type').value = trans.type;
        document.getElementById('trans-amount').value = trans.amount;
        document.getElementById('trans-category').value = trans.category;
        document.getElementById('trans-date').value = trans.date;
        document.getElementById('trans-desc').value = trans.desc;
        document.getElementById('trans-recurrence').checked = trans.isRecurring;
        
        document.getElementById('btn-save').innerText = 'Atualizar Lançamento';
        
        // Redireciona o usuário para a tela de formulário automaticamente
        showView('form');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// RUN
init();
