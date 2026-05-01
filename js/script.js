// === STATE MANAGEMENT ===
let transactions = JSON.parse(localStorage.getItem('fin_transactions')) || [];
let categories = JSON.parse(localStorage.getItem('fin_categories')) || ['Alimentação', 'Moradia', 'Transporte', 'Salário', 'Lazer'];
let pinnedBudgets = JSON.parse(localStorage.getItem('fin_pinned_budgets')) || [];

/**
 * FUNÇÃO UTILITÁRIA — Normaliza data para o 1º dia do mês
 * Essencial para que a lógica de exclusão no extrato funcione corretamente
 */
function getFirstDayOfMonth(dateStr) {
    if (!dateStr) return '';
    const [y, m] = dateStr.split('-');
    return `${y}-${m}-01`;
}

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

/**
 * FUNÇÃO UTILITÁRIA GLOBAL — Receitas por Categoria num mês/ano
 */
window.getMonthIncome = function(mesAlvo, anoAlvo) {
    const income = {};
    transactions.forEach(t => {
        if (t.type !== 'receita') return;
        const d = new Date(t.date + 'T00:00:00');
        const tMonth = d.getMonth();
        const tYear  = d.getFullYear();

        if (tYear === anoAlvo && tMonth === mesAlvo) {
            income[t.category] = (income[t.category] || 0) + t.amount;
            return;
        }
        if (t.isRecurring && (tYear < anoAlvo || (tYear === anoAlvo && tMonth < mesAlvo))) {
            if (t.recurrenceEndDate) {
                const fim = new Date(t.recurrenceEndDate);
                if (new Date(anoAlvo, mesAlvo, 1) >= fim) return;
            }
            income[t.category] = (income[t.category] || 0) + t.amount;
        }
    });
    return income;
};

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

// Estado independente do gráfico de categorias (null = segue o painel)
let _chartMonth = null; // { year, month } ou null

// === TOAST DELEGATION ===
window.showToast = function(message) {
    if (typeof ToastModule !== 'undefined') {
        ToastModule.show(message);
    } else {
        console.warn('[Fallback Toast]:', message);
    }
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

// === UTILITÁRIO: TRAVA VISUAL DO CAMPO TIPO DE REPETIÇÃO ===

function lockRecurrenceField(value) {
    const sel = document.getElementById('trans-recurrence-type');
    if (!sel) return;
    sel.value = value;
    sel.classList.add('select-locked');
    if (parcelasContainer) parcelasContainer.classList.add('hidden');
}

function unlockRecurrenceField() {
    const sel = document.getElementById('trans-recurrence-type');
    if (!sel) return;
    sel.classList.remove('select-locked');
}

// =========================================================

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

function populateCategoryGroups() {
    if (typeof CategoryGroups === 'undefined') return;
    
    const parents = CategoryGroups.getFixedParents();
    const optionsHTML = '<option value="">— Sem vínculo (Outros) —</option>' + 
        parents.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    const selectPainel = document.getElementById('category-manager-parent');
    const selectForm = document.getElementById('new-category-parent');
    
    if (selectPainel) selectPainel.innerHTML = optionsHTML;
    if (selectForm) selectForm.innerHTML = optionsHTML;
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
    
    const headerDate = document.getElementById('header-date');
    if (headerDate) headerDate.innerText = new Date().toLocaleDateString('pt-BR');
    
    const transDate = document.getElementById('trans-date');
    if (transDate) transDate.valueAsDate = new Date();
    
    populateCategoryGroups();
    
    if (typeof CategoryManager !== 'undefined') CategoryManager.init();

    updateCategorySelect();
    
    try {
        if (typeof ExtractModule !== 'undefined') ExtractModule.init();
    } catch (error) { console.error('Erro ao iniciar ExtractModule:', error); }

    try {
        if (typeof BudgetModule !== 'undefined') BudgetModule.init();
    } catch (error) { console.error('Erro ao iniciar BudgetModule:', error); }

    try {
        if (typeof SyncModule !== 'undefined') SyncModule.init();
    } catch (error) { console.error('Erro ao iniciar SyncModule:', error); }

    const chartPicker = document.getElementById('chart-month-picker');
    if (chartPicker) {
        const hoje = new Date();
        chartPicker.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        chartPicker.addEventListener('change', (e) => {
            if (!e.target.value) return;
            const [y, m] = e.target.value.split('-');
            _chartMonth = { year: parseInt(y), month: parseInt(m) - 1 };
            _renderChartContent(_chartMonth.month, _chartMonth.year);
            _updateChartMonthChip(_chartMonth.month, _chartMonth.year);
        });
    }

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
            const mesStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
            if (t.skippedDates && t.skippedDates.some(sd => sd.startsWith(mesStr))) return;
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

    renderCategoryIncomeExpenseChart(gastosPorCategoria, mesAtual, anoAtual);
    renderPinnedBudgets(gastosPorCategoria, mesAtual, anoAtual);
}

function renderCategoryIncomeExpenseChart(gastos, mes, ano) {
    const targetMes = (_chartMonth !== null) ? _chartMonth.month : mes;
    const targetAno = (_chartMonth !== null) ? _chartMonth.year  : ano;

    _updateChartMonthChip(targetMes, targetAno);
    _renderChartContent(targetMes, targetAno);
}

function _updateChartMonthChip(mes, ano) {
    const chip = document.getElementById('chart-month-chip');
    if (!chip) return;
    const nome = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    chip.textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
}

function _getMonthExpensesAll(mesAlvo, anoAlvo) {
    const expenses = {};
    transactions.forEach(t => {
        if (t.type !== 'despesa') return;
        const d = new Date(t.date + 'T00:00:00');
        const tMonth = d.getMonth();
        const tYear  = d.getFullYear();

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
}

function _toggleGroupRows(groupId) {
    const children = document.querySelectorAll(`[data-child-of="${groupId}"]`);
    const chevron  = document.getElementById(`chv-${groupId}`);
    const isOpen   = chevron && chevron.textContent.trim() === '▼';

    children.forEach(row => {
        if (isOpen) {
            row.classList.add('hidden');
        } else {
            row.classList.remove('hidden');
            setTimeout(() => {
                row.querySelectorAll('[data-target-width]').forEach(bar => {
                    bar.style.width = bar.getAttribute('data-target-width');
                });
            }, 30);
        }
    });

    if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
}

function _renderChartContent(mes, ano) {
    const chartContainer  = document.getElementById('category-chart');
    const totalsContainer = document.getElementById('category-chart-totals');
    if (!chartContainer || !totalsContainer) return;

    const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const gastos  = _getMonthExpensesAll(mes, ano);
    const receitas = getMonthIncome(mes, ano);

    const totalExp = Object.values(gastos).reduce((s, v) => s + v, 0);
    const totalInc = Object.values(receitas).reduce((s, v) => s + v, 0);
    const saldo    = totalInc - totalExp;
    const saldoClass = saldo >= 0 ? 'balance-pos' : 'balance-neg';

    totalsContainer.innerHTML = `
        <div class="chart-total-item">
            <span class="chart-total-label">Receitas</span>
            <span class="chart-total-value income">${fmt(totalInc)}</span>
        </div>
        <div class="chart-total-item">
            <span class="chart-total-label">Despesas</span>
            <span class="chart-total-value expense">${fmt(totalExp)}</span>
        </div>
        <div class="chart-total-item">
            <span class="chart-total-label">Saldo</span>
            <span class="chart-total-value ${saldoClass}">${fmt(saldo)}</span>
        </div>
    `;

    chartContainer.innerHTML = '';

    const catsInc = Object.keys(receitas).sort((a, b) => receitas[b] - receitas[a]);
    if (catsInc.length > 0) {
        const maxInc = receitas[catsInc[0]];
        const blockInc = document.createElement('div');
        blockInc.className = 'chart-section-block';
        blockInc.innerHTML = `<div class="chart-section-title">Receitas por Categoria</div>`;
        catsInc.forEach(cat => {
            const valor = receitas[cat];
            const pct   = (valor / maxInc * 100).toFixed(1);
            const row   = document.createElement('div');
            row.className = 'bar-row';
            row.innerHTML = `
                <div class="bar-label" title="${cat}">${cat}</div>
                <div class="bar-track"><div class="bar-fill-income" style="width:0%;" data-target-width="${pct}%"></div></div>
                <div class="bar-value">${fmt(valor)}</div>
            `;
            blockInc.appendChild(row);
        });
        chartContainer.appendChild(blockInc);
    }

    if (Object.keys(gastos).length > 0) {
        const blockExp = document.createElement('div');
        blockExp.className = 'chart-section-block';
        blockExp.innerHTML = `<div class="chart-section-title">Despesas por Categoria</div>`;

        const useGroups = typeof CategoryGroups !== 'undefined';

        if (useGroups) {
            const grouped = CategoryGroups.groupExpenses(gastos);
            const maxGroupTotal = grouped.length > 0 ? grouped[0].total : 1;

            grouped.forEach((g, idx) => {
                const pctParent = (g.total / maxGroupTotal * 100).toFixed(1);
                const groupId   = `grp-${g.parent.id}-${idx}`;

                const parentRow = document.createElement('div');
                parentRow.className = 'bar-row bar-row-parent';
                parentRow.setAttribute('data-group', groupId);
                parentRow.style.cursor = 'pointer';
                parentRow.innerHTML = `
                    <div class="bar-label bar-label-parent" title="${g.parent.name}" style="color:${g.parent.color}; font-weight:700;">
                        <span class="group-chevron" id="chv-${groupId}">▶</span>
                        ${g.parent.name}
                        <small style="font-weight:400; color:var(--text-light);">(${g.children.length})</small>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width:0%; background:${g.parent.color};" data-target-width="${pctParent}%"></div>
                    </div>
                    <div class="bar-value" style="color:${g.parent.color};">${fmt(g.total)}</div>
                `;
                parentRow.addEventListener('click', () => _toggleGroupRows(groupId));
                blockExp.appendChild(parentRow);

                const maxChild = g.children[0]?.value || 1;
                g.children.forEach(child => {
                    const pctChild = (child.value / maxChild * 100).toFixed(1);
                    const childRow = document.createElement('div');
                    childRow.className = 'bar-row bar-row-child hidden';
                    childRow.setAttribute('data-child-of', groupId);
                    childRow.style.paddingLeft = '1rem';
                    childRow.innerHTML = `
                        <div class="bar-label" title="${child.name}" style="font-size:0.85rem; color:var(--text-light);">
                            ↳ ${child.name}
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill bar-fill-child" style="width:0%; background:${g.parent.color}88;" data-target-width="${pctChild}%"></div>
                        </div>
                        <div class="bar-value" style="font-size:0.85rem;">${fmt(child.value)}</div>
                    `;
                    blockExp.appendChild(childRow);
                });
            });

        } else {
            const catsExp = Object.keys(gastos).sort((a, b) => gastos[b] - gastos[a]);
            const maxExp = gastos[catsExp[0]];
            catsExp.forEach(cat => {
                const valor = gastos[cat];
                const pct   = (valor / maxExp * 100).toFixed(1);
                const row   = document.createElement('div');
                row.className = 'bar-row';
                row.innerHTML = `
                    <div class="bar-label" title="${cat}">${cat}</div>
                    <div class="bar-track"><div class="bar-fill" style="width:0%;" data-target-width="${pct}%"></div></div>
                    <div class="bar-value">${fmt(valor)}</div>
                `;
                blockExp.appendChild(row);
            });
        }

        chartContainer.appendChild(blockExp);
    }

    if (catsInc.length === 0 && Object.keys(gastos).length === 0) {
        chartContainer.innerHTML = '<p style="text-align:center; color:#888; font-size:0.9rem;">Nenhum lançamento registrado para este mês.</p>';
    }

    setTimeout(() => {
        document.querySelectorAll('#category-chart .bar-fill, #category-chart .bar-fill-income').forEach(bar => {
            bar.style.width = bar.getAttribute('data-target-width');
        });
    }, 50);
}


function updateCategorySelect() {
    if (!categorySelect) return;
    categorySelect.innerHTML = '';

    const useGroups = typeof CategoryGroups !== 'undefined';

    if (useGroups) {
        const groups = CategoryGroups.getGroups();
        const assignedSet = new Set();

        groups.forEach(g => {
            const subs = g.subcategories.filter(s => categories.includes(s));
            if (subs.length === 0) return;
            const optgroup = document.createElement('optgroup');
            optgroup.label = g.name;
            subs.sort().forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                optgroup.appendChild(opt);
                assignedSet.add(cat);
            });
            categorySelect.appendChild(optgroup);
        });

        const ungrouped = categories.filter(c => !assignedSet.has(c) && c !== 'Sem Categoria' && c.toLowerCase() !== 'sem category');
        if (ungrouped.length > 0) {
            const grpOthers = document.createElement('optgroup');
            grpOthers.label = 'Outros';
            ungrouped.sort().forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                grpOthers.appendChild(opt);
            });
            categorySelect.appendChild(grpOthers);
        }

        const optSem = document.createElement('option');
        optSem.value = 'Sem Categoria';
        optSem.textContent = 'Sem Categoria';
        categorySelect.appendChild(optSem);

    } else {
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
}

categoryForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    const newCatInput  = document.getElementById('new-category');
    const parentSelect = document.getElementById('new-category-parent'); 
    if (!newCatInput) return;
    const newCatName = newCatInput.value.trim();
    const parentId   = parentSelect ? parentSelect.value : '';
    if (!newCatName) return;

    if (typeof CategoryManager !== 'undefined') {
        const success = CategoryManager.add(newCatName, parentId); 
        if (success) {
            newCatInput.value = '';
            if (parentSelect) parentSelect.value = '';
            newCatInput.placeholder = `✅ "${newCatName}" adicionada!`;
            setTimeout(() => { newCatInput.placeholder = 'Ex: Aluguel, Remédios, Netflix...'; }, 2500);
        }
    } else {
        if (categories.some(c => c.toLowerCase() === newCatName.toLowerCase())) {
            alert(`A categoria "${newCatName}" já existe.`);
            return;
        }
        categories.push(newCatName);
        notifyCategoryChange();
        newCatInput.value = '';
        if (parentSelect) parentSelect.value = '';
        newCatInput.placeholder = `✅ "${newCatName}" adicionada!`;
        setTimeout(() => { newCatInput.placeholder = 'Ex: Aluguel, Remédios, Netflix...'; }, 2500);
    }
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
                <div class="pinned-card-header">
                    <button
                        class="pinned-category-btn"
                        onclick="openCategoryTransactions('${cat.replace(/'/g, "\\'")}', ${mesAtual}, ${anoAtual})"
                        title="Ver lançamentos de ${cat}">
                        ${cat}
                    </button>
                    <span>${spent.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} / ${limit > 0 ? limit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : 'Sem Meta'}</span>
                </div>
                <div class="progress-track" style="height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden;">
                    <div class="progress-fill ${status}" style="width: ${percent}%; height: 100%; transition: width 0.5s ease;"></div>
                </div>
            </div>`;
    }).join('');
}

function _getMonthTransactionsByCategory(category, mesAlvo, anoAlvo) {
    const result = [];
    const mesStr = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, '0')}`;

    transactions.forEach(t => {
        if (t.type !== 'despesa') return;
        if (t.category !== category) return;

        const d = new Date(t.date + 'T00:00:00');
        const tMonth = d.getMonth();
        const tYear = d.getFullYear();

        if (tYear === anoAlvo && tMonth === mesAlvo) {
            if (t.skippedDates && t.skippedDates.some(sd => sd.startsWith(mesStr))) return;
            result.push({ ...t, isProjected: false });
            return;
        }

        if (t.isRecurring && (tYear < anoAlvo || (tYear === anoAlvo && tMonth < mesAlvo))) {
            if (t.recurrenceEndDate) {
                const fim = new Date(t.recurrenceEndDate);
                if (new Date(anoAlvo, mesAlvo, 1) >= fim) return;
            }
            if (t.skippedDates && t.skippedDates.some(sd => sd.startsWith(mesStr))) return;
            const diaOriginal = String(d.getDate()).padStart(2, '0');
            result.push({ ...t, date: `${mesStr}-${diaOriginal}`, isProjected: true });
        }
    });

    result.sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00'));
    return result;
}

window.openCategoryTransactions = function(category, mes, ano) {
    const dialog   = document.getElementById('category-transactions-dialog');
    const titleEl  = document.getElementById('category-transactions-title');
    const contentEl = document.getElementById('category-transactions-content');
    if (!dialog || !titleEl || !contentEl) return;

    const txs = _getMonthTransactionsByCategory(category, mes, ano);
    const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataRef = new Date(ano, mes, 1);
    const nomeMes = dataRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const nomeMesCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

    titleEl.textContent = `${category} — ${nomeMesCapitalizado}`;

    if (txs.length === 0) {
        contentEl.innerHTML = `
            <p class="cat-tx-empty">
                Nenhum lançamento de despesa encontrado para <strong>${category}</strong> neste mês.
            </p>`;
    } else {
        const total = txs.reduce((acc, t) => acc + t.amount, 0);
        const count = txs.length;

        contentEl.innerHTML = `
            <div class="cat-tx-summary">
                <span>${count} lançamento${count !== 1 ? 's' : ''}</span>
                <span class="cat-tx-total">${fmt(total)}</span>
            </div>
            <ul class="cat-tx-list">
                ${txs.map(t => {
                    const dataFormatada = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
                    const descricao = t.desc ? t.desc : '—';
                    const badgeHTML = t.isProjected
                        ? `<span class="cat-tx-badge">Recorrente</span>`
                        : '';
                    return `
                        <li class="cat-tx-item${t.isProjected ? ' projected' : ''}">
                            <div class="cat-tx-info">
                                <span class="cat-tx-desc" title="${descricao}">${descricao}</span>
                                ${badgeHTML}
                            </div>
                            <div class="cat-tx-meta">
                                <span class="cat-tx-date">${dataFormatada}</span>
                                <span class="cat-tx-amount">${fmt(t.amount)}</span>
                            </div>
                        </li>`;
                }).join('')}
            </ul>`;
    }

    dialog.showModal();
};

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
                        t.desc = desc; // CORREÇÃO: Propaga a descrição atualizada para as parcelas
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
                        // CORREÇÃO: Usa o 1º dia do mês como data de término para exclusão correta
                        parentTx.recurrenceEndDate = getFirstDayOfMonth(exceptionDate);
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
    unlockRecurrenceField(); 
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

    lockRecurrenceField('recorrente');
    
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
            // CORREÇÃO: Garante granularidade mensal para exclusão no extrato
            parentTx.recurrenceEndDate = getFirstDayOfMonth(date);
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

    const isInstallment = trans.id.includes('_');
    const scopeContainer = document.getElementById('edit-scope-container');

    if (recurrenceSelect) {
        if (isInstallment) {
            lockRecurrenceField('parcelada');
        } else if (trans.isRecurring) {
            lockRecurrenceField('recorrente');
        } else {
            unlockRecurrenceField();
            recurrenceSelect.value = 'unica';
            recurrenceSelect.dispatchEvent(new Event('change'));
        }
    }
    
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error('❌ Falha Service Worker:', err));
    });
}

// === NOVO MÓDULO DE SINCRONIZAÇÃO (Cards de Pagamento) ===
const SyncModule = (function() {
    const STORAGE_KEY = 'fin_sync_dates';
    let syncDates = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { debito: '', cartao1: '', cartao2: '' };

    function init() {
        updateUI();
    }

    function saveDate(method, dateVal) {
        if(!dateVal) return;
        syncDates[method] = dateVal;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(syncDates));
        updateUI();
        
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('preferences', { id: 'sync_dates', dates: syncDates });
        }
        
        if (typeof showToast === 'function') {
            showToast('Data de atualização salva!');
        }
    }

    function updateUI() {
        ['debito', 'cartao1', 'cartao2'].forEach(method => {
            const displayEl = document.getElementById(`display-date-${method}`);
            const inputEl = document.getElementById(`sync-date-${method}`);
            const cardEl = document.getElementById(`sync-card-${method}`);
            
            if (displayEl && inputEl && cardEl) {
                if (syncDates[method]) {
                    const [y, m, d] = syncDates[method].split('-');
                    displayEl.textContent = `Até: ${d}/${m}`;
                    inputEl.value = syncDates[method];
                    cardEl.title = `Atualizado até ${d}/${m}/${y}`;
                } else {
                    displayEl.textContent = 'Pendente';
                    cardEl.title = 'Definir data de atualização';
                }
            }
        });
    }

    function loadFromCloud(cloudDates) {
        if(cloudDates) {
            syncDates = cloudDates;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(syncDates));
            updateUI();
        }
    }

    return { init, saveDate, loadFromCloud };
})();

// =========================================================================
// INICIALIZAÇÃO SEGURA DA APLICAÇÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        init();
    } catch (error) {
        console.error('Falha crítica ao inicializar a aplicação:', error);
    }
});
