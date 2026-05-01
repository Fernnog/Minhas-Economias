// === ARQUIVO: firebase-service.js ===
const firebaseConfig = {
  apiKey: "AIzaSyB-Mf1-G1dgIjmgFHDqDr1irGqTmFK8BxI",
  authDomain: "minhas-economias-46029.firebaseapp.com",
  projectId: "minhas-economias-46029",
  storageBucket: "minhas-economias-46029.firebasestorage.app",
  messagingSenderId: "427744923145",
  appId: "1:427744923145:web:adc2223e03d52abecd32d8",
  measurementId: "G-LQKFN76JCN"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ATIVAÇÃO DA PERSISTÊNCIA OFFLINE NATIVA
db.enablePersistence({ synchronizeTabs: true })
  .catch(function(err) {
      if (err.code == 'failed-precondition') {
          console.warn('[Firebase] Múltiplas abas abertas, persistência ativada apenas na primeira.');
      } else if (err.code == 'unimplemented') {
          console.warn('[Firebase] O navegador atual não suporta persistência offline.');
      }
  });

const FirebaseModule = (function() {
    function init() {
        const toggleBtn = document.getElementById('btn-login-toggle');
        const panel = document.getElementById('login-panel');
        const form = document.getElementById('login-form');
        const feedbackMsg = document.getElementById('auth-feedback');

        // --- MONITORAMENTO DE ESTADO ---
        auth.onAuthStateChanged((user) => {
            const formEl = document.getElementById('login-form');
            const loggedInView = document.getElementById('logged-in-view');
            const emailDisplay = document.getElementById('user-email-display');

            if (user) {
                console.log('🟢 [Firebase] Status: Conectado como', user.email);
                fetchUserData(); 
                if (toggleBtn) {
                    toggleBtn.style.color = 'var(--primary)';
                    toggleBtn.title = "Minha Conta";
                }
                if (formEl) formEl.classList.add('hidden');
                if (loggedInView) loggedInView.classList.remove('hidden');
                if (emailDisplay) emailDisplay.textContent = user.email;
            } else {
                console.log('⚪ [Firebase] Status: Desconectado.');
                if (toggleBtn) {
                    toggleBtn.style.color = 'currentColor';
                    toggleBtn.title = "Acessar Conta";
                }
                if (formEl) formEl.classList.remove('hidden');
                if (loggedInView) loggedInView.classList.add('hidden');
            }
        });

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => panel.classList.toggle('hidden'));
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('auth-email').value;
                const pass = document.getElementById('auth-password').value;
                
                console.log('⏳ [Firebase] Tentando logar com o email:', email);
                
                if (feedbackMsg) {
                    feedbackMsg.style.display = 'block';
                    feedbackMsg.style.color = 'var(--text-light)';
                    feedbackMsg.textContent = 'Autenticando...';
                }

                auth.signInWithEmailAndPassword(email, pass)
                    .then((userCredential) => {
                        console.log('✅ [Firebase] Sucesso! ID do usuário:', userCredential.user.uid);
                        
                        if (feedbackMsg) {
                            feedbackMsg.style.color = 'var(--primary)';
                            feedbackMsg.textContent = 'Conectado com sucesso!';
                        }

                        setTimeout(() => {
                            panel.classList.add('hidden');
                            if (feedbackMsg) feedbackMsg.style.display = 'none';
                        }, 1500);

                        form.reset();
                        if (typeof updateAllViews === 'function') updateAllViews();
                    })
                    .catch(err => {
                        console.error('❌ [Firebase] Erro de Autenticação. Código:', err.code, ' | Detalhe:', err.message);
                        
                        if (feedbackMsg) {
                            feedbackMsg.style.color = 'var(--danger)';
                            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                                feedbackMsg.textContent = 'E-mail ou senha incorretos.';
                            } else {
                                feedbackMsg.textContent = 'Erro na conexão. Veja o console.';
                            }
                        }
                    });
            });
        }
        
        // --- LOGOUT ---
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                auth.signOut().then(() => {
                    if (panel) panel.classList.add('hidden');
                });
            });
        }
    }

    async function syncData(collectionName, dataObj) {
        if (!auth.currentUser) {
            console.warn(`Usuário não autenticado. ${collectionName} salvo apenas localmente.`);
            return;
        }
        try {
            await db.collection('users').doc(auth.currentUser.uid).collection(collectionName).doc(dataObj.id).set(dataObj);
            console.log(`${collectionName} sincronizado com a nuvem.`);
        } catch (error) {
            console.error(`Erro ao sincronizar ${collectionName}:`, error);
        }
    }

    async function deleteData(collectionName, id) {
        if (!auth.currentUser) return;
        try {
            await db.collection('users').doc(auth.currentUser.uid).collection(collectionName).doc(id).delete();
            console.log(`${id} removido da nuvem.`);
        } catch (error) {
            console.error(`Erro ao deletar em ${collectionName}:`, error);
        }
    }

    async function fetchUserData() {
        if (!auth.currentUser) return;
        const uid = auth.currentUser.uid;
        try {
            // A) Sincronizar Transações
            const transRef = await db.collection('users').doc(uid).collection('transactions').get();
            if(!transRef.empty) {
                transactions = transRef.docs.map(doc => doc.data());
                localStorage.setItem('fin_transactions', JSON.stringify(transactions));
            }

            // B) Sincronizar Categorias (via CategoryManager para notificar todos os módulos)
            const catRef = await db.collection('users').doc(uid).collection('categories').get();
            if(!catRef.empty) {
                const cloudCategories = [];
                const catDocs = []; // Armazena os objetos completos com parentId

                catRef.docs.forEach(doc => {
                    const data = doc.data();
                    cloudCategories.push(data.name);
                    catDocs.push(data);
                });

                // 1. Salva a lista plana padrão
                localStorage.setItem('fin_categories', JSON.stringify(cloudCategories));

                // 2. Reconstrói os vínculos de grupo (fin_category_groups) com base na nuvem
                if (typeof CategoryGroups !== 'undefined') {
                    // Carrega a estrutura base limpa
                    const baseGroups = CategoryGroups.getFixedParents().map(p => ({ ...p, isFixed: true, subcategories: [] }));

                    catDocs.forEach(catData => {
                        if (catData.parentId) {
                            const targetGroup = baseGroups.find(g => g.id === catData.parentId);
                            if (targetGroup && !targetGroup.subcategories.includes(catData.name)) {
                                targetGroup.subcategories.push(catData.name);
                            }
                        }
                    });
                    
                    // Persiste a árvore reconstruída no localStorage
                    localStorage.setItem('fin_category_groups', JSON.stringify(baseGroups));
                }

                // CategoryManager reinicia com os dados da nuvem processados
                if (typeof CategoryManager !== 'undefined') {
                    CategoryManager.init();
                }
            }

            // C) Sincronizar Orçamentos
            const budgetRef = await db.collection('users').doc(uid).collection('budgets').get();
            if(!budgetRef.empty) {
                const budgetData = budgetRef.docs.map(doc => doc.data());
                localStorage.setItem('fin_budgets', JSON.stringify(budgetData));
                if (typeof BudgetModule !== 'undefined') BudgetModule.loadFromStorage();
            }

            // D) Sincronizar Preferências (Pinned Budgets)
            const prefRef = await db.collection('users').doc(uid).collection('preferences').doc('pinned').get();
            if (prefRef.exists) {
                const data = prefRef.data();
                localStorage.setItem('fin_pinned_budgets', JSON.stringify(data.categories));
                if (typeof pinnedBudgets !== 'undefined') {
                    pinnedBudgets = data.categories;
                }
            }

            // D.2) Sincronizar Preferências (Imprevistos Alerts)
            const imprevAlertsRef = await db.collection('users').doc(uid).collection('preferences').doc('imprev_alerts').get();
            if (imprevAlertsRef.exists) {
                const data = imprevAlertsRef.data();
                localStorage.setItem('fin_imprev_alerts', JSON.stringify(data.history || {}));
            }

            // E) Atualizar a Interface
            if (typeof updateCategorySelect === 'function') updateCategorySelect();
            if (typeof BudgetModule !== 'undefined') BudgetModule.updateCategoryOptions();
            if (typeof updateAllViews === 'function') updateAllViews();

            console.log('🔄 [Firebase] Sincronização de entrada (Download) concluída!');
        } catch (error) {
            console.error('❌ Erro ao buscar dados da nuvem:', error);
        }
    }

    return { init, syncData, deleteData, fetchUserData };
})();

document.addEventListener('DOMContentLoaded', () => FirebaseModule.init());
