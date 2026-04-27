/**
 * js/payment-config.js
 * Centralização de Configurações de Meios de Pagamento.
 * Atribuição explícita a window para garantir acesso global
 * via window.PAYMENT_CONFIG e window.PAYMENT_CYCLE de qualquer script.
 */

window.PAYMENT_CYCLE = ['', 'debito', 'cartao1', 'cartao2'];

window.PAYMENT_CONFIG = {
    '': {
        value: '',
        label: 'Sem método',
        title: 'Sem método',
        clsToggle:  'chip-state-blank',
        clsExtract: '',                   // Sem chip no extrato para lançamentos sem método
        color: 'var(--text-light)',
        svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" stroke-dasharray="3 3"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>`
    },
    'debito': {
        value: 'debito',
        label: 'Débito',
        title: 'Débito',
        clsToggle:  'chip-state-debito',
        clsExtract: 'chip-debito',
        color: '#2563EB',
        svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>`
    },
    'cartao1': {
        value: 'cartao1', // MANTIDO: Garante que os lançamentos antigos continuem funcionando
        label: 'Passaí',  // NOVO NOME DE EXIBIÇÃO
        title: 'Cartão Passaí',
        clsToggle:  'chip-state-cartao1',
        clsExtract: 'chip-cartao1',
        color: '#059669', // Verde (você pode alterar para a cor da marca se desejar)
        svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
                <line x1="6" y1="15" x2="9" y2="15"></line>
              </svg>`
    },
    'cartao2': {
        value: 'cartao2', // MANTIDO: Garante compatibilidade retroativa
        label: 'CEF',     // NOVO NOME DE EXIBIÇÃO
        title: 'Cartão CEF',
        clsToggle:  'chip-state-cartao2',
        clsExtract: 'chip-cartao2',
        color: '#7C3AED', // Roxo (você pode alterar para o azul da Caixa, ex: '#005CA9')
        svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
                <line x1="6" y1="15" x2="12" y2="15"></line>
              </svg>`
    }
};
