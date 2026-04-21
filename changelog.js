// === NOVO ARQUIVO: changelog.js ===
const changelogData = [
    { version: "1.0.1", date: "2026-04-21", changes: ["Separação de formulário e extrato", "Adição de saldo contínuo na tabela", "Substituição de botões por ícones SVG"] },
    { version: "1.0.0", date: "2026-04-10", changes: ["Lançamento inicial", "Arquitetura modular básica"] }
];

function initChangelog() {
    const latestVersion = changelogData[0].version;
    document.getElementById('app-version').innerText = latestVersion;
    
    const badge = document.getElementById('version-card');
    badge.style.pointerEvents = 'auto'; // Permite o clique
    badge.style.cursor = 'pointer';
    
    badge.addEventListener('click', () => {
        const content = document.getElementById('changelog-content');
        content.innerHTML = changelogData.map(log => `
            <div style="margin-bottom: 1rem;">
                <h4 style="color: var(--primary);">v${log.version} <small style="color: var(--text-light); font-size: 0.8em;">(${log.date})</small></h4>
                <ul style="margin-left: 1.5rem; font-size: 0.9rem;">
                    ${log.changes.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>
        `).join('');
        document.getElementById('changelog-modal').showModal();
    });
}
// Chame initChangelog() dentro da função init() do script.js principal.


// === MODIFICAÇÕES NO: script.js ===

// 1. Nova Função de Roteamento
window.showView = function(targetView) {
    dashboardView.classList.add('hidden');
    managementView.classList.remove('hidden');
    
    const formView = document.getElementById('view-form');
    const extractView = document.getElementById('view-extract');
    
    // Oculta o grid-layout padrão para telas exclusivas
    document.querySelector('#management-view .grid-layout').style.gridTemplateColumns = '1fr';
    
    if (targetView === 'form') {
        formView.classList.remove('hidden');
        extractView.classList.add('hidden');
    } else if (targetView === 'extract') {
        formView.classList.add('hidden');
        extractView.classList.remove('hidden');
    }
};

// 2. Cálculo de Saldo Contínuo e Ícones SVG
function renderTransactions() {
    list.innerHTML = '';
    
    // Ordena cronologicamente (antigo -> novo) para calcular o saldo exato
    let chronological = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let currentBalance = 0;
    
    const transactionsWithBalance = chronological.map(trans => {
        currentBalance += (trans.type === 'receita' ? trans.amount : -trans.amount);
        return { ...trans, saldo: currentBalance };
    });

    // Reverte (novo -> antigo) para exibir no topo as mais recentes
    const sortedForDisplay = transactionsWithBalance.sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedForDisplay.forEach(trans => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(trans.date + 'T00:00:00').toLocaleDateString('pt-BR');
        const formattedAmount = trans.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formattedSaldo = trans.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const cssClass = trans.type === 'receita' ? 'receita' : 'despesa';
        const saldoClass = trans.saldo < 0 ? 'despesa' : ''; // Destaca saldo negativo

        // SVGs para ações
        const iconEdit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        const iconDelete = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>${trans.desc}${trans.isRecurring ? ' 🔄' : ''}</td>
            <td>${trans.category}</td>
            <td class="${cssClass}">${trans.type.charAt(0).toUpperCase() + trans.type.slice(1)}</td>
            <td class="${cssClass}">${formattedAmount}</td>
            <td class="${saldoClass} font-weight-bold">${formattedSaldo}</td>
            <td class="actions">
                <button title="Editar Lançamento" onclick="editTransaction('${trans.id}')">${iconEdit}</button>
                <button class="delete" title="Excluir Lançamento" onclick="deleteTransaction('${trans.id}')">${iconDelete}</button>
            </td>
        `;
        list.appendChild(tr);
    });
}
