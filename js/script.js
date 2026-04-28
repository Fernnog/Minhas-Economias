// === STATE MANAGEMENT ===
let transactions = JSON.parse(localStorage.getItem('fin_transactions')) || [];
let categories = JSON.parse(localStorage.getItem('fin_categories')) || ['Alimentação', 'Moradia', 'Transporte', 'Salário', 'Lazer'];
let pinnedBudgets = JSON.parse(localStorage.getItem('fin_pinned_budgets')) || [];

/**
 * FUNÇÃO UTILITÁRIA GLOBAL — Fonte Única da Verdade para Gastos Mensais
 */
window.getMonthExpenses = function(mesAlvo, anoAlvo) {
    const expenses = {};
    transactions.forEach(t => {
        if (t.type !== 'despesa') return;
        if (t.category.toLowerCase() === 'sem categoria') return;

        const d = new Date(t.date + 'T00:00:00');
        const tMonth = d.getMonth();
        const tYear = d.getFullYear();

        if (tYear === anoAlvo && tMonth === mesAlvo) {
            const mesStr = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, '0')}`;
            if (t.skippedDates && t.skippedDates.some(sd => sd.startsWith(mesStr))) return;
            expenses[t.category] = (expenses[t.category] || 0) + t.amount;
            return;
        }

        if (t.isRecurring && (tYear < anoAlvo || (tYear === anoAlvo && tMonth < mesAlvo))) {
            if (t.recurrenceEndDate) {
                const fim = new Date(t.recurrenceEndDate);
                if (new Date(anoAlvo, mesAlvo, 1) >= fim) return;
            }
            const mesStr = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, '0')}`;
            if (t.skippedDates && t.skippedDates.some(sd => sd.startsWith(mesStr))) return;
            expenses[t.category] = (expenses[t.category] || 0) + t.amount;
        }
    });
    return expenses;
};

// === CHIP CÍCLICO DE MEIO DE PAGAMENTO (UI) ===

window.cyclePaymentMethod = function() {
    const hiddenInput = document.getElementById('trans-payment-method');
    const toggleEl   = document.getElementById('payment-chip-toggle');
    if (!hiddenInput || !toggleEl) return;

    const currentIndex = PAYMENT_CYCLE.indexOf(hiddenInput.value);
    const nextIndex    = (currentIndex + 1) % PAYMENT_CYCLE.length;
    const nextValue    = PAYMENT_CYCLE[nextIndex];
    const config       = PAYMENT_CONFIG[nextValue];

    hiddenInput.value = nextValue;

    PAYMENT_CYCLE.forEach(m => toggleEl.classList.remove(PAYMENT_CONFIG[m].clsToggle));
    toggleEl.classList.add(config.clsToggle);

    toggleEl.innerHTML = `
        <span class="chip-toggle-icon">${config.svg}</span>
        <span class="chip-toggle-label">${config.label}</span>
    `;
    
    toggleEl.style.transform = "scale(0.95)";
    setTimeout(() => toggleEl.style.transform = "", 100);
};

window.setPaymentChip = function(value) {
    const hiddenInput = document.getElementById('trans-payment-method');
    const toggleEl   = document.getElementById('payment-chip-toggle');
    if (!hiddenInput || !toggleEl) return;

    const safeValue = PAYMENT_CYCLE.includes(value) ? value : '';
    const config    = PAYMENT_CONFIG[safeValue];

    hiddenInput.value = safeValue;
    PAYMENT_CYCLE.forEach(m => toggleEl.classList.remove(PAYMENT_CONFIG[m].clsToggle));
    toggleEl.classList.add(config.clsToggle);
    toggleEl.innerHTML = `
        <span class="chip-toggle-icon">${config.svg}</span>
        <span class="chip-toggle-label">${config.label}</span>
    `;
};

// === NAVEGAÇÃO E UTILS ===
let dashboardMonthOffset = 0;

window.showToast = function(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// === DOM ELEMENTS ===
const form = document.getElementById('transaction-form');
const categorySelect = document.getElementById('trans-category');
const categoryForm = document.getElementById('category-form');
const recurrenceSelect = document.getElementById('trans-recurrence-type');
const parcelasContainer = document.getElementById('parcelas-container');
const amountInput = document.getElementById('trans-amount');
const dashboardView = document.getElementById('dashboard-view');
const managementView = document.getElementById('management-view');

function notifyCategoryChange() {
    saveData();
    updateCategorySelect();
    if (typeof BudgetModule !== 'undefined' && typeof BudgetModule.updateCategoryOptions === 'function') {
        BudgetModule.updateCategoryOptions();
    }
}

if(recurrenceSelect) {
    recurrenceSelect.addEventListener('change', (e) => {
        e.target.value === 'parcelada' ? parcelasContainer.classList.remove('hidden') : parcelasContainer.classList.add('hidden');
    });
}

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

function init() {
    document.querySelectorAll('dialog').forEach(d => {
        d.addEventListener('click', e => { if (e.target === d) d.close(); });
    });

    document.getElementById('btn-next-month')?.addEventListener('click', () => {
        if (dashboardMonthOffset < 1) { dashboardMonthOffset++; updateDashboardData(); }
    });

    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
        if (dashboardMonthOffset > 0) { dashboardMonthOffset--; updateDashboardData(); }
    });

    if (!categories.includes('Sem Categoria')) {
        categories.push('Sem Categoria');
        notifyCategoryChange();
    }

    if (typeof initChangelog === 'function') initChangelog();
    
    const headerDate = document.getElementById('header-date');
    if (headerDate) headerDate.innerText = new Date().toLocaleDateString('pt-BR');
    
    const transDate = document.getElementById('trans-date');
    if (transDate) transDate.valueAsDate = new Date();
    
    updateCategorySelect();
    
    if (typeof ExtractModule !== 'undefined') ExtractModule.init();
    if (typeof BudgetModule !== 'undefined') BudgetModule.init();
    
    updateAllViews();
}

window.showDashboard = function() {
    managementView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    updateAllViews();
};

window.showView = function(targetView) {
    dashboardView.classList.add('hidden');
    managementView.classList.remove('hidden');
    const subViews = ['view-form', 'view-extract', 'view-budget', 'view-charts'];
    subViews.forEach(viewId => {
        const viewEl = document.getElementById(viewId);
        if (viewEl) viewEl.classList.add('hidden');
    });
    const targetEl = document.getElementById(`view-${targetView}`);
    if (targetEl) targetEl.classList.remove('hidden');
    if (targetView === 'budget' && typeof BudgetModule !== 'undefined') BudgetModule.render();
    if (targetView === 'charts') updateDashboardData(); 
};

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

    const animatableCards = [document.getElementById('card-saldo-atual'), document.getElementById('card-saldo-mes')].filter(Boolean);
    animatableCards.forEach(card => {
        card.classList.remove('card-animating');
        void card.offsetWidth; 
        card.classList.add('card-animating');
    });

    const btnPrev = document.getElementById('btn-prev-month');
    const btnNext = document.getElementById('btn-next-month');
    if (btnPrev) btnPrev.disabled = isMesCorrente;
    if (btnNext) btnNext.disabled = dashboardMonthOffset >= 1;

    const cardAtualEl = document.getElementById('card-saldo-atual');
    if (cardAtualEl) isMesCorrente ? cardAtualEl.classList.remove('hidden') : cardAtualEl.classList.add('hidden');

    const cardSaldoMesLabel = document.getElementById('card-saldo-mes-label');
    const cardMesEl = document.getElementById('card-saldo-mes');
    if (cardSaldoMesLabel) cardSaldoMesLabel.textContent = isMesCorrente ? 'Projeção Final do Mês' : 'Saldo Final Previsto';
    if (cardMesEl) isMesCorrente ? cardMesEl.classList.remove('future-month') : cardMesEl.classList.add('future-month');

    let saldoAtualTotal = 0;
    let saldoFimMesTotal = 0;
    const gastosPorCategoria = getMonthExpenses(mesAtual, anoAtual);
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
            trans.type === 'receita' ? saldoAtualTotal += trans.amount : saldoAtualTotal -= trans.amount;
        }
        if (dataTrans <= hoje || isMesmoMes) {
            trans.type === 'receita' ? saldoFimMesTotal += trans.amount : saldoFimMesTotal -= trans.amount;
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
            <div class="bar-track"><div class="bar-fill" style="width: 0%;" data-target-width="${percentual}%"></div></div>
            <div class="bar-value">${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        `;
        chartContainer.appendChild(row);
    });
    setTimeout(() => {
        document.querySelectorAll('.bar-fill').forEach(bar => { bar.style.width = bar.getAttribute('data-target-width'); });
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
    if (categories.some(c => c.toLowerCase() === newCatName.toLowerCase())) {
        alert(`A categoria "${newCatName}" já existe.`);
        return;
    }
    categories.push(newCatName);
    notifyCategoryChange();
    newCatInput.value = '';
    newCatInput.placeholder = `✅ "${newCatName}" adicionada!`;
    setTimeout(() => { newCatInput.placeholder = 'Nome da categoria...'; }, 2500);
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
        const budget = rawBudgets.find(b => b.category === cat && (b.type === 'mensal' || b.targetMonth === currentYearMonth));
        const spent = gastosDoMes[cat] || 0;
        const limit = budget ? budget.amount : 0;
        const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : (spent > 0 ? 100 : 0);
        let status = limit > 0 ? (percent > 90 ? 'status-danger' : (percent > 70 ? 'status-warning' : 'status-ok')) : (spent > 0 ? 'status-danger' : 'status-ok');
        return `
            <div class="pinned-card">
                <div class="pinned-card-header"><span>${cat}</span><span>${spent.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} / ${limit > 0 ? limit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : 'Sem Meta'}</span></div>
                <div class="progress-track" style="height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden;">
                    <div class="progress-fill ${status}" style="width: ${percent}%; height: 100%; transition: width 0.5s ease;"></div>
                </div>
            </div>`;
    }).join('');
}

form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('trans-id').value;
    const type = document.getElementById('trans-type').value;
    const rawAmount = document.getElementById('trans-amount').value;
    const amount = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
    const category = document.getElementById('trans-category').value;
    const date = document.getElementById('trans-date').value;
    const desc = document.getElementById('trans-desc').value;
    const paymentMethod = document.getElementById('trans-payment-method')?.value || '';
    const recurrenceType = document.getElementById('trans-recurrence-type') ? document.getElementById('trans-recurrence-type').value : 'unica';
    const isRecurring = (recurrenceType === 'recorrente');
    const isParcelada = (recurrenceType === 'parcelada');
    const installments = parseInt(document.getElementById('trans-installments')?.value || 1);
    const exceptionParent = document.getElementById('trans-exception-parent')?.value;
    const exceptionDate = document.getElementById('trans-exception-date')?.value;

    const newItemsToSync = [];

    if (id) {
        const editScope = document.getElementById('trans-edit-scope')?.value;
        const isInstallmentEdit = id.includes('_');

        if (isInstallmentEdit && editScope === 'this_and_future') {
            const [baseId, currentIndexStr] = id.split('_');
            const currentIndex = parseInt(currentIndexStr);

            transactions.forEach(t => {
                if (t.id.startsWith(baseId + '_')) {
                    const tIndex = parseInt(t.id.split('_')[1]);
                    if (tIndex >= currentIndex) {
                        t.amount = amount;
                        t.type = type;
                        t.category = category;
                        t.paymentMethod = paymentMethod;
                        newItemsToSync.push(t);
                    }
                }
            });
        } else {
            const transactionData = { id, type, amount, category, date, desc, isRecurring, paymentMethod };
            const index = transactions.findIndex(t => t.id === id);
            transactions[index] = transactionData;
            newItemsToSync.push(transactionData);
        }
        document.getElementById('btn-save').innerText = 'Salvar Lançamento';
    } else {
        if (isParcelada) {
            const baseDate = new Date(date + 'T00:00:00');
            for (let i = 0; i < installments; i++) {
                const instDate = new Date(baseDate);
                instDate.setMonth(instDate.getMonth() + i);
                const instData = {
                    id: Date.now().toString() + "_" + i,
                    type, amount: amount, 
                    category, date: instDate.toISOString().split('T')[0], 
                    desc: `${desc} (${i + 1}/${installments})`, isRecurring: false, paymentMethod
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
                        const transactionData = { id: Date.now().toString(), type, amount, category, date, desc, isRecurring: true, paymentMethod };
                        transactions.push(transactionData);
                        newItemsToSync.push(transactionData);
                    } else {
                        parentTx.skippedDates = parentTx.skippedDates || [];
                        parentTx.skippedDates.push(exceptionDate);
                        newItemsToSync.push(parentTx);
                        const transactionData = { id: Date.now().toString(), type, amount, category, date, desc, isRecurring: false, paymentMethod };
                        transactions.push(transactionData);
                        newItemsToSync.push(transactionData);
                    }
                }
            } else {
                const transactionData = { id: Date.now().toString(), type, amount, category, date, desc, isRecurring, paymentMethod };
                transactions.push(transactionData);
                newItemsToSync.push(transactionData);
            }
        }
    }

    saveData();
    if (typeof FirebaseModule !== 'undefined') newItemsToSync.forEach(t => FirebaseModule.syncData('transactions', t));
    updateAllViews();
    form.reset();
    setPaymentChip('');
    document.getElementById('trans-id').value = '';
    const transDateInput = document.getElementById('trans-date');
    if (transDateInput) transDateInput.valueAsDate = new Date();
    showToast(id ? 'Lançamento atualizado com sucesso!' : 'Novo lançamento salvo!');
    showDashboard();
});

window.deleteTransaction = function(id) {
    if (confirm('Deseja realmente excluir este lançamento?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        if (typeof FirebaseModule !== 'undefined') FirebaseModule.deleteData('transactions', id);
        updateAllViews();
        showToast('Lançamento excluído com sucesso!');
    }
};

window.editSingleProjected = function(id, date) {
    const parentId = id.replace('_proj', '');
    const parentTx = transactions.find(t => t.id === parentId);
    if (!parentTx) return;

    document.getElementById('trans-id').value = ''; 
    document.getElementById('trans-exception-parent').value = parentId;
    document.getElementById('trans-exception-date').value = date;
    document.getElementById('trans-type').value = parentTx.type;
    document.getElementById('trans-amount').value = parentTx.amount.toFixed(2).replace('.', ',');
    document.getElementById('trans-category').value = parentTx.category;
    document.getElementById('trans-date').value = date;
    document.getElementById('trans-desc').value = parentTx.desc;
    document.getElementById('trans-recurrence-type').value = 'unica';
    
    setPaymentChip(parentTx.paymentMethod || '');

    const scopeContainer = document.getElementById('edit-scope-container');
    if (scopeContainer) scopeContainer.classList.remove('hidden');
    document.getElementById('btn-save').innerText = 'Salvar Alteração';
    showView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.stopRecurrence = function(id, date) {
    const parentId = id.replace('_proj', '');
    if (confirm('Deseja interromper esta repetição a partir deste mês? Todos os lançamentos futuros serão cancelados.')) {
        const parentTx = transactions.find(t => t.id === parentId);
        if (parentTx) {
            parentTx.recurrenceEndDate = date;
            saveData();
            if (typeof FirebaseModule !== 'undefined') FirebaseModule.syncData('transactions', parentTx);
            updateAllViews();
        }
    }
};

window.editTransaction = function(id) {
    const trans = transactions.find(t => t.id === id);
    if (!trans) return;

    document.getElementById('trans-id').value = trans.id;
    document.getElementById('trans-type').value = trans.type;
    document.getElementById('trans-amount').value = trans.amount.toFixed(2).replace('.', ',');
    document.getElementById('trans-category').value = trans.category;
    document.getElementById('trans-date').value = trans.date;
    document.getElementById('trans-desc').value = trans.desc;
    setPaymentChip(trans.paymentMethod || ''); 

    if (recurrenceSelect) {
        recurrenceSelect.value = trans.isRecurring ? 'recorrente' : 'unica';
        recurrenceSelect.dispatchEvent(new Event('change'));
    }

    const isInstallment = trans.id.includes('_');
    const scopeContainer = document.getElementById('edit-scope-container');
    
    if ((trans.isRecurring || isInstallment) && scopeContainer) {
        scopeContainer.classList.remove('hidden');
        
        if (trans.isRecurring) {
            document.getElementById('trans-id').value = ''; 
            document.getElementById('trans-exception-parent').value = trans.id;
            document.getElementById('trans-exception-date').value = trans.date;
        }
    } else if (scopeContainer) {
        scopeContainer.classList.add('hidden');
    }

    document.getElementById('btn-save').innerText = 'Atualizar Lançamento';
    showView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

init();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error('❌ Falha Service Worker:', err));
    });
}
