const ExtractModule = (function() {
    const list = document.getElementById('transaction-list');
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    function init() {
        const picker = document.getElementById('extract-month-picker');
        picker.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        picker.addEventListener('change', (e) => {
            const [y, m] = e.target.value.split('-');
            currentMonth = parseInt(m) - 1;
            currentYear = parseInt(y);
            render();
        });
    }

    function render() {
        if (!list) return;
        list.innerHTML = '';
        
        const filtered = [];
        transactions.forEach(t => {
            const d = new Date(t.date + 'T00:00:00');
            const tMonth = d.getMonth();
            const tYear = d.getFullYear();
            
            if (tMonth === currentMonth && tYear === currentYear) {
                filtered.push(t);
            } 
            else if (t.isRecurring && (tYear < currentYear || (tYear === currentYear && tMonth < currentMonth))) {
                const projDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                // Verificação de interrupção: Se existir data de término e o mês visualizado for posterior ou igual a ela, não projeta
                if (t.recurrenceEndDate && new Date(currentYear, currentMonth, 1) >= new Date(t.recurrenceEndDate)) {
                    return;
                }

                // Verificação de exceção: Não projeta se houver uma exceção registrada para esta data específica
                if (t.skippedDates && t.skippedDates.includes(projDateStr)) {
                    return;
                }

                filtered.push({
                    ...t,
                    id: t.id + '_proj', 
                    date: projDateStr
                });
            }
        });

        let balance = transactions.reduce((acc, t) => {
            if (new Date(t.date + 'T00:00:00') < new Date(currentYear, currentMonth, 1)) {
                return acc + (t.type === 'receita' ? t.amount : -t.amount);
            }
            return acc;
        }, 0);

        const groups = [...filtered].sort((a,b) => new Date(a.date) - new Date(b.date)).reduce((acc, t) => {
            if (!acc[t.date]) acc[t.date] = { items: [], dayBalance: 0 };
            balance += (t.type === 'receita' ? t.amount : -t.amount);
            acc[t.date].items.push(t);
            acc[t.date].dayBalance = balance;
            return acc;
        }, {});

        Object.keys(groups).sort((a,b) => new Date(b) - new Date(a)).forEach(date => {
            const group = groups[date];
            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
            
            list.innerHTML += `<tr class="day-group-header"><td colspan="3">${dateLabel}</td></tr>`;
            
            group.items.forEach(t => {
                const isVirtual = t.id.includes('_proj');
                list.innerHTML += `
                    <tr class="extract-row">
                        <td><div class="extract-info"><strong>${t.desc} ${isVirtual ? '<small>(Recorrente)</small>' : ''}</strong><br><small>${t.category}</small></div></td>
                        <td class="${t.type}">${t.amount.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
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
                    <td colspan="3">Saldo do dia: <span class="${group.dayBalance < 0 ? 'despesa' : ''}">${group.dayBalance.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span></td>
                </tr>`;
        });
    }

    return { init, render };
})();
