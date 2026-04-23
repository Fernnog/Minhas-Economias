// === STATE MANAGEMENT ===
let transactions = JSON.parse(localStorage.getItem('fin_transactions')) || [];
let categories = JSON.parse(localStorage.getItem('fin_categories')) || ['Alimentação', 'Moradia', 'Transporte', 'Salário', 'Lazer'];
let pinnedBudgets = JSON.parse(localStorage.getItem('fin_pinned_budgets')) || [];

// === NAVEGAÇÃO DE MÊS NO DASHBOARD ===
let dashboardMonthOffset = 0; // 0 = mês atual, 1 = próximo mês

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

// === NOTIFICATION LOGIC ===

/**
 * Notifica o sistema sobre mudanças na lista de categorias,
 * disparando a persistência e a atualização de todos os componentes dependentes.
 */
function notifyCategoryChange() {
    saveData();
    updateCategorySelect();
    
    if (typeof BudgetModule !== 'undefined' && typeof BudgetModule.updateCategoryOptions === 'function') {
        BudgetModule.updateCategoryOptions();
    }
}

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

// Máscara de moeda
if (amountInput) {
    amountInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, "");
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
    // === Listeners de navegação (Prioridade de Registro) ===
    // Movidos para o topo para evitar o travamento em "Carregando..."
    document.getElementById('btn-next-month')?.addEventListener('click', () => {
        if (dashboardMonthOffset < 1) {
            dashboardMonthOffset++;
            updateDashboardData();
        }
    });

    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
        if (dashboardMonthOffset > 0) {
            dashboardMonthOffset--;
            updateDashboardData();
        }
    });

    // Garante a existência da categoria de fallback
    if (!categories.includes('Sem Categoria')) {
        categories.push('Sem Categoria');
        notifyCategoryChange();
        console.log('✅ Categoria "Sem Categoria" injetada com sucesso.');
    }

    if (typeof initChangelog === 'function') {
        initChangelog();
    }
    
    const headerDate = document.getElementById('header-date');
    if (headerDate) headerDate.innerText = new Date().toLocaleDateString('pt-BR');
    
    const transDate = document.getElementById('trans-date');
    if (transDate) transDate.valueAsDate = new Date();
    
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
    
    const subViews = ['view-form', 'view-extract', 'view-budget', 'view-charts', 'view-settings'];
    
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
    
    if (targetView === 'settings') renderSettingsForm();
    
    if (targetView === 'charts') {
        updateDashboardData(); 
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
    const anoBase = hoje.getFullYear();
    const mesBase = hoje.getMonth();

    const dataVisualizada = new Date(anoBase, mesBase + dashboardMonthOffset, 1);
    const mesAtual = dataVisualizada.getMonth();
    const anoAtual = dataVisualizada.getFullYear();
    const isMesCorrente = dashboardMonthOffset === 0;

    const monthLabel = document.getElementById('dashboard-month-label');
    if (monthLabel) {
        const nomeMes = dataVisualizada.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        monthLabel.textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
    }

    const btnPrev = document.getElementById('btn-prev-month');
    const btnNext = document.getElementById('btn-next-month');
    if (btnPrev) btnPrev.disabled = isMesCorrente;
    if (btnNext) btnNext.disabled = dashboardMonthOffset >= 1;

    const cardAtualEl = document.getElementById('card-saldo-atual');
    if (cardAtualEl) {
        isMesCorrente ? cardAtualEl.classList.remove('hidden') : cardAtualEl.classList.add('hidden');
    }

    const cardSaldoMesLabel = document.getElementById('card-saldo-mes-label');
    const cardMesEl = document.getElementById('card-saldo-mes');
    if (cardSaldoMesLabel) {
        cardSaldoMesLabel.textContent = isMesCorrente ? 'Projeção Final do Mês' : 'Saldo Final Previsto';
    }
    if (cardMesEl) {
        isMesCorrente ? cardMesEl.classList.remove('future-month') : cardMesEl.classList.add('future-month');
    }

    let saldoAtualTotal = 0;
    let saldoFimMesTotal = 0;
    const gastosPorCategoria = {};
    const todasTransacoes = [];

    transactions.forEach(t => {
        const d = new Date(t.date + 'T00:00:00');
        const tMonth = d.getMonth();
        const tYear = d.getFullYear();
        todasTransacoes.push(t);

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
        const dataTrans = new Date(trans.date + 'T00:00:00');
        const isMesmoMes = dataTrans.getMonth() === mesAtual && dataTrans.getFullYear() === anoAtual;

        if (isMesCorrente && dataTrans <= hoje) {
            if (trans.type === 'receita') saldoAtualTotal += trans.amount;
            else saldoAtualTotal -= trans.amount;
        }

        if (dataTrans <= hoje || isMesmoMes) {
            if (trans.type === 'receita') saldoFimMesTotal += trans.amount;
            else saldoFimMesTotal -= trans.amount;
        }

        if (trans.type === 'despesa' && isMesmoMes && trans.category.toLowerCase() !== 'sem categoria') {
            gastosPorCategoria[trans.category] = (gastosPorCategoria[trans.category] || 0) + trans.amount;
        }
    });

    const saldoAtualDisplay = document.getElementById('saldo-atual-display');
    const saldoFimMesDisplay = document.getElementById('saldo-fim-mes-display');
    if (saldoAtualDisplay) saldoAtualDisplay.innerText = saldoAtualTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (saldoFimMesDisplay) saldoFimMesDisplay.innerText = saldoFimMesTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (cardAtualEl) saldoAtualTotal < 0 ? cardAtualEl.classList.add('negative') : cardAtualEl.classList.remove('negative');
    if (cardMesEl) saldoFimMesTotal < 0 ? cardMesEl.classList.add('negative') : cardMesEl.classList.remove('negative');

    renderCategoryChart(gastosPorCategoria);
    renderPinnedBudgets(gastosPorCategoria, mesAtual, anoAtual);
}

function renderCategoryChart(gastos) {
    const chartContainer = document.getElementById('category-chart');
    if (!chartContainer) return;

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
    if (!categorySelect) return;
    categorySelect.innerHTML = '';
    
    let uniqueCats = [...new Set(categories.map(c => c.trim()))];
    const regularCats = uniqueCats.filter(c => c.toLowerCase() !== 'sem category' && c.toLowerCase() !== 'sem categoria').sort();
    
    categories = [...regularCats, 'Sem Categoria'];
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.innerText = cat;
        categorySelect.appendChild(option);
    });
}

categoryForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    const newCatInput = document.getElementById('new-category');
    if (!newCatInput) return;

    const newCatName = newCatInput.value.trim();
    if (!newCatName) return;

    const isDuplicate = categories.some(c => c.toLowerCase() === newCatName.toLowerCase());
    if (isDuplicate) {
        alert(`A categoria "${newCatName}" já existe.`);
        return;
    }

    categories.push(newCatName);
    notifyCategoryChange();

    newCatInput.value = '';
    newCatInput.placeholder = `✅ "${newCatName}" adicionada!`;
    setTimeout(() => { newCatInput.placeholder = 'Nome da categoria...'; }, 2500);
});

function renderSettingsForm() {
    const list = document.getElementById('pinned-categories-list');
    if (!list) return;
    
    list.innerHTML = categories
        .filter(cat => cat !== 'Sem Categoria')
        .sort()
        .map(cat => `
            <div class="checkbox-group" style="margin-bottom: 0.8rem; display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="pin-${cat}" value="${cat}" ${pinnedBudgets.includes(cat) ? 'checked' : ''}>
                <label for="pin-${cat}" style="cursor: pointer; margin: 0;">${cat}</label>
            </div>
        `).join('') || '<p style="font-size: 0.85rem; color: var(--text-light);">Nenhuma categoria encontrada.</p>';
}

document.getElementById('pinned-budgets-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const checkboxes = document.querySelectorAll('#pinned-categories-list input[type="checkbox"]:checked');
    pinnedBudgets = Array.from(checkboxes).map(cb => cb.value);
    
    localStorage.setItem('fin_pinned_budgets', JSON.stringify(pinnedBudgets));
    
    if (typeof FirebaseModule !== 'undefined') {
        FirebaseModule.syncData('preferences', { id: 'pinned', categories: pinnedBudgets });
    }
    
    showDashboard();
});

function renderPinnedBudgets(gastosDoMes, mesAtual, anoAtual) {
    const container = document.getElementById('pinned-budgets-container');
    if (!container) return;

    if (mesAtual === undefined) mesAtual = new Date().getMonth();
    if (anoAtual === undefined) anoAtual = new Date().getFullYear();

    const rawBudgets = JSON.parse(localStorage.getItem('fin_budgets')) || [];

    if (pinnedBudgets.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); font-size: 0.9rem; width: 100%; text-align: center; padding: 1rem;">Nenhum orçamento fixado. Use a engrenagem para configurar.</p>';
        return;
    }

    const currentYearMonth = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;

    container.innerHTML = pinnedBudgets.map(cat => {
        const budget = rawBudgets.find(b =>
            b.category === cat &&
            (b.type === 'mensal' || b.targetMonth === currentYearMonth)
        );
        const spent = gastosDoMes[cat] || 0;
        const limit = budget ? budget.amount : 0;
        const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : (spent > 0 ? 100 : 0);
        let status = 'status-ok';
        if (limit > 0) {
            status = percent > 90 ? 'status-danger' : (percent > 70 ? 'status-warning' : 'status-ok');
        } else if (spent > 0) {
            status = 'status-danger';
        }
        return `
            <div class="pinned-card">
                <div class="pinned-card-header">
                    <span style="display: block;">${cat}</span>
                    <span style="font-size: 0.8rem; color: var(--text-light);">
                        ${spent.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} / ${limit > 0 ? limit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : 'Sem Meta'}
                    </span>
                </div>
                <div class="progress-track" style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
                    <div class="progress-fill ${status}" style="width: ${percent}%; height: 100%; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// === EVENT HANDLERS ===
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('trans-id').value;
    const type = document.getElementById('trans-type').value;
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
            const totalCents = Math.round(amount * 100);
            const installmentCents = Math.floor(totalCents / installments);
            const remainderCents = totalCents % installments;

            for (let i = 0; i < installments; i++) {
                const instDate = new Date(baseDate);
                instDate.setMonth(instDate.getMonth() + i);
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
            if (exceptionParent) {
                const parentTx = transactions.find(t => t.id === exceptionParent);
                const editScope = document.getElementById('trans-edit-scope')?.value;

                if (parentTx) {
                    if (editScope === 'this_and_future') {
                        parentTx.recurrenceEndDate = exceptionDate;
                        newItemsToSync.push(parentTx);
                        const transactionData = { id: Date.now().toString(), type, amount, category, date, desc, isRecurring: true };
                        transactions.push(transactionData);
                        newItemsToSync.push(transactionData);
                    } else {
                        parentTx.skippedDates = parentTx.skippedDates || [];
                        parentTx.skippedDates.push(exceptionDate);
                        newItemsToSync.push(parentTx);
                        const transactionData = { id: Date.now().toString(), type, amount, category, date, desc, isRecurring: false };
                        transactions.push(transactionData);
                        newItemsToSync.push(transactionData);
                    }
                }
            } else {
                const transactionData = { id: Date.now().toString(), type, amount, category, date, desc, isRecurring };
                transactions.push(transactionData);
                newItemsToSync.push(transactionData);
            }
        }
    }

    saveData();
    if (typeof FirebaseModule !== 'undefined') {
        newItemsToSync.forEach(t => FirebaseModule.syncData('transactions', t));
    }
    updateAllViews();
    form.reset();
    document.getElementById('trans-id').value = '';
    const transDateInput = document.getElementById('trans-date');
    if (transDateInput) transDateInput.valueAsDate = new Date();
    showDashboard();
});

window.deleteTransaction = function(id) {
    if (confirm('Deseja realmente excluir este lançamento?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        if (typeof FirebaseModule !== 'undefined') FirebaseModule.deleteData('transactions', id);
        updateAllViews();
    }
};

window.editTransaction = function(id) {
    const trans = transactions.find(t => t.id === id);
    if (trans) {
        document.getElementById('trans-id').value = trans.id;
        document.getElementById('trans-type').value = trans.type;
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

init();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ Service Worker registrado'))
            .catch(err => console.error('❌ Falha Service Worker:', err));
    });
}
