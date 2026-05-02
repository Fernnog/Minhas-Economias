const ExtractModule = (function() {
    const list = document.getElementById('transaction-list');
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    // === ESTADO: CONFERÊNCIA & FILTRO ===
    // 0 = todos | 1 = somente conferidos | 2 = somente pendentes
    let filterMode = 0;
    let confirmedItems = JSON.parse(localStorage.getItem('fin_confirmed_items') || '{}');

    function _saveConfirmed() {
        localStorage.setItem('fin_confirmed_items', JSON.stringify(confirmedItems));
    }

    function _confirmKey(id, date) {
        return `${id}|${date}`;
    }

    // Exposta globalmente para uso inline nos elementos renderizados
    window.toggleConfirmed = function(id, date) {
        const key = _confirmKey(id, date);
        if (confirmedItems[key]) {
            delete confirmedItems[key];
        } else {
            confirmedItems[key] = true;
        }
        _saveConfirmed();

        // NOVO: Espelha o dicionário atualizado na nuvem
        if (typeof FirebaseModule !== 'undefined') {
            FirebaseModule.syncData('preferences', { id: 'confirmed_items', items: confirmedItems });
        }

        render();
    };

    // Cicla entre os 3 modos de filtro e atualiza o visual do botão
    window.cycleExtractFilter = function() {
        filterMode = (filterMode + 1) % 3;

        const messages = [
            '📋 Exibindo todos os lançamentos',
            '✓ Exibindo apenas conferidos',
            '⏳ Exibindo apenas pendentes de conferência'
        ];
        showToast(messages[filterMode]);

        const btn = document.getElementById('btn-filter-extract');
        if (btn) {
            btn.dataset.filterMode = filterMode;
        }

        render();
    };

    function init() {
        const picker = document.getElementById('extract-month-picker');
        if (picker) {
            picker.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
            picker.addEventListener('change', (e) => {
                const [y, m] = e.target.value.split('-');
                currentMonth = parseInt(m) - 1;
                currentYear = parseInt(y);
                render();
            });
        }
    }

    /**
     * Helper para renderizar o chip no extrato usando a config central
     */
    function _renderExtractChip(method) {
        if (!method || !PAYMENT_CONFIG[method]) return '';
        const c = PAYMENT_CONFIG[method];
        if (c.clsExtract === '') return '';
        return `<span class="payment-chip ${c.clsExtract}" title="${c.title}">${c.svg}</span>`;
    }

    // SVG de check leve usado dentro do nome quando conferido
    const _checkSvg = `<svg class="confirm-check-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    function render() {
        if (!list) return;
        list.innerHTML = '';

        // --- Monta lista base do mês ---
        const allMonth = [];
        transactions.forEach(t => {
            const d = new Date(t.date + 'T00:00:00');
            const tMonth = d.getMonth();
            const tYear = d.getFullYear();

            if (tMonth === currentMonth && tYear === currentYear) {
                allMonth.push(t);
            } else if (t.isRecurring && (tYear < currentYear || (tYear === currentYear && tMonth < currentMonth))) {
                const projDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (t.recurrenceEndDate && new Date(currentYear, currentMonth, 1) >= new Date(t.recurrenceEndDate)) return;
                if (t.skippedDates && t.skippedDates.includes(projDateStr)) return;
                allMonth.push({ ...t, id: t.id + '_proj', date: projDateStr });
            }
        });

        // --- Aplica filtro de conferência ---
        const filtered = filterMode === 0
            ? allMonth
            : allMonth.filter(t => {
                const isConf = !!confirmedItems[_confirmKey(t.id, t.date)];
                return filterMode === 1 ? isConf : !isConf;
            });

        // --- Saldo acumulado até o início do mês ---
        let balance = transactions.reduce((acc, t) => {
            if (new Date(t.date + 'T00:00:00') < new Date(currentYear, currentMonth, 1)) {
                return acc + (t.type === 'receita' ? t.amount : -t.amount);
            }
            return acc;
        }, 0);

        // --- Agrupa por data ---
        const groups = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date)).reduce((acc, t) => {
            if (!acc[t.date]) acc[t.date] = { items: [], dayBalance: 0 };
            balance += (t.type === 'receita' ? t.amount : -t.amount);
            acc[t.date].items.push(t);
            acc[t.date].dayBalance = balance;
            return acc;
        }, {});

        if (Object.keys(groups).length === 0) {
            list.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--text-light);font-size:0.9rem;">Nenhum lançamento para exibir.</td></tr>`;
            return;
        }

        Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            const group = groups[date];
            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();

            list.innerHTML += `<tr class="day-group-header"><td colspan="3">${dateLabel}</td></tr>`;

            group.items.forEach(t => {
                const isVirtual = t.id.includes('_proj');
                const isConf = !!confirmedItems[_confirmKey(t.id, t.date)];
                const confClass = isConf ? 'confirmed' : '';
                const confTitle = isConf ? 'Clique para desmarcar como conferido' : 'Clique para marcar como conferido';

                list.innerHTML += `
                    <tr class="extract-row ${confClass}">
                        <td>
                            <div class="extract-info">
                                <div class="extract-info-header">
                                    ${_renderExtractChip(t.paymentMethod)}
                                    <strong>
                                        <span class="extract-name ${confClass}"
                                              onclick="toggleConfirmed('${t.id}', '${t.date}')"
                                              title="${confTitle}">
                                            ${isConf ? _checkSvg : ''}${t.desc}
                                        </span>
                                        ${isVirtual ? '<small>(Recorrente)</small>' : ''}
                                    </strong>
                                </div>
                                <small>${t.category}</small>
                            </div>
                        </td>
                        <td class="${t.type}">${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td class="actions">
                            ${!isVirtual ? `
                            <button onclick="editTransaction('${t.id}')" title="Editar">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button onclick="deleteTransaction('${t.id}')" title="Excluir">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                            ` : `
                            <button onclick="editSingleProjected('${t.id}', '${t.date}')" title="Editar apenas este mês">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button onclick="stopRecurrence('${t.id}', '${t.date}')" title="Parar Repetição a partir daqui" style="color: var(--danger);">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                            </button>
                            `}
                        </td>
                    </tr>`;
            });

            list.innerHTML += `
                <tr class="day-balance-row">
                    <td colspan="3">Saldo do dia: <span class="${group.dayBalance < 0 ? 'despesa' : ''}">${group.dayBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                </tr>`;
        });
    }

    function loadConfirmedFromCloud(cloudData) {
        if (cloudData) {
            confirmedItems = cloudData;
            _saveConfirmed(); // Garante que o localStorage local também fique atualizado
            render();
        }
    }

    return { init, render, loadConfirmedFromCloud };
})();
