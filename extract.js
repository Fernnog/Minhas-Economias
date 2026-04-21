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
        
        // 1. Filtragem e Projeção de Recorrentes
        const filtered = [];
        transactions.forEach(t => {
            const d = new Date(t.date + 'T00:00:00');
            const tMonth = d.getMonth();
            const tYear = d.getFullYear();
            
            // É do mês atual?
            if (tMonth === currentMonth && tYear === currentYear) {
                filtered.push(t);
            } 
            // É recorrente e de um mês passado? Projeta para a visualização atual
            else if (t.isRecurring && (tYear < currentYear || (tYear === currentYear && tMonth < currentMonth))) {
                filtered.push({
                    ...t,
                    id: t.id + '_proj', // ID virtual 
                    date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                });
            }
        });

        let balance = transactions.reduce((acc, t) => {
            if (new Date(t.date + 'T00:00:00') < new Date(currentYear, currentMonth, 1)) {
                return acc + (t.type === 'receita' ? t.amount : -t.amount);
            }
            return acc;
        }, 0);

        // 2. Agrupamento Diário
        const groups = [...filtered].sort((a,b) => new Date(a.date) - new Date(b.date)).reduce((acc, t) => {
            if (!acc[t.date]) acc[t.date] = { items: [], dayBalance: 0 };
            balance += (t.type === 'receita' ? t.amount : -t.amount);
            acc[t.date].items.push(t);
            acc[t.date].dayBalance = balance;
            return acc;
        }, {});

        // 3. Renderização (Mais recentes primeiro)
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
                            ` : '<span style="font-size:0.8rem; color:var(--text-light);">Automático</span>'}
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
