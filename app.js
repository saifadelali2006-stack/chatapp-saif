// ========== المتغيرات العامة ==========
let currentUser = null;
let currentChatId = null;
let currentChatPartnerName = '';
let currentUserDoc = null;

// ========== شاشات ==========
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ========== المصادقة (بريد إلكتروني وكلمة مرور) ==========
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
        const result = await auth.signInWithEmailAndPassword(email, password);
        currentUser = result.user;
        await loadUserData();
        showScreen('main-screen');
        listenForChats();
        listenForGroups();
    } catch (error) {
        document.getElementById('auth-error').textContent = error.message;
    }
});

document.getElementById('signup-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = result.user;
        await db.collection('users').doc(currentUser.uid).set({
            email: email,
            name: '',
            phone: '',
            status: '',
            photoURL: ''
        });
        await loadUserData();
        showScreen('settings-screen');
    } catch (error) {
        document.getElementById('auth-error').textContent = error.message;
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut();
    location.reload();
});

async function loadUserData() {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
        currentUserDoc = doc.data();
        updateUserDisplay();
    } else {
        await db.collection('users').doc(currentUser.uid).set({
            email: currentUser.email,
            name: '',
            phone: '',
            status: '',
            photoURL: ''
        });
        currentUserDoc = { email: currentUser.email, name: '', phone: '', status: '', photoURL: '' };
    }
}

function updateUserDisplay() {
    document.getElementById('user-display').textContent = currentUserDoc.name || currentUser.email;
}

// ========== الإعدادات ==========
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-name').value = currentUserDoc.name || '';
    document.getElementById('settings-phone').value = currentUserDoc.phone || '';
    document.getElementById('settings-status').value = currentUserDoc.status || '';
    document.getElementById('profile-pic').src = currentUserDoc.photoURL || '';
    showScreen('settings-screen');
});
document.getElementById('settings-back').addEventListener('click', () => {
    showScreen('main-screen');
});

document.getElementById('change-pic-btn').addEventListener('click', () => {
    document.getElementById('profile-pic-input').click();
});
document.getElementById('profile-pic-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const res = await fetch(url, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.secure_url) {
        document.getElementById('profile-pic').src = data.secure_url;
        currentUserDoc.photoURL = data.secure_url;
    }
});

document.getElementById('save-settings').addEventListener('click', async () => {
    const name = document.getElementById('settings-name').value.trim();
    const phone = document.getElementById('settings-phone').value.trim();
    const status = document.getElementById('settings-status').value.trim();
    await db.collection('users').doc(currentUser.uid).update({
        name, phone, status, photoURL: currentUserDoc.photoURL
    });
    currentUserDoc.name = name;
    currentUserDoc.phone = phone;
    currentUserDoc.status = status;
    updateUserDisplay();
    showScreen('main-screen');
});

// ========== التبويبات ==========
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        const tabName = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-' + tabName).classList.add('active');
        if (tabName === 'status') loadStatuses();
        if (tabName === 'groups') listenForGroups();
    });
});

// ========== المحادثات (فردية) ==========
document.getElementById('add-chat-btn').addEventListener('click', () => {
    document.getElementById('new-chat-modal').style.display = 'flex';
});
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('new-chat-modal').style.display = 'none';
        document.getElementById('create-group-modal').style.display = 'none';
    });
});

document.getElementById('start-chat-btn').addEventListener('click', async () => {
    const phone = document.getElementById('new-chat-phone').value.trim();
    if (!phone || phone === currentUserDoc.phone) return alert('رقم غير صحيح');
    const snapshot = await db.collection('users').where('phone', '==', phone).get();
    if (snapshot.empty) return alert('لا يوجد مستخدم بهذا الرقم');
    const partner = snapshot.docs[0].data();
    const partnerUid = snapshot.docs[0].id;
    const chatId = [currentUser.uid, partnerUid].sort().join('_');
    await db.collection('chats').doc(chatId).set({
        participants: [currentUser.uid, partnerUid],
        participantNames: {
            [currentUser.uid]: currentUserDoc.name || currentUser.email,
            [partnerUid]: partner.name || partner.email
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'private'
    }, { merge: true });
    document.getElementById('new-chat-modal').style.display = 'none';
    openChat(chatId, partner.name || partner.email);
});

function listenForChats() {
    db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .where('type', '==', 'private')
        .onSnapshot(snapshot => {
            const container = document.getElementById('chat-list');
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const partnerId = data.participants.find(id => id !== currentUser.uid);
                const partnerName = data.participantNames?.[partnerId] || 'مستخدم';
                const div = document.createElement('div');
                div.className = 'chat-item';
                div.innerHTML = `<div class="chat-avatar">👤</div>
                         <div class="chat-info">
                           <div class="name">${partnerName}</div>
                           <div class="last-message">...</div>
                         </div>`;
                div.onclick = () => openChat(doc.id, partnerName);
                container.appendChild(div);
            });
        });
}

function openChat(chatId, partnerName) {
    currentChatId = chatId;
    currentChatPartnerName = partnerName;
    document.getElementById('chat-partner-name').textContent = partnerName;
    showScreen('chat-screen');
    loadMessages(chatId);
}

document.getElementById('back-btn').addEventListener('click', () => {
    showScreen('main-screen');
});

// ========== إرسال الرسائل ==========
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = document.getElementById('message-input').value.trim();
    if (!text || !currentChatId) return;
    db.collection('chats').doc(currentChatId).collection('messages').add({
        sender: currentUser.uid,
        senderName: currentUserDoc.name || currentUser.email,
        text,
        type: 'text',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('message-input').value = '';
}

document.getElementById('attach-btn').addEventListener('click', () => {
    document.getElementById('media-input').click();
});
document.getElementById('media-input').addEventListener('change', uploadMedia);

function uploadMedia(e) {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    fetch(url, { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            if (data.secure_url) {
                db.collection('chats').doc(currentChatId).collection('messages').add({
                    sender: currentUser.uid,
                    senderName: currentUserDoc.name || currentUser.email,
                    mediaUrl: data.secure_url,
                    type: file.type.startsWith('image') ? 'image' : 'video',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
    e.target.value = '';
}

function loadMessages(chatId) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                const div = document.createElement('div');
                div.className = `message ${msg.sender === currentUser.uid ? 'sent' : 'received'}`;
                if (msg.type === 'text') {
                    div.textContent = msg.text;
                } else if (msg.type === 'image') {
                    div.innerHTML = `<img src="${msg.mediaUrl}" alt="صورة">`;
                } else if (msg.type === 'video') {
                    div.innerHTML = `<video controls src="${msg.mediaUrl}"></video>`;
                }
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
        });
}

// ========== المجموعات ==========
document.getElementById('create-group-btn').addEventListener('click', () => {
    document.getElementById('create-group-modal').style.display = 'flex';
});
document.getElementById('create-group-submit').addEventListener('click', async () => {
    const name = document.getElementById('group-name').value.trim();
    const membersRaw = document.getElementById('group-members').value.trim();
    if (!name || !membersRaw) return alert('أدخل الاسم والأعضاء');
    const phones = membersRaw.split(',').map(s => s.trim());
    const membersUids = [currentUser.uid];
    const memberNames = { [currentUser.uid]: currentUserDoc.name || currentUser.email };
    for (const phone of phones) {
        const snap = await db.collection('users').where('phone', '==', phone).get();
        if (!snap.empty) {
            const uid = snap.docs[0].id;
            membersUids.push(uid);
            memberNames[uid] = snap.docs[0].data().name || phone;
        }
    }
    const groupId = db.collection('chats').doc().id;
    await db.collection('chats').doc(groupId).set({
        participants: membersUids,
        participantNames: memberNames,
        type: 'group',
        groupName: name,
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('create-group-modal').style.display = 'none';
    openChat(groupId, name);
});

function listenForGroups() {
    db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .where('type', '==', 'group')
        .onSnapshot(snapshot => {
            const container = document.getElementById('group-list');
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const div = document.createElement('div');
                div.className = 'chat-item';
                div.innerHTML = `<div class="chat-avatar">👥</div>
                         <div class="chat-info">
                           <div class="name">${data.groupName}</div>
                           <div class="last-message">...</div>
                         </div>`;
                div.onclick = () => openChat(doc.id, data.groupName);
                container.appendChild(div);
            });
        });
}

// ========== جهات الاتصال ==========
document.getElementById('pick-contact-btn').addEventListener('click', async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
        try {
            const contacts = await navigator.contacts.select(['tel'], { multiple: true });
            if (contacts.length > 0) {
                const phone = contacts[0].tel[0].replace(/\s/g, '');
                document.getElementById('new-chat-phone').value = phone;
                document.getElementById('new-chat-modal').style.display = 'flex';
            }
        } catch (err) {
            alert('تعذر الوصول لجهات الاتصال. تأكد من السماح بالصلاحية.');
        }
    } else {
        alert('ميزة اختيار جهات الاتصال غير مدعومة هنا. استخدم الزر + وأدخل الرقم يدويًا.');
    }
});

// ========== الحالات (نفس السابق) ==========
document.getElementById('add-status-btn').addEventListener('click', () => {
    document.getElementById('status-file-input').click();
});
document.getElementById('status-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    fetch(url, { method: 'POST', body: formData })
        .then(res => res.json())
        .then(async data => {
            if (data.secure_url) {
                await db.collection('statuses').add({
                    user: currentUser.uid,
                    userName: currentUserDoc.name || currentUser.email,
                    mediaUrl: data.secure_url,
                    type: file.type.startsWith('image') ? 'image' : 'video',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                loadStatuses();
            }
        });
    e.target.value = '';
});

function loadStatuses() {
    const container = document.getElementById('statuses-list');
    container.innerHTML = '';
    const cutoff = new Date(Date.now() - 86400000);
    db.collection('statuses')
        .where('timestamp', '>=', cutoff)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                const status = doc.data();
                const div = document.createElement('div');
                div.className = 'status-circle';
                if (status.type === 'image') {
                    div.innerHTML = `<img src="${status.mediaUrl}">`;
                } else {
                    div.innerHTML = `<video src="${status.mediaUrl}"></video>`;
                }
                div.onclick = () => viewStatus(status);
                container.appendChild(div);
            });
        });
}

function viewStatus(status) {
    const modal = document.getElementById('status-view-modal');
    const content = document.getElementById('status-view-content');
    content.innerHTML = status.type === 'image'
        ? `<img src="${status.mediaUrl}" style="max-width:90%; max-height:80vh; border-radius:15px;">`
        : `<video src="${status.mediaUrl}" controls autoplay style="max-width:90%; max-height:80vh; border-radius:15px;"></video>`;
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.display = 'none'; }, 10000);
}
document.querySelector('.close-status-view').onclick = () => {
    document.getElementById('status-view-modal').style.display = 'none';
};

// ========== مكالمات (تنبيه مستقبلي) ==========
document.getElementById('call-btn').addEventListener('click', () => {
    alert('ميزة المكالمات ستضاف قريباً');
});