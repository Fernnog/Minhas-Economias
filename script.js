// === CORE CONFIG ===
const APP_VERSION = '1.0.1'; // Atualizado para refletir a nova arquitetura modular

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
    // Injeta a versão no Card
    document.getElementById('app-version').innerText = APP_VERSION;
    document.getElementById('header-date').innerText = new Date().toLocaleDateString('pt-BR');
    document.getElementById('trans-date').valueAsDate = new Date();
    
    updateCategorySelect();
    updateAllViews();
    
    console.log(`%cPainel Financeiro Iniciado - v${APP_VERSION}`, 'color: #2e7d32; font-weight: bold; font-size: 14px;');
}

// === ROUTING (SPA) ===
window.showDashboard = function() {
    managementView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    updateAllViews();
};

window.showManagement = function() {
    dashboardView.classList.add('hidden');
    managementView.classList.remove('hidden');
};

// === LOGIC & CALCULATIONS ===
function saveData() {
    localStorage.setItem('fin_transactions', JSON.stringify(transactions));
    localStorage.setItem('fin_categories', JSON.stringify(categories));
}

function updateAllViews() {
    renderTransactions();
    updateDashboardData();
}

function updateDashboardData() {
    const hoje = new Date();
    // Ajuste de fuso para garantir que 'hoje' na tela bata com o UTC salvo
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    let saldoAtualTotal = 0;
    let saldoFimMesTotal = 0;
    const gastosPorCategoria = {};

    transactions.forEach(trans => {
        const dataTrans = new Date(trans.date + 'T00:00:00'); // Força a data local para comparação justa
        const isMesmoMes = dataTrans.getMonth() === mesAtual && dataTrans.getFullYear() === anoAtual;
        
        // Lógica de Saldos
        if (trans.type === 'receita') {
            saldoFimMesTotal += trans.amount;
            if (dataTrans <= hoje) saldoAtualTotal += trans.amount;
        } else {
            saldoFimMesTotal -= trans.amount;
            if (dataTrans <= hoje) saldoAtualTotal -= trans.amount;
            
            // Agrupamento para o Gráfico (apenas despesas do mês atual)
            if (isMesmoMes) {
                gastosPorCategoria[trans.category] = (gastosPorCategoria[trans.category] || 0) + trans.amount;
            }
        }
    });

    // Atualiza UI
    document.getElementById('saldo-atual-display').innerText = saldoAtualTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('saldo-fim-mes-display').innerText = saldoFimMesTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    // Tratamento visual de saldo negativo nos cards
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

    // Animação suave das barras após a renderização
    setTimeout(() => {
        document.querySelectorAll('.bar-fill').forEach(bar => {
            bar.style.width = bar.getAttribute('data-target-width');
        });
    }, 50);
}

function renderTransactions() {
    list.innerHTML = '';
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(trans => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(trans.date + 'T00:00:00').toLocaleDateString('pt-BR');
        const formattedAmount = trans.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const cssClass = trans.type === 'receita' ? 'receita' : 'despesa';
        const recIcon = trans.isRecurring ? ' 🔄' : '';

        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>${trans.desc}${recIcon}</td>
            <td>${trans.category}</td>
            <td class="${cssClass}">${trans.type.charAt(0).toUpperCase() + trans.type.slice(1)}</td>
            <td class="${cssClass}">${formattedAmount}</td>
            <td class="actions">
                <button onclick="editTransaction('${trans.id}')">Editar</button>
                <button class="delete" onclick="deleteTransaction('${trans.id}')">Excluir</button>
            </td>
        `;
        list.appendChild(tr);
    });
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
    
    // Retorna automaticamente ao dashboard após salvar
    showDashboard();
});

categoryForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const newCat = document.getElementById('new-category').value.trim();
    // Capitaliza a primeira letra para manter o padrão
    const formattedCat = newCat.charAt(0).toUpperCase() + newCat.slice(1);
    
    if (formattedCat && !categories.includes(formattedCat)) {
        categories.push(formattedCat);
        saveData();
        updateCategorySelect();
        document.getElementById('new-category').value = '';
        // Seleciona automaticamente a categoria recém-criada
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// RUN
init();
