// === STATE MANAGEMENT ===
let transactions = JSON.parse(localStorage.getItem('fin_transactions')) || [];
let categories = JSON.parse(localStorage.getItem('fin_categories')) || ['Alimentação', 'Moradia', 'Transporte', 'Salário', 'Lazer'];

// === DOM ELEMENTS ===
const form = document.getElementById('transaction-form');
const list = document.getElementById('transaction-list');
const categorySelect = document.getElementById('trans-category');
const categoryForm = document.getElementById('category-form');
const recurrenceSelect = document.getElementById('trans-recurrence-type');
const parcelasContainer = document.getElementById('parcelas-container');
const amountInput = document.getElementById('trans-amount');

// Views
const dashboardView = document.getElementById('dashboard-view');
const managementView = document.getElementById('management-view');

// Logic for Recurrence UI
if(recurrenceSelect) {
    recurrenceSelect.addEventListener('change', (e) => {
        if(e.target.value === 'parcelada') {
            parcelasContainer.classList.remove('hidden');
        } else {
            parcelasContainer.classList.add('hidden');
        }
    });
}

// Máscara de moeda: formata o input conforme o usuário digita
if (amountInput) {
    amountInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
        if (value === "") { e.target.value = ""; return; }
        
        value = (parseInt(value) / 100).toFixed(2) + "";
        value = value.replace(".", ",");
        value = value.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
        value = value.replace(/(\d)(\d{3}),/g, "$1.$2,");
        e.target.value = value;
    });
}

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

    transactions.forEach(t => {
        const d = new Date(t.date + 'T00:00:00');
        const tMonth = d.getMonth();
        const tYear = d.getFullYear();

        todasTransacoes.push(t); 

        // Projeta se for recorrente e não tiver data de término ou se a projeção for anterior à data de término
        if (t.isRecurring && (tYear < anoAtual || (tYear === anoAtual && tMonth < mesAtual))) {
            const dataProjetada = new Date(anoAtual, mesAtual, d.getDate());
            const dataTermino = t.recurrenceEndDate ? new Date(t.recurrenceEndDate) : null;
            
            if (!dataTermino || dataProjetada < dataTermino) {
                todasTransacoes.push({
                    ...t,
                    date: `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                });
            }
        }
    });

    todasTransacoes.forEach(trans => {
        // Pula lançamentos com a categoria especial
        if (trans.category === 'Sem Categoria') return; 

        const dataTrans = new Date(trans.date + 'T00:00:00'); 
        const isMesmoMes = dataTrans.getMonth() === mesAtual && dataTrans.getFullYear() === anoAtual;
        
        if (dataTrans <= hoje) {
            if (trans.type === 'receita') saldoAtualTotal += trans.amount;
            else saldoAtualTotal -= trans.amount;
        }

        if (dataTrans <= hoje || isMesmoMes) {
            if (trans.type === 'receita') saldoFimMesTotal += trans.amount;
            else saldoFimMesTotal -= trans.amount;
        }
        
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
    
    // Tratamento exato do valor convertido da máscara visual
    const rawAmount = document.getElementById('trans-amount').value;
    const amount = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
    
    const category = document.getElementById('trans-category').value;
    const date = document.getElementById('trans-date').value;
    const desc = document.getElementById('trans-desc').value;
    
    const recurrenceType = document.getElementById('trans-recurrence-type') ? document.getElementById('trans-recurrence-type').value : 'unica';
    const isRecurring = (recurrenceType === 'recorrente');
    const isParcelada = (recurrenceType === 'parcelada');
    const installments = parseInt(document.getElementById('trans-installments')?.value || 1);

    const exceptionParent = document.getElementById('trans-exception-parent')?.value;
    const exceptionDate = document.getElementById('trans-exception-date')?.value;

    const newItemsToSync = [];

    if (id) {
        const transactionData = { id, type, amount, category, date, desc, isRecurring };
        const index = transactions.findIndex(t => t.id === id);
        transactions[index] = transactionData;
        newItemsToSync.push(transactionData);
        document.getElementById('btn-save').innerText = 'Salvar Lançamento';
    } else {
        if (isParcelada) {
            const baseDate = new Date(date + 'T00:00:00');
            // Cents-First: Cálculo em inteiros para evitar imprecisão de ponto flutuante
            const totalCents = Math.round(amount * 100);
            const installmentCents = Math.floor(totalCents / installments);
            const remainderCents = totalCents % installments;

            for (let i = 0; i < installments; i++) {
                const instDate = new Date(baseDate);
                instDate.setMonth(instDate.getMonth() + i);
                
                // O último lançamento absorve os centavos de resto
                const currentAmount = (i === installments - 1) 
                    ? (installmentCents + remainderCents) / 100 
                    : installmentCents / 100;

                const instData = {
                    id: Date.now().toString() + "_" + i,
                    type, 
                    amount: currentAmount, 
                    category, 
                    date: instDate.toISOString().split('T')[0], 
                    desc: `${desc} (${i + 1}/${installments})`, 
                    isRecurring: false
                };
                transactions.push(instData);
                newItemsToSync.push(instData);
            }
        } else {
            // Lógica de exceção de recorrência
            if (exceptionParent) {
                const parentTx = transactions.find(t => t.id === exceptionParent);
                if (parentTx) {
                    parentTx.skippedDates = parentTx.skippedDates || [];
                    parentTx.skippedDates.push(exceptionDate);
                    newItemsToSync.push(parentTx); // Atualiza o "pai" no Firebase
                }
            }

            const transactionData = { id: Date.now().toString(), type, amount, category, date, desc, isRecurring };
            transactions.push(transactionData);
            newItemsToSync.push(transactionData);
        }
    }

    saveData();
    
    if (typeof FirebaseModule !== 'undefined') {
        newItemsToSync.forEach(t => FirebaseModule.syncData('transactions', t));
    }
    
    updateAllViews();
    
    form.reset();
    document.getElementById('trans-id').value = '';
    document.getElementById('trans-date').valueAsDate = new Date();
    
    if(document.getElementById('trans-exception-parent')) {
        document.getElementById('trans-exception-parent').value = '';
        document.getElementById('trans-exception-date').value = '';
    }
    
    if (recurrenceSelect) {
        recurrenceSelect.value = 'unica';
        recurrenceSelect.dispatchEvent(new Event('change'));
    }
    
    showDashboard();
});

categoryForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const newCat = document.getElementById('new-category').value.trim();
    const formattedCat = newCat.charAt(0).toUpperCase() + newCat.slice(1);
    
    if (formattedCat && !categories.includes(formattedCat)) {
        categories.push(formattedCat);
        saveData();
        
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('categories', { id: formattedCat, name: formattedCat });
        }
        
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
        
        // Aplica a máscara inversa na hora de editar
        const formattedAmount = trans.amount.toFixed(2).replace('.', ',');
        document.getElementById('trans-amount').value = formattedAmount;
        
        document.getElementById('trans-category').value = trans.category;
        document.getElementById('trans-date').value = trans.date;
        document.getElementById('trans-desc').value = trans.desc;
        
        if (recurrenceSelect) {
            recurrenceSelect.value = trans.isRecurring ? 'recorrente' : 'unica';
            recurrenceSelect.dispatchEvent(new Event('change'));
        }
        
        document.getElementById('btn-save').innerText = 'Atualizar Lançamento';
        
        showView('form');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Nova funcionalidade: Interrupção de Recorrência
window.stopRecurrence = function(projId) {
    const originalId = projId.split('_')[0];
    const trans = transactions.find(t => t.id === originalId);
    
    if (trans && confirm(`Deseja interromper esta recorrência a partir do mês atual? (O histórico passado será mantido)`)) {
        const picker = document.getElementById('extract-month-picker');
        const [year, month] = picker.value.split('-');
        
        // Define que a recorrência termina no primeiro dia do mês selecionado no extrato
        trans.recurrenceEndDate = `${year}-${month}-01`;
        
        saveData();
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('transactions', trans);
        }
        updateAllViews();
    }
};

// Nova funcionalidade: Exceção Isolada de Recorrência
window.editSingleProjected = function(projId, dateStr) {
    const originalId = projId.replace('_proj', '');
    const trans = transactions.find(t => t.id === originalId);
    
    if (trans) {
        document.getElementById('trans-id').value = ''; 
        document.getElementById('trans-exception-parent').value = trans.id;
        document.getElementById('trans-exception-date').value = dateStr;

        document.getElementById('trans-type').value = trans.type;
        document.getElementById('trans-amount').value = trans.amount.toFixed(2).replace('.', ',');
        document.getElementById('trans-category').value = trans.category;
        document.getElementById('trans-date').value = dateStr; 
        document.getElementById('trans-desc').value = trans.desc + ' (Exceção)';

        const recurrenceSelect = document.getElementById('trans-recurrence-type');
        if (recurrenceSelect) {
            recurrenceSelect.value = 'unica';
            recurrenceSelect.dispatchEvent(new Event('change'));
        }

        document.getElementById('btn-save').innerText = 'Salvar Exceção';
        showView('form');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

init();

