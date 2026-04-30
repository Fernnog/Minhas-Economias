const BudgetModule = (function() {
    let rawBudgets = JSON.parse(localStorage.getItem('fin_budgets'));
    let budgetLimits = Array.isArray(rawBudgets) ? rawBudgets : [];

    // Migração: Converte dados antigos para a nova estrutura
    if (rawBudgets && !Array.isArray(rawBudgets)) {
        budgetLimits = Object.entries(rawBudgets).map(([cat, amt]) => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            category: cat, 
            amount: amt, 
            type: 'mensal', 
            targetMonth: null
        }));
        localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
    }

    // ── Constante compartilhada (escopo do módulo) ──────────────
    const STATUS_ICONS = {
        'status-ok': `<svg class="budget-status-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="OK"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        'status-warning': `<svg class="budget-status-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Atenção"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        'status-danger': `<svg class="budget-status-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Esgotado"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    };

    // ── Funções de Refatoração e Funcionalidades Novas ──────────

    function _renderSingleRow(budget, monthlyExpenses, currentPinned) {
        const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const spent   = monthlyExpenses[budget.category] || 0;
        const percent = Math.min((spent / budget.amount) * 100, 100);
        const status  = percent > 90 ? 'status-danger' : (percent > 70 ? 'status-warning' : 'status-ok');
        const isPinned  = currentPinned.includes(budget.category);
        const remaining = budget.amount - spent;

        const microCopy = budget.amount > 0
            ? (percent >= 100
                ? `<span class="budget-micro-copy danger-text">⚠ Orçamento esgotado</span>`
                : percent > 70
                ? `<span class="budget-micro-copy warning-text">${fmt(remaining)} restante — atenção</span>`
                : `<span class="budget-micro-copy">${fmt(remaining)} disponível</span>`)
            : `<span class="budget-micro-copy">Sem meta — apenas registrando gastos</span>`;

        return `
            <div class="budget-row">
                <div class="budget-meta-header">
                    <div class="budget-meta-info">
                        <strong style="display:flex;align-items:center;gap:0.3rem;">
                            ${STATUS_ICONS[status]}
                            ${budget.category}
                            <small style="font-weight:400;">${budget.type === 'mensal' ? '(Recorrente)' : '(Apenas este mês)'}</small>
                        </strong>
                        <span style="font-size:0.9rem;font-weight:500;color:var(--text-light);">
                            ${fmt(spent)} / ${fmt(budget.amount)}
                        </span>
                    </div>
                    <div class="actions">
                        <button onclick="BudgetModule.togglePin('${budget.category}')"
                                title="${isPinned ? 'Remover do Painel' : 'Fixar no Painel'}"
                                class="btn-pin ${isPinned ? 'pinned' : ''}">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                        </button>
                        <button onclick="BudgetModule.edit('${budget.id}')" title="Editar">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="BudgetModule.remove('${budget.id}')" title="Excluir">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${status}" style="width:${percent}%;"></div>
                </div>
                ${microCopy}
            </div>`;
    }

    function _renderGroupedBudgets(activeBudgets, monthlyExpenses, currentPinned) {
        const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (typeof CategoryGroups === 'undefined') {
            return activeBudgets.map(b => _renderSingleRow(b, monthlyExpenses, currentPinned)).join('');
        }

        const orderedGroups = CategoryGroups.getGroups();
        const groupMap      = new Map();
        const ungrouped     = [];

        activeBudgets.forEach(budget => {
            const parent = CategoryGroups.getParentOf(budget.category);
            if (parent) {
                if (!groupMap.has(parent.id)) groupMap.set(parent.id, { parent, budgets: [] });
                groupMap.get(parent.id).budgets.push(budget);
            } else {
                ungrouped.push(budget);
            }
        });

        let html = '';

        orderedGroups.forEach(g => {
            const entry = groupMap.get(g.id);
            if (!entry) return;

            const totalSpent    = entry.budgets.reduce((s, b) => s + (monthlyExpenses[b.category] || 0), 0);
            const totalBudgeted = entry.budgets.reduce((s, b) => s + b.amount, 0);
            const groupPct      = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0;
            const groupStatus   = groupPct > 90 ? 'status-danger' : (groupPct > 70 ? 'status-warning' : 'status-ok');
            const color         = entry.parent.color;

            // Lógica de colapso automático (Prioridade 2)
            const isOk = groupStatus === 'status-ok';
            const displayStyle = isOk ? 'display: none;' : 'display: block;';
            const chevronRot = isOk ? 'transform: rotate(-90deg);' : 'transform: rotate(0deg);';

            html += `
                <div class="budget-group-section">
                    <div class="budget-group-header" style="background:${color}14; border-left:3px solid ${color}; cursor:pointer;" onclick="BudgetModule.toggleBudgetGroup('${g.id}')">
                        <div class="budget-group-header-top">
                            <span class="budget-group-name" style="color:${color}; display:flex; align-items:center; gap:0.5rem;">
                                ${entry.parent.name}
                                <button class="icon-btn-small" onclick="event.stopPropagation(); BudgetModule.showGroupSummary('${g.id}', '${entry.parent.name}', ${totalSpent}, ${totalBudgeted})" title="Ver Resumo" style="background:none; border:none; color:${color}; padding:0;">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                </button>
                            </span>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span class="budget-group-total">${fmt(totalSpent)} / ${fmt(totalBudgeted)}</span>
                                <svg id="budget-group-chevron-${g.id}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; ${chevronRot}">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                        </div>
                        <div class="progress-track budget-group-bar">
                            <div class="progress-fill ${groupStatus}" style="width:${groupPct}%;"></div>
                        </div>
                    </div>
                    <div id="budget-group-items-${g.id}" class="budget-group-items" style="${displayStyle}">
                        ${entry.budgets.map(b => _renderSingleRow(b, monthlyExpenses, currentPinned)).join('')}
                    </div>
                </div>`;
        });

        if (ungrouped.length > 0) {
            const color         = '#6B7280';
            const totalSpent    = ungrouped.reduce((s, b) => s + (monthlyExpenses[b.category] || 0), 0);
            const totalBudgeted = ungrouped.reduce((s, b) => s + b.amount, 0);
            const groupPct      = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0;
            const groupStatus   = groupPct > 90 ? 'status-danger' : (groupPct > 70 ? 'status-warning' : 'status-ok');

            const isOk = groupStatus === 'status-ok';
            const displayStyle = isOk ? 'display: none;' : 'display: block;';
            const chevronRot = isOk ? 'transform: rotate(-90deg);' : 'transform: rotate(0deg);';

            html += `
                <div class="budget-group-section">
                    <div class="budget-group-header" style="background:${color}14; border-left:3px solid ${color}; cursor:pointer;" onclick="BudgetModule.toggleBudgetGroup('ungrouped')">
                        <div class="budget-group-header-top">
                            <span class="budget-group-name" style="color:${color}; display:flex; align-items:center; gap:0.5rem;">
                                Outros
                                <button class="icon-btn-small" onclick="event.stopPropagation(); BudgetModule.showGroupSummary('ungrouped', 'Outros', ${totalSpent}, ${totalBudgeted})" title="Ver Resumo" style="background:none; border:none; color:${color}; padding:0;">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                </button>
                            </span>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span class="budget-group-total">${fmt(totalSpent)} / ${fmt(totalBudgeted)}</span>
                                <svg id="budget-group-chevron-ungrouped" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; ${chevronRot}">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                        </div>
                        <div class="progress-track budget-group-bar">
                            <div class="progress-fill ${groupStatus}" style="width:${groupPct}%;"></div>
                        </div>
                    </div>
                    <div id="budget-group-items-ungrouped" class="budget-group-items" style="${displayStyle}">
                        ${ungrouped.map(b => _renderSingleRow(b, monthlyExpenses, currentPinned)).join('')}
                    </div>
                </div>`;
        }

        return html;
    }

    function toggleBudgetGroup(groupId) {
        const items = document.getElementById(`budget-group-items-${groupId}`);
        const chevron = document.getElementById(`budget-group-chevron-${groupId}`);
        if (!items || !chevron) return;
        
        if (items.style.display === 'none') {
            items.style.display = 'block';
            chevron.style.transform = 'rotate(0deg)';
        } else {
            items.style.display = 'none';
            chevron.style.transform = 'rotate(-90deg)';
        }
    }

    function showGroupSummary(groupId, parentName, spent, budgeted) {
        const dialog = document.getElementById('budget-summary-dialog');
        const title = document.getElementById('budget-summary-title');
        const content = document.getElementById('budget-summary-content');

        if (!dialog || !title || !content) {
            console.error('Dialog de resumo de orçamento não encontrado.');
            return;
        }

        title.innerText = `Resumo: ${parentName}`;
        
        let currentMonth = new Date().getMonth();
        let currentYear = new Date().getFullYear();
        const picker = document.getElementById('budget-month-picker');
        if (picker && picker.value) {
            const [y, m] = picker.value.split('-');
            currentMonth = parseInt(m) - 1;
            currentYear = parseInt(y);
        }

        let historyHtml = '<div class="summary-history" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem;">';
        let total3Months = 0;
        
        for (let i = 2; i >= 0; i--) {
            let m = currentMonth - i;
            let y = currentYear;
            if (m < 0) {
                m += 12;
                y -= 1;
            }
            
            let monthSpent = 0;
            if (typeof window.getMonthExpenses === 'function') {
                const histExp = window.getMonthExpenses(m, y);
                budgetLimits.forEach(b => {
                     if (typeof CategoryGroups !== 'undefined') {
                         const p = CategoryGroups.getParentOf(b.category);
                         if ((p && p.id === groupId) || (!p && groupId === 'ungrouped')) {
                             monthSpent += (histExp[b.category] || 0);
                         }
                     }
                });
            }
            total3Months += monthSpent;
            
            const dateObj = new Date(y, m, 1);
            const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'short' });
            historyHtml += `<div style="display:flex; justify-content:space-between; padding:0.5rem; background:var(--surface); border-radius:6px; border:1px solid var(--border);"><span>${monthName}/${y}</span><strong>${monthSpent.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</strong></div>`;
        }
        
        const avg = total3Months / 3;
        historyHtml += `</div>`;
        
        content.innerHTML = `
            ${historyHtml}
            <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border);">
                <p style="display:flex; justify-content:space-between;"><span>Média (3 meses):</span> <strong>${avg.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</strong></p>
                <p style="display:flex; justify-content:space-between; margin-top:0.5rem;"><span>Orçamento Atual:</span> <strong>${budgeted.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</strong></p>
                ${avg > budgeted ? `<p class="danger-text" style="margin-top:1rem; font-size:0.9rem; text-align:center;">⚠ O orçamento atual está abaixo da média histórica.</p>` : `<p style="color:var(--success); margin-top:1rem; font-size:0.9rem; text-align:center;">✅ O orçamento parece realista em relação ao histórico.</p>`}
            </div>
        `;
        
        dialog.showModal();
    }

    // ── Restante das Funções Originais ──────────

    function _handleSubmit(e) {
        e.preventDefault();
        save();
    }

    function init() {
        const form = document.getElementById('budget-form');
        if (form) {
            form.removeEventListener('submit', _handleSubmit);
            form.addEventListener('submit', _handleSubmit);
        }

        const picker = document.getElementById('budget-month-picker');
        if (picker) {
            picker.addEventListener('change', () => render());
        }

        updateCategoryOptions();
    }

    function updateCategoryOptions() {
        const select = document.getElementById('budget-category');
        if (!select) return;
        if (typeof categories !== 'undefined') {
            select.innerHTML = categories
                .filter(cat => cat !== 'Sem Categoria') 
                .map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
    }

    function save() {
        const idField = document.getElementById('budget-id');
        const isUpdate = !!idField.value;
        const cat = document.getElementById('budget-category').value;
        const amt = parseFloat(document.getElementById('budget-amount').value);
        const type = document.getElementById('budget-recurrence').value;
        const picker = document.getElementById('budget-month-picker');

        if (isNaN(amt) || amt <= 0) {
            alert('Por favor, informe um valor válido para o orçamento.');
            return;
        }

        let currentMonth = new Date().getMonth() + 1;
        let currentYear = new Date().getFullYear();
        if (picker && picker.value) {
            [currentYear, currentMonth] = picker.value.split('-');
        }
        
        const targetMonth = type === 'unico'
            ? `${currentYear}-${String(currentMonth).padStart(2, '0')}`
            : null;

        let itemToSync;

        if (idField.value) {
            const idx = budgetLimits.findIndex(b => b.id === idField.value);
            if (idx > -1) {
                budgetLimits[idx] = { ...budgetLimits[idx], category: cat, amount: amt, type, targetMonth };
                itemToSync = budgetLimits[idx];
            }
            idField.value = '';
            const btnSave = document.getElementById('btn-save-budget');
            if (btnSave) btnSave.innerText = 'Definir Orçamento';
        } else {
            const newBudget = { id: Date.now().toString(), category: cat, amount: amt, type, targetMonth };
            budgetLimits.push(newBudget);
            itemToSync = newBudget;
        }

        localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));

        if (typeof FirebaseModule !== 'undefined' && itemToSync) {
            FirebaseModule.syncData('budgets', itemToSync);
        }

        document.getElementById('budget-form').reset();
        render();
        
        if (typeof showToast === 'function') {
            showToast(isUpdate ? 'Orçamento atualizado!' : 'Novo orçamento definido!');
        }
    }

    function edit(id) {
        const b = budgetLimits.find(x => x.id === id);
        if (!b) return;
        document.getElementById('budget-id').value = b.id;
        document.getElementById('budget-category').value = b.category;
        document.getElementById('budget-amount').value = b.amount;
        document.getElementById('budget-recurrence').value = b.type;
        
        const btnSave = document.getElementById('btn-save-budget');
        if (btnSave) btnSave.innerText = 'Atualizar Orçamento';
        
        const collapsible = document.querySelector('.collapsible-card');
        if (collapsible) collapsible.setAttribute('open', 'true');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function remove(id) {
        if (confirm('Deseja excluir este orçamento?')) {
            budgetLimits = budgetLimits.filter(x => x.id !== id);
            localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));

            if (typeof FirebaseModule !== 'undefined') {
                FirebaseModule.deleteData('budgets', id);
            }

            render();
            if (typeof showToast === 'function') showToast('Orçamento excluído com sucesso!');
        }
    }

    function render() {
        const container = document.getElementById('budget-container');
        const picker = document.getElementById('budget-month-picker');

        let currentMonth = new Date().getMonth();
        let currentYear = new Date().getFullYear();

        if (picker && picker.value) {
            const [y, m] = picker.value.split('-');
            currentMonth = parseInt(m) - 1;
            currentYear = parseInt(y);
        } else if (picker) {
            picker.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        }

        const monthCard = document.getElementById('budget-current-month');
        if (monthCard) {
            const dateObj = new Date(currentYear, currentMonth, 1);
            const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
            monthCard.innerText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${currentYear}`;
        }

        const monthlyExpenses = typeof window.getMonthExpenses === 'function' 
            ? window.getMonthExpenses(currentMonth, currentYear) 
            : {};

        const activeMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const activeBudgets = budgetLimits.filter(b =>
            (b.type === 'mensal' || b.targetMonth === activeMonthStr) &&
            b.amount != null && !isNaN(b.amount)
        );

        const currentPinned = JSON.parse(localStorage.getItem('fin_pinned_budgets')) || [];

        if (container) {
            container.innerHTML = activeBudgets.length > 0
                ? _renderGroupedBudgets(activeBudgets, monthlyExpenses, currentPinned)
                : '<p class="text-light" style="text-align:center;">Nenhum orçamento definido para este mês.</p>';
        }

        const totalCard = document.getElementById('budget-total-card');
        if (totalCard) {
            if (activeBudgets.length === 0) {
                totalCard.classList.add('hidden');
            } else {
                const totalSpent = activeBudgets.reduce((acc, b) => acc + (monthlyExpenses[b.category] || 0), 0);
                const totalBudgeted = activeBudgets.reduce((acc, b) => acc + b.amount, 0);
                
                const totalPercent = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0;
                const totalStatus = totalPercent > 90 ? 'status-danger' : (totalPercent > 70 ? 'status-warning' : 'status-ok');

                const totalValuesEl = document.getElementById('budget-total-values');
                const totalBarEl = document.getElementById('budget-total-bar');
                const totalFooterEl = document.getElementById('budget-total-footer');

                if (totalValuesEl) {
                    totalValuesEl.textContent = `R$ ${totalSpent.toFixed(2)} / R$ ${totalBudgeted.toFixed(2)}`;
                }
                if (totalBarEl) {
                    totalBarEl.style.width = `${totalPercent}%`;
                    totalBarEl.className = `progress-fill ${totalStatus}`;
                }
                if (totalFooterEl) {
                    totalFooterEl.textContent = `${totalPercent.toFixed(1)}% do orçamento total utilizado`;
                }

                totalCard.classList.remove('hidden');
            }
        }
    }

    function loadFromStorage() {
        const rawBudgets = JSON.parse(localStorage.getItem('fin_budgets'));
        if (Array.isArray(rawBudgets)) {
            const corrompidos = rawBudgets.filter(b => b.amount == null || isNaN(b.amount));
            budgetLimits = rawBudgets.filter(b => b.amount != null && !isNaN(b.amount));
            if (corrompidos.length > 0) {
                console.warn(`[Budget] ${corrompidos.length} orçamento(s) corrompido(s) removidos.`);
                localStorage.setItem('fin_budgets', JSON.stringify(budgetLimits));
                corrompidos.forEach(b => {
                    if (typeof FirebaseModule !== 'undefined') FirebaseModule.deleteData('budgets', b.id);
                });
            }
        } else {
            budgetLimits = [];
        }
        render();
    }

    function togglePin(category) {
        let currentPinned = JSON.parse(localStorage.getItem('fin_pinned_budgets')) || [];
        
        if (currentPinned.includes(category)) {
            currentPinned = currentPinned.filter(c => c !== category);
        } else {
            currentPinned.push(category);
        }
        
        localStorage.setItem('fin_pinned_budgets', JSON.stringify(currentPinned));
        
        if (typeof pinnedBudgets !== 'undefined') {
            pinnedBudgets.length = 0;
            currentPinned.forEach(c => pinnedBudgets.push(c));
        }
        
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('preferences', { id: 'pinned', categories: currentPinned });
        }

        const isNowPinned = currentPinned.includes(category);
        if (typeof showToast === 'function') {
            showToast(isNowPinned ? `${category} fixado no painel!` : `${category} removido do painel!`);
        }
        
        render(); 
    }

    return { init, render, edit, remove, updateCategoryOptions, loadFromStorage, togglePin, toggleBudgetGroup, showGroupSummary };
})();
