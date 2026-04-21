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
    if (typeof initChangelog === 'function') {
        initChangelog();
    }
    
    document.getElementById('header-date').innerText = new Date().toLocaleDateString('pt-BR');
    document.getElementById('trans-date').valueAsDate = new Date();
    
    updateCategorySelect();
    
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

window.showView = function(targetView) {
    dashboardView.classList.add('hidden');
    managementView.classList.remove('hidden');
    
    const subViews = ['view-form', 'view-extract', 'view-budget'];
    
    subViews.forEach(viewId => {
        const viewEl = document.getElementById(viewId);
        if (viewEl) viewEl.classList.add('hidden');
    });
    
    const targetId = `view-${targetView}`;
    const targetEl = document.getElementById(targetId);
    
    if (targetEl) {
        targetEl.classList.remove('hidden');
    }
    
    const gridLayout = document.querySelector('#management-view .grid-layout');
    if (gridLayout) gridLayout.style.gridTemplateColumns = '1fr';
    
    if (targetView === 'budget' && typeof BudgetModule !== 'undefined') {
        BudgetModule.render();
    }
};

// === LOGIC & CALCULATIONS ===
function saveData() {
    localStorage.setItem('fin_transactions', JSON.stringify(transactions));
    localStorage.setItem('fin_categories', JSON.stringify(categories));
}

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

    const todasTransacoes = [];

    // Passo 1: Mesma lógica do extract.js para projetar recorrentes e não haver divergência
    transactions.forEach(t => {
        const d = new Date(t.date + 'T00:00:00');
        const tMonth = d.getMonth();
        const tYear = d.getFullYear();

        todasTransacoes.push(t); // Adiciona a original

        // Projeta se for recorrente de um mês anterior
        if (t.isRecurring && (tYear < anoAtual || (tYear === anoAtual && tMonth < mesAtual))) {
            todasTransacoes.push({
                ...t,
                date: `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            });
        }
    });

    // Passo 2: Calcula baseado na lista unificada (reais + projetadas)
    todasTransacoes.forEach(trans => {
        const dataTrans = new Date(trans.date + 'T00:00:00'); 
        const isMesmoMes = dataTrans.getMonth() === mesAtual && dataTrans.getFullYear() === anoAtual;
        
        // Saldo Atual: Tudo até a data de hoje
        if (dataTrans <= hoje) {
            if (trans.type === 'receita') saldoAtualTotal += trans.amount;
            else saldoAtualTotal -= trans.amount;
        }

        // Saldo Fim do Mês: Tudo até hoje + Lançamentos futuros do mês atual
        if (dataTrans <= hoje || isMesmoMes) {
            if (trans.type === 'receita') saldoFimMesTotal += trans.amount;
            else saldoFimMesTotal -= trans.amount;
        }
        
        // Gráfico de Categorias: Apenas despesas do mês atual
        if (trans.type === 'despesa' && isMesmoMes) {
            gastosPorCategoria[trans.category] = (gastosPorCategoria[trans.category] || 0) + trans.amount;
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

    const newItemsToSync = []; // Fila cirúrgica de sincronização para a nuvem

    if (id) {
        const index = transactions.findIndex(t => t.id === id);
        transactions[index] = transactionData;
        newItemsToSync.push(transactionData);
        document.getElementById('btn-save').innerText = 'Salvar Lançamento';
    } else {
        transactions.push(transactionData);
        newItemsToSync.push(transactionData);
        
        if(isRecurring) {
            const nextDate = new Date(date + 'T00:00:00');
            nextDate.setMonth(nextDate.getMonth() + 1);
            const recTrans = {
                ...transactionData,
                id: (Date.now() + 1).toString(), // Garante um ID único
                date: nextDate.toISOString().split('T')[0],
                desc: desc + ' (Recorrente)'
            };
            transactions.push(recTrans);
            newItemsToSync.push(recTrans);
        }
    }

    saveData(); // Salva localmente (agora sem o loop do Firebase)
    
    // Sincronização Cirúrgica no Firebase (apenas os itens novos/editados)
    if (typeof FirebaseModule !== 'undefined') {
        newItemsToSync.forEach(t => FirebaseModule.syncData('transactions', t));
    }
    
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
        saveData(); // Salva local
        
        // Sincroniza a nova categoria com a nuvem
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('categories', { id: formattedCat, name: formattedCat });
        }
        
        // Atualiza seletores no Form Principal e no módulo de Orçamento
        updateCategorySelect();
        if (typeof BudgetModule !== 'undefined') BudgetModule.updateCategoryOptions();
        
        document.getElementById('new-category').value = '';
        categorySelect.value = formattedCat;
    }
});

// === CRUD ACTIONS ===
window.deleteTransaction = function(id) {
    if (confirm('Deseja realmente excluir este lançamento?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        
        // Sincronização Firebase (Remoção)
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.deleteData('transactions', id);
        }
        
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
        
        showView('form');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

init();
