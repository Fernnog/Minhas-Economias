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

const FirebaseModule = (function() {
    function init() {
        const toggleBtn = document.getElementById('btn-login-toggle');
        const panel = document.getElementById('login-panel');
        const form = document.getElementById('login-form');
        const feedbackMsg = document.getElementById('auth-feedback');

        // --- MONITORAMENTO DE ESTADO ---
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('🟢 [Firebase] Status: Conectado como', user.email);
                fetchUserData(); 
                if (toggleBtn) {
                    toggleBtn.style.color = 'var(--primary)';
                    toggleBtn.title = "Conta Conectada (" + user.email + ")";
                }
            } else {
                console.log('⚪ [Firebase] Status: Desconectado.');
                if (toggleBtn) {
                    toggleBtn.style.color = 'currentColor';
                    toggleBtn.title = "Acessar Conta";
                }
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

            // B) Sincronizar Categorias
            const catRef = await db.collection('users').doc(uid).collection('categories').get();
            if(!catRef.empty) {
                categories = catRef.docs.map(doc => doc.data().name);
                localStorage.setItem('fin_categories', JSON.stringify(categories));
            }

            // C) Sincronizar Orçamentos
            const budgetRef = await db.collection('users').doc(uid).collection('budgets').get();
            if(!budgetRef.empty) {
                const budgetData = budgetRef.docs.map(doc => doc.data());
                localStorage.setItem('fin_budgets', JSON.stringify(budgetData));
                if (typeof BudgetModule !== 'undefined') BudgetModule.loadFromStorage();
            }

            // D) Atualizar a Interface do Usuário com os dados baixados
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
