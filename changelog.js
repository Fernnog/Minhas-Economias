// === ARQUIVO: changelog.js ===
const changelogData = [
    { 
        version: "1.0.3", 
        date: "2026-04-21", 
        changes: [
            "Atualização para Versão 1.0.3 (Correções Visuais, Orçamentos e Lógica de Recorrência)",
            "Restauração visual das barras de progresso coloridas na área de orçamentos",
            "Adição de card dinâmico para exibição do mês na aba de orçamentos",
            "Projeção automática de contas recorrentes para visualizações de meses futuros no extrato",
            "Restauração de ícones em SVG puro (calendário, editar, excluir)"
        ] 
    },
    { 
        version: "1.0.2", 
        date: "2026-04-21", 
        changes: [
            "Implementação do esqueleto modular de Orçamentos (BudgetModule)", 
            "Preparação da arquitetura de dados para futura integração com Firebase", 
            "Correção de responsividade da tabela de extrato para dispositivos móveis (formato card)"
        ] 
    },
    { 
        version: "1.0.1", 
        date: "2026-04-21", 
        changes: [
            "Separação de formulário e extrato", 
            "Adição de saldo contínuo na tabela", 
            "Substituição de botões por ícones SVG"
        ] 
    },
    { 
        version: "1.0.0", 
        date: "2026-04-10", 
        changes: [
            "Lançamento inicial", 
            "Arquitetura modular básica"
        ] 
    }
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
