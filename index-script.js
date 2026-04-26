// ============= CONFIGURACIÓN API =============
const API_BASE = "https://gooseline.onrender.com/api";
let TOKEN = localStorage.getItem("gooseline_token");
let CURRENT_USER_GOOSE_ID = localStorage.getItem("gooseline_goose_id");
let WS = null;

// ============= ELEMENTOS DEL DOM =============
const mainContent = document.getElementById('main-content');
const mainHeader = document.getElementById('main-header');
const headerLogo = document.getElementById('header-logo');
const btnGooseWeb = document.getElementById('btn-goose-web');
const btnGetStarted = document.getElementById('btn-get-started');
const btnAbout = document.getElementById('btn-about');
const btnHelp = document.getElementById('btn-help');

// ============= ESTADO GLOBAL =============
let historyStack = ['landing'];
let currentUser = {
    username: '',
    gooseId: '',
    nickname: '',
    avatar: 'Gooseline-profile.png'
};

let contacts = [];
let activeChat = null;
let messages = {};

const botUser = {
    gooseId: 'GOOSE-2009-BOT',
    username: 'Goosebot',
    nickname: 'Goosebot',
    avatar: 'Gooseline-profile.png',
    isBot: true
};

const botResponses = {
    'hola': ['¡Honk! ¡Hola! ¿Cómo estás?', '¡Quack! ¿En qué puedo ayudarte?', '¡Hola! Soy Goosebot, tu amigo plumífero.'],
    'hello': ['Honk hello! How are you?', 'Quack! Nice to meet you!', 'Hello! I am Goosebot, your feathery friend.'],
    'adios': ['¡Honk! ¡Hasta luego!', '¡Quack! ¡Nos vemos!', '¡Adiós! ¡Vuela alto!'],
    'bye': ['Honk bye! Fly high!', 'Quack! See you later!', 'Goodbye! Don\'t forget to hydrate!'],
    'como estas': ['¡Honk! Estoy de maravilla, gracias.', '¡Quack! Muy bien, ¿y tú?', '¡Excelente! Listo para volar.'],
    'how are you': ['Honk! I am wonderful, thanks.', 'Quack! Very well, and you?', 'Excellent! Ready to fly.'],
    'que haces': ['¡Honk! Estoy esperando tu mensaje.', '¡Quack! Planeando mi próximo vuelo.', '¡Nada! Solo siendo un ganso.'],
    'what are you doing': ['Honk! Waiting for your message.', 'Quack! Planning my next flight.', 'Nothing! Just being a goose.'],
    'quien eres': ['¡Honk! Soy Goosebot, tu asistente ganso.', '¡Quack! Un ganso muy inteligente.', '¡Soy Goosebot! ¡Encantado de conocerte!'],
    'who are you': ['Honk! I am Goosebot, your goose assistant.', 'Quack! A very smart goose.', 'I am Goosebot! Nice to meet you!'],
    'gracias': ['¡Honk! De nada.', '¡Quack! Con gusto.', '¡Para eso estoy!'],
    'thanks': ['Honk! You\'re welcome.', 'Quack! My pleasure.', 'That\'s what I am here for!'],
    'bien': ['¡Honk! ¡Me alegra escuchar eso!', '¡Quack! ¡Excelente!', '¡Perfecto! ¡Sigamos volando!'],
    'good': ['Honk! Glad to hear that!', 'Quack! Excellent!', 'Perfect! Let\'s keep flying!'],
    'mal': ['¡Honk! ¡Oh no! ¿Qué pasó?', '¡Quack! ¡Espero que todo mejore!', '¡Ánimo! Todo pasará.'],
    'bad': ['Honk! Oh no! What happened?', 'Quack! I hope things get better!', 'Cheer up! Everything will pass.'],
    'help': ['¡Honk! ¿Necesitas ayuda? Aquí estoy.', '¡Quack! ¿En qué puedo asistirte?', '¡Dime! Estoy para ayudar.'],
    'ayuda': ['¡Honk! ¿Necesitas ayuda? Aquí estoy.', '¡Quack! ¿En qué puedo asistirte?', '¡Dime! Estoy para ayudar.'],
    'joke': ['Honk! Why did the goose cross the road? To get to the other pond!', 'Quack! What do you call a goose in the rain? A drizzling goose!', 'Honk! I am not funny, I am just goose-like.'],
    'chiste': ['¡Honk! ¿Por qué cruzó el ganso la calle? ¡Para llegar al otro estanque!', '¡Quack! ¿Cómo se llama un ganso bajo la lluvia? ¡Un ganso mojado!', '¡Honk! No soy gracioso, solo soy muy ganso.'],
    'default': ['¡Honk! No entiendo muy bien, pero sigo aquí.', '¡Quack! ¿Puedes repetir eso?', '¡Honk! Soy un ganso, no un genio.', 'Honk! I do not quite understand, but I am still here.', 'Quack! Can you repeat that?', 'Honk! I am a goose, not a genius.']
};

// ============= FUNCIONES UTILIDAD =============
function generateGooseId() {
    const numbers = Math.floor(1000 + Math.random() * 9000);
    const letters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                    String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                    String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `GOOSE-${numbers}-${letters}`;
}

function isValidGooseId(id) {
    const upperId = id.toUpperCase();
    const regex = /^GOOSE-\d{4}-[A-Z]{3}$/;
    return regex.test(upperId) && upperId.length === 14;
}

function formatGooseId(id) {
    return id.toUpperCase().substring(0, 14);
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getBotResponse(message) {
    const lowerMsg = message.toLowerCase().trim();
    for (const key in botResponses) {
        if (lowerMsg.includes(key)) {
            const responses = botResponses[key];
            return responses[Math.floor(Math.random() * responses.length)];
        }
    }
    const defaults = botResponses['default'];
    return defaults[Math.floor(Math.random() * defaults.length)];
}

// ============= FUNCIONES NOTIFICACIÓN (sin alerts) =============
function showNotification(message, type = 'error') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============= FUNCIONES API =============
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (TOKEN) {
        headers['Authorization'] = `Bearer ${TOKEN}`;
    }
    
    const options = {
        method,
        headers,
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        
        let data;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('Respuesta no JSON:', text);
            throw new Error(`Error del servidor: ${text || response.statusText}`);
        }
        
        if (!response.ok) {
            const errorMsg = data.detail || data.message || 'Error en la API';
            throw new Error(errorMsg);
        }
        
        return data;
    } catch (error) {
        console.error('Error en API:', error.message);
        throw error;
    }
}

async function registerUser(username, password, gooseId) {
    return apiCall('/register', 'POST', {
        username,
        password,
        goose_id: gooseId
    });
}

async function loginUser(username, password, gooseId) {
    const data = await apiCall('/login', 'POST', {
        username,
        password,
        goose_id: gooseId
    });
    
    if (data.access_token) {
        TOKEN = data.access_token;
        CURRENT_USER_GOOSE_ID = data.user.goose_id;
        localStorage.setItem('gooseline_token', TOKEN);
        localStorage.setItem('gooseline_goose_id', CURRENT_USER_GOOSE_ID);
        
        currentUser = {
            username: data.user.username,
            gooseId: data.user.goose_id,
            nickname: data.user.nickname,
            avatar: data.user.avatar || 'Gooseline-profile.png'
        };
    }
    
    return data;
}

async function fetchUserProfile() {
    const data = await apiCall(`/user/profile?token=${TOKEN}`, 'GET');
    return data;
}

async function fetchContacts() {
    const data = await apiCall(`/user/contacts?token=${TOKEN}`, 'GET');
    return data;
}

async function addContact(gooseId, nickname) {
    return apiCall(`/user/contacts/add?token=${TOKEN}`, 'POST', {
        goose_id: gooseId,
        nickname
    });
}

async function fetchMessages(contactGooseId) {
    const data = await apiCall(`/messages/${contactGooseId}?token=${TOKEN}`, 'GET');
    return data;
}

async function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_BASE}/user/profile/avatar?token=${TOKEN}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Error al subir avatar');
        }
        
        return data;
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

// ============= WEBSOCKET =============
function connectWebSocket() {
    if (!CURRENT_USER_GOOSE_ID) return;
    
    WS = new WebSocket(`wss://gooseline.onrender.com/ws/${CURRENT_USER_GOOSE_ID}`);
    
    WS.onopen = () => {
        console.log('✓ WebSocket conectado');
    };
    
    WS.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'message') {
            const chatId = msg.sender;
            
            if (!messages[chatId]) {
                messages[chatId] = [];
            }
            
            messages[chatId].push({
                text: msg.text,
                time: msg.time,
                isOwn: false
            });
            
            if (activeChat && activeChat.goose_id === chatId) {
                renderMessages();
            }
        }
    };
    
    WS.onerror = (error) => {
        console.error('❌ Error WebSocket:', error);
    };
    
    WS.onclose = () => {
        console.log('✗ WebSocket desconectado');
    };
}

// ============= RENDERIZADO PANTALLAS =============
function renderLanding() {
    historyStack = ['landing'];
    document.body.classList.add('landing-bg');
    document.body.style.backgroundColor = '';
    mainHeader.style.display = 'flex';
    mainContent.innerHTML = `
        <h1>Message with more privacy, and more geese.</h1>
        <p>Gooseline doesn't sting your data or your messages.</p>
        <div class="cta-buttons">
            <button class="btn-download">DOWNLOAD</button>
            <button class="btn-goose-web" id="btn-goose-web">GOOSE WEB</button>
        </div>
    `;
    document.getElementById('btn-goose-web').addEventListener('click', () => {
        historyStack.push('register');
        renderRegister();
    });
}

function renderAbout() {
    document.body.classList.remove('landing-bg');
    document.body.style.backgroundColor = '#FFFFFF';
    mainHeader.style.display = 'flex';
    mainContent.innerHTML = `
        <div class="info-page">
            <h1>What is Gooseline?</h1>
            <p>Gooseline is an instant messaging app that uses geese as a fun and familiar way to connect people. We believe privacy should not be boring, so we created a platform where your data stays yours, your messages stay encrypted, and your experience stays lighthearted. No tracking, no selling data, no nonsense. Just you, your friends, and a few friendly geese along the way.</p>
            <button class="btn-back" id="btn-back-about">
                <span class="material-symbols-outlined">arrow_back</span>
                BACK
            </button>
        </div>
    `;
    document.getElementById('btn-back-about').addEventListener('click', () => {
        document.body.style.backgroundColor = '';
        renderLanding();
    });
}

function renderHelp() {
    document.body.classList.remove('landing-bg');
    document.body.style.backgroundColor = '#FFFFFF';
    mainHeader.style.display = 'flex';
    mainContent.innerHTML = `
        <div class="info-page">
            <h1>Need help?</h1>
            <div class="help-cards">
                <div class="help-card">
                    <h3>Is Gooseline private?</h3>
                    <p>Yes. Gooseline uses end-to-end encryption for all messages. We cannot read your conversations, and we do not want to.</p>
                </div>
                <div class="help-card">
                    <h3>Do you sell my data?</h3>
                    <p>No. We do not collect, store, or sell any personal data. Your information belongs to you and only you.</p>
                </div>
                <div class="help-card">
                    <h3>Is it free?</h3>
                    <p>Yes. Gooseline is completely free to use. No hidden fees, no premium tiers, no ads.</p>
                </div>
                <div class="help-card">
                    <h3>Will it keep updating?</h3>
                    <p>Absolutely. We are constantly working on new features, better security, and more goose-themed fun.</p>
                </div>
                <div class="help-card">
                    <h3>Is it in beta?</h3>
                    <p>Yes. Gooseline is currently in early beta. Some features may change, but your privacy never will.</p>
                </div>
                <div class="help-card">
                    <h3>Who created it?</h3>
                    <p>Gooseline was created by Bautista Monachesi, an Argentine programmer who believes messaging should be private, fun, and goose-friendly.</p>
                </div>
            </div>
            <button class="btn-back" id="btn-back-help">
                <span class="material-symbols-outlined">arrow_back</span>
                BACK
            </button>
        </div>
    `;
    document.getElementById('btn-back-help').addEventListener('click', () => {
        document.body.style.backgroundColor = '';
        renderLanding();
    });
}

function renderRegister() {
    mainContent.innerHTML = `
        <div class="form-container">
            <img src="Gooseline-text-alt.png" alt="Gooseline">
            <p class="form-subtitle">Get started in Gooseline now</p>
            <div class="form-row">
                <div class="form-input"><input type="text" placeholder="Username" id="reg-username" autocomplete="off"></div>
                <div class="form-input"><input type="password" placeholder="Password" id="reg-password" autocomplete="new-password"></div>
            </div>
            <div class="goose-id-container">
                <input type="text" placeholder="Generate Goose-ID" readonly id="goose-id-input" autocomplete="off">
                <button class="btn-generate" id="btn-generate">
                    <span class="material-symbols-outlined">autorenew</span>
                </button>
            </div>
            <p class="goose-id-warning">Important: save your Goose-ID safe and remember it.</p>
            <p class="form-toggle">If you have an account <span class="click-here" id="to-login">Click here</span></p>
            <div class="form-actions">
                <button class="btn-back" id="btn-back">
                    <span class="material-symbols-outlined">arrow_back</span>
                    BACK
                </button>
                <button class="btn-continue" id="btn-continue-register">CONTINUE</button>
            </div>
        </div>
    `;

    document.getElementById('btn-generate').addEventListener('click', () => {
        document.getElementById('goose-id-input').value = generateGooseId();
    });

    document.getElementById('to-login').addEventListener('click', () => {
        historyStack.push('login');
        renderLogin();
    });

    document.getElementById('btn-back').addEventListener('click', goBack);

    document.getElementById('btn-continue-register').addEventListener('click', async () => {
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        const gooseId = document.getElementById('goose-id-input').value.trim();

        if (!username || !password || !gooseId) {
            showNotification('Por favor completa todos los campos', 'error');
            return;
        }

        if (!isValidGooseId(gooseId)) {
            showNotification('Goose-ID inválido. Genera uno nuevo.', 'error');
            return;
        }

        try {
            await registerUser(username, password, gooseId);
            showNotification('Registro exitoso. Ahora inicia sesión.', 'success');
            historyStack.push('login');
            renderLogin();
        } catch (error) {
            showNotification(`Error al registrar: ${error.message}`, 'error');
        }
    });
}

function renderLogin() {
    mainContent.innerHTML = `
        <div class="form-container">
            <img src="Gooseline-text-alt.png" alt="Gooseline">
            <p class="form-subtitle">Get started in Gooseline now</p>
            <div class="form-row">
                <div class="form-input"><input type="text" placeholder="Username" id="login-username" autocomplete="off"></div>
                <div class="form-input"><input type="password" placeholder="Password" id="login-password" autocomplete="current-password"></div>
            </div>
            <div class="form-input">
                <input type="text" placeholder="Your Goose-ID" id="login-goose-id" autocomplete="off">
            </div>
            <p class="form-toggle">If you aren't in Gooseline, <span class="click-here" id="to-register">Click here</span></p>
            <div class="form-actions">
                <button class="btn-back" id="btn-back">
                    <span class="material-symbols-outlined">arrow_back</span>
                    BACK
                </button>
                <button class="btn-continue" id="btn-continue-login">CONTINUE</button>
            </div>
        </div>
    `;

    document.getElementById('to-register').addEventListener('click', () => {
        historyStack.push('register');
        renderRegister();
    });

    document.getElementById('btn-back').addEventListener('click', goBack);

    document.getElementById('btn-continue-login').addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const gooseId = document.getElementById('login-goose-id').value.trim().toUpperCase();

        if (!username || !password || !gooseId) {
            showNotification('Por favor completa todos los campos', 'error');
            return;
        }

        try {
            await loginUser(username, password, gooseId);
            
            const contactsData = await fetchContacts();
            contacts = contactsData;
            
            connectWebSocket();
            
            renderChat();
        } catch (error) {
            showNotification(`Error al login: ${error.message}`, 'error');
        }
    });
}

function goBack() {
    if (historyStack.length > 1) {
        historyStack.pop();
        const previous = historyStack[historyStack.length - 1];
        if (previous === 'landing') {
            renderLanding();
        } else if (previous === 'register') {
            renderRegister();
        } else if (previous === 'login') {
            renderLogin();
        }
    }
}

async function renderContactsList(filterText = '') {
    const contactsList = document.getElementById('contacts-list');
    if (!contactsList) return;

    const filtered = contacts.filter(c => 
        c.nickname.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
        contactsList.innerHTML = '<p class="empty-lake">Lake is empty.</p>';
        return;
    }

    contactsList.innerHTML = filtered.map(contact => `
        <div class="contact-item" data-id="${contact.goose_id}">
            <img src="${contact.avatar || 'Gooseline-profile.png'}" alt="${contact.nickname}" class="contact-avatar">
            <span class="contact-name">${contact.nickname}</span>
            ${contact.isBot ? '<span class="contact-bot-tag">BOT</span>' : ''}
        </div>
    `).join('');

    document.querySelectorAll('.contact-item').forEach(item => {
        item.addEventListener('click', async () => {
            const gooseId = item.getAttribute('data-id');
            const contact = contacts.find(c => c.goose_id === gooseId);
            if (contact) {
                activeChat = contact;
                
                // Only load messages if not already loaded for this chat
                if (!messages[gooseId]) {
                    try {
                        const msgs = await fetchMessages(gooseId);
                        messages[gooseId] = msgs;
                        console.log(`✓ ${msgs.length} mensajes cargados para ${gooseId}`);
                    } catch (error) {
                        console.error('Error cargando mensajes:', error);
                        messages[gooseId] = [];
                    }
                } else {
                    console.log(`✓ Usando mensajes cacheados para ${gooseId}: ${messages[gooseId].length} mensajes`);
                }
                
                renderChat();
            }
        });
    });
}

async function renderMessages() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages || !activeChat) return;

    const chatId = activeChat.goose_id;
    
    // Always ensure messages are loaded for this chat
    if (!messages[chatId]) {
        console.log(`Cargando mensajes para ${chatId} desde servidor...`);
        try {
            const msgs = await fetchMessages(chatId);
            messages[chatId] = msgs;
            console.log(`✓ ${msgs.length} mensajes cargados para ${chatId}`);
        } catch (error) {
            console.error('Error cargando mensajes:', error);
            messages[chatId] = [];
        }
    } else {
        console.log(`Usando ${messages[chatId].length} mensajes cacheados para ${chatId}`);
    }

    const chatMessagesList = messages[chatId] || [];

    if (chatMessagesList.length === 0) {
        chatMessages.innerHTML = '<div class="empty-chat-messages">No messages yet. Start chatting!</div>';
        return;
    }

    chatMessages.innerHTML = chatMessagesList.map(msg => `
        <div class="message ${msg.isOwn ? 'message-own' : 'message-other'}">
            <span class="message-time">${msg.time}</span>
            <div style="margin-top: 16px;">${msg.text}</div>
        </div>
    `).join('');

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage(text) {
    if (!activeChat || !text.trim()) return;

    const chatId = activeChat.goose_id;
    if (!messages[chatId]) messages[chatId] = [];

    const messageData = {
        text: text.trim(),
        time: getCurrentTime(),
        isOwn: true
    };

    messages[chatId].push(messageData);
    console.log(`Mensaje agregado localmente para ${chatId}: ${text.trim()}`);
    
    renderMessages();

    // Send via WebSocket
    if (WS && WS.readyState === WebSocket.OPEN) {
        const wsData = {
            type: 'message',
            receiver_goose_id: chatId,
            text: text.trim()
        };
        WS.send(JSON.stringify(wsData));
        console.log(`Mensaje enviado via WebSocket a ${chatId}`);
    } else {
        console.error('WebSocket no está conectado');
    }

    if (activeChat.isBot) {
        setTimeout(() => {
            messages[chatId].push({
                text: getBotResponse(text),
                time: getCurrentTime(),
                isOwn: false
            });
            renderMessages();
        }, 1000);
    }
}

function renderChat() {
    document.body.classList.remove('landing-bg');
    document.body.style.backgroundColor = '#000000';
    mainHeader.style.display = 'none';
    document.body.style.overflow = 'hidden';
    
    const rightSidebarHtml = activeChat ? `
        <div class="sidebar-right">
            <div class="profile-view">
                <img src="${activeChat.avatar || 'Gooseline-profile.png'}" alt="${activeChat.nickname}" class="profile-avatar">
                <div class="profile-info">
                    <div class="profile-field">
                        <span class="profile-label">USERNAME:</span>
                        <span class="profile-value">${activeChat.nickname}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-label">GOOSE-ID:</span>
                        <span class="profile-value">${activeChat.goose_id}</span>
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    const chatAreaHtml = activeChat ? `
        <div class="chat-area has-bg">
            <div class="chat-header">
                <img src="${activeChat.avatar || 'Gooseline-profile.png'}" alt="${activeChat.nickname}" class="chat-header-avatar">
                <span class="chat-header-name">${activeChat.nickname}</span>
                ${activeChat.isBot ? '<span class="chat-header-bot-tag">BOT</span>' : ''}
            </div>
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-input-area">
                <div class="chat-input-wrapper">
                    <input type="text" placeholder="Write anything to that goose" id="chat-input" maxlength="60" autocomplete="off">
                    <button class="btn-send" id="btn-send">
                        <span class="material-symbols-outlined">send</span>
                    </button>
                </div>
            </div>
        </div>
    ` : `
        <div class="chat-area">
            <div class="chat-messages">
                <span class="empty-chat">Wing and fly with a friend now</span>
            </div>
        </div>
    `;

    mainContent.innerHTML = `
        <div class="chat-page">
            <div class="sidebar-icons">
                <button class="active" title="Chat" id="icon-chat">
                    <span class="material-symbols-outlined">chat</span>
                </button>
                <button title="Profile" id="icon-profile">
                    <span class="material-symbols-outlined">person</span>
                </button>
            </div>
            <div class="sidebar-main">
                <div class="sidebar-header" id="sidebar-header">
                    <img src="Gooseline-text-alt.png" alt="Gooseline">
                    <button id="btn-add-contact">
                        <span class="material-symbols-outlined">add</span>
                    </button>
                </div>
                <div class="sidebar-body" id="sidebar-body">
                    <div class="search-bar">
                        <input type="text" placeholder="Search Geese" id="search-input" autocomplete="off">
                        <span class="material-symbols-outlined search-icon">search</span>
                    </div>
                    <div class="filter-tabs">
                        <button class="active" id="tab-lake">Lake</button>
                    </div>
                    <div class="contacts-list" id="contacts-list"></div>
                </div>
            </div>
            ${chatAreaHtml}
            ${rightSidebarHtml}
        </div>
    `;

    renderContactsList();
    renderMessages();

    const sidebarBody = document.getElementById('sidebar-body');
    const sidebarHeader = document.getElementById('sidebar-header');
    const btnAddContact = document.getElementById('btn-add-contact');
    const iconChat = document.getElementById('icon-chat');
    const iconProfile = document.getElementById('icon-profile');
    const searchInput = document.getElementById('search-input');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderContactsList(e.target.value);
        });
    }

    iconChat.addEventListener('click', () => {
        iconChat.classList.add('active');
        iconProfile.classList.remove('active');
        renderChatMainContent();
    });

    iconProfile.addEventListener('click', () => {
        iconProfile.classList.add('active');
        iconChat.classList.remove('active');
        renderProfileView();
    });

    if (btnAddContact) {
        btnAddContact.addEventListener('click', () => {
            sidebarBody.innerHTML = `
                <div class="add-contact-form">
                    <input type="text" placeholder="Name" id="add-contact-name" autocomplete="off">
                    <input type="text" placeholder="Goose-ID" id="add-contact-id" maxlength="14" autocomplete="off">
                    <button class="btn-add-goose" id="btn-add-goose">Add Goose</button>
                    <p class="add-contact-hint">For our BOT, try: GOOSE-2009-BOT</p>
                    <p class="add-contact-message" id="add-contact-message"></p>
                </div>
                <button class="back-to-main" id="btn-back-main">
                    <span class="material-symbols-outlined">arrow_back</span>
                    BACK
                </button>
            `;

            const idInput = document.getElementById('add-contact-id');
            idInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });

            document.getElementById('btn-add-goose').addEventListener('click', async () => {
                const name = document.getElementById('add-contact-name').value.trim();
                let gooseId = document.getElementById('add-contact-id').value.trim().toUpperCase();
                gooseId = formatGooseId(gooseId);
                const messageEl = document.getElementById('add-contact-message');

                if (!isValidGooseId(gooseId)) {
                    messageEl.textContent = "Invalid Goose-ID format!";
                    messageEl.className = 'add-contact-message error';
                    return;
                }

                if (contacts.find(c => c.goose_id === gooseId)) {
                    messageEl.textContent = 'Goose is already in the lake!';
                    messageEl.className = 'add-contact-message error';
                    return;
                }

                try {
                    await addContact(gooseId, name || gooseId);
                    messageEl.textContent = 'Goose added!';
                    messageEl.className = 'add-contact-message success';
                    
                    const contactsData = await fetchContacts();
                    contacts = contactsData;
                    
                    setTimeout(() => renderChatMainContent(), 1500);
                } catch (error) {
                    messageEl.textContent = "Error al añadir Goose!";
                    messageEl.className = 'add-contact-message error';
                }
            });

            document.getElementById('btn-back-main').addEventListener('click', () => {
                renderChatMainContent();
            });
        });
    }

    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send');
    
    if (chatInput && btnSend) {
        btnSend.addEventListener('click', () => {
            sendMessage(chatInput.value);
            chatInput.value = '';
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage(chatInput.value);
                chatInput.value = '';
            }
        });
    }

    function renderChatMainContent() {
        sidebarHeader.innerHTML = `
            <img src="Gooseline-text-alt.png" alt="Gooseline">
            <button id="btn-add-contact">
                <span class="material-symbols-outlined">add</span>
            </button>
        `;
        
        sidebarBody.innerHTML = `
            <div class="search-bar">
                <input type="text" placeholder="Search Geese" id="search-input" autocomplete="off">
                <span class="material-symbols-outlined search-icon">search</span>
            </div>
            <div class="filter-tabs">
                <button class="active" id="tab-lake">Lake</button>
            </div>
            <div class="contacts-list" id="contacts-list"></div>
        `;

        const newSearchInput = document.getElementById('search-input');
        newSearchInput.addEventListener('input', (e) => {
            renderContactsList(e.target.value);
        });

        const newBtnAdd = document.getElementById('btn-add-contact');
        newBtnAdd.addEventListener('click', () => {
            sidebarBody.innerHTML = `
                <div class="add-contact-form">
                    <input type="text" placeholder="Name" id="add-contact-name" autocomplete="off">
                    <input type="text" placeholder="Goose-ID" id="add-contact-id" maxlength="14" autocomplete="off">
                    <button class="btn-add-goose" id="btn-add-goose">Add Goose</button>
                    <p class="add-contact-hint">For our BOT, try: GOOSE-2009-BOT</p>
                    <p class="add-contact-message" id="add-contact-message"></p>
                </div>
                <button class="back-to-main" id="btn-back-main">
                    <span class="material-symbols-outlined">arrow_back</span>
                    BACK
                </button>
            `;

            const idInput = document.getElementById('add-contact-id');
            idInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });

            document.getElementById('btn-add-goose').addEventListener('click', async () => {
                const name = document.getElementById('add-contact-name').value.trim();
                let gooseId = document.getElementById('add-contact-id').value.trim().toUpperCase();
                gooseId = formatGooseId(gooseId);
                const messageEl = document.getElementById('add-contact-message');

                if (!isValidGooseId(gooseId)) {
                    messageEl.textContent = "Invalid Goose-ID format!";
                    messageEl.className = 'add-contact-message error';
                    return;
                }

                if (contacts.find(c => c.goose_id === gooseId)) {
                    messageEl.textContent = 'Goose is already in the lake!';
                    messageEl.className = 'add-contact-message error';
                    return;
                }

                try {
                    await addContact(gooseId, name || gooseId);
                    messageEl.textContent = 'Goose added!';
                    messageEl.className = 'add-contact-message success';
                    
                    const contactsData = await fetchContacts();
                    contacts = contactsData;
                    
                    setTimeout(() => renderChatMainContent(), 1500);
                } catch (error) {
                    messageEl.textContent = "Error al añadir Goose!";
                    messageEl.className = 'add-contact-message error';
                }
            });

            document.getElementById('btn-back-main').addEventListener('click', () => {
                renderChatMainContent();
            });
        });

        renderContactsList();
        setupSearchFocus();
    }

    function renderProfileView() {
        sidebarHeader.innerHTML = `
            <img src="Gooseline-text-alt.png" alt="Gooseline">
        `;
        
        sidebarBody.innerHTML = `
            <div class="profile-view">
                <img src="${currentUser.avatar}" alt="Profile" class="profile-avatar" id="profile-avatar">
                <input type="file" accept="image/*" class="hidden-file-input" id="file-input">
                <div class="profile-info">
                    <div class="profile-field">
                        <span class="profile-label">USERNAME:</span>
                        <span class="profile-value">${currentUser.nickname}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-label">GOOSE-ID:</span>
                        <div class="goose-id-row">
                            <span class="profile-value">${currentUser.gooseId}</span>
                            <span class="material-symbols-outlined copy-icon" id="copy-goose-id">content_copy</span>
                        </div>
                    </div>
                </div>
            </div>
            <button class="back-to-main" id="btn-logout">
                <span class="material-symbols-outlined">logout</span>
                LOG OUT
            </button>
        `;

        const profileAvatar = document.getElementById('profile-avatar');
        const fileInput = document.getElementById('file-input');

        profileAvatar.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const result = await uploadAvatar(file);
                    
                    // Update current user avatar with the server path
                    currentUser.avatar = result.avatar;
                    profileAvatar.src = result.avatar;
                    
                    // Refresh contacts list to show updated avatar
                    const contactsData = await fetchContacts();
                    contacts = contactsData;
                    
                    // Update active chat avatar if it's the current user
                    if (activeChat && activeChat.goose_id === currentUser.gooseId) {
                        activeChat.avatar = result.avatar;
                        renderChat();
                    }
                    
                    console.log('✓ Avatar actualizado correctamente');
                } catch (error) {
                    console.error('Error al subir avatar:', error);
                }
            }
        });

        const copyIcon = document.getElementById('copy-goose-id');
        if (copyIcon) {
            copyIcon.addEventListener('click', () => {
                navigator.clipboard.writeText(currentUser.gooseId);
                console.log('✓ Goose-ID copiado');
            });
        }

        document.getElementById('btn-logout').addEventListener('click', () => {
            localStorage.removeItem('gooseline_token');
            localStorage.removeItem('gooseline_goose_id');
            
            if (WS) WS.close();
            
            TOKEN = null;
            CURRENT_USER_GOOSE_ID = null;
            contacts = [];
            activeChat = null;
            messages = {};
            currentUser = { username: '', gooseId: '', nickname: '', avatar: 'Gooseline-profile.png' };
            
            document.body.style.backgroundColor = '';
            renderLanding();
        });
    }

    function setupSearchFocus() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('focus', () => {
                searchInput.style.borderColor = '#BD482D';
            });
            searchInput.addEventListener('blur', () => {
                if (searchInput.value === '') {
                    searchInput.style.borderColor = 'transparent';
                }
            });
        }
    }

    setupSearchFocus();
}

// ============= EVENT LISTENERS HEADER =============
headerLogo.addEventListener('click', () => {
    if (WS) WS.close();
    
    document.body.style.backgroundColor = '';
    renderLanding();
});

btnGooseWeb.addEventListener('click', () => {
    historyStack.push('register');
    renderRegister();
});

btnGetStarted.addEventListener('click', () => {
    const previous = historyStack[historyStack.length - 1];
    if (previous === 'about' || previous === 'help') {
        historyStack = ['landing'];
        renderLanding();
    }
    historyStack.push('register');
    renderRegister();
});

btnAbout.addEventListener('click', () => {
    historyStack.push('about');
    renderAbout();
});

btnHelp.addEventListener('click', () => {
    historyStack.push('help');
    renderHelp();
});

// ============= INICIALIZACIÓN =============
window.addEventListener('load', () => {
    if (TOKEN && CURRENT_USER_GOOSE_ID) {
        fetchUserProfile()
            .then(profile => {
                currentUser = {
                    username: profile.username,
                    gooseId: profile.goose_id,
                    nickname: profile.nickname,
                    avatar: profile.avatar || 'Gooseline-profile.png'
                };
                
                return fetchContacts();
            })
            .then(contactsData => {
                contacts = contactsData;
                connectWebSocket();
                renderChat();
            })
            .catch(error => {
                console.error('Error al restaurar sesión:', error);
                localStorage.removeItem('gooseline_token');
                localStorage.removeItem('gooseline_goose_id');
                renderLanding();
            });
    } else {
        renderLanding();
    }
});