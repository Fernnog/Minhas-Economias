/**
 * js/payment-config.js
 * Centralização de Configurações de Meios de Pagamento
 * ⚠️ NÃO usar sintaxe "export" — este arquivo é carregado via <script src> padrão.
 * As variáveis são expostas globalmente para uso em script.js, extract.js e reports.js.
 */

// Ordem de rotação do chip cíclico no formulário
const PAYMENT_CYCLE = ['', 'debito', 'cartao1', 'cartao2'];

// Configuração central — propriedades alinhadas com script.js e extract.js
const PAYMENT_CONFIG = {
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
        value: 'cartao1',
        label: 'Cartão 1',
        title: 'Cartão 1',
        clsToggle:  'chip-state-cartao1',
        clsExtract: 'chip-cartao1',
        color: '#059669',
        svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
                <line x1="6" y1="15" x2="9" y2="15"></line>
              </svg>`
    },
    'cartao2': {
        value: 'cartao2',
        label: 'Cartão 2',
        title: 'Cartão 2',
        clsToggle:  'chip-state-cartao2',
        clsExtract: 'chip-cartao2',
        color: '#7C3AED',
        svg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
                <line x1="6" y1="15" x2="12" y2="15"></line>
              </svg>`
    }
};
