// firebase-config.js

// 1. إعدادات Firebase - من حسابك
const firebaseConfig = {
    apiKey: "AIzaSyCb4mlhg8-L4HvwfkXAQ2vt7hgIL9HTl4c",
    authDomain: "chatapppro-41808.firebaseapp.com",
    projectId: "chatapppro-41808",
    storageBucket: "chatapppro-41808.firebasestorage.app",
    messagingSenderId: "1014896233609",
    appId: "1:1014896233609:web:335f41290f2b4ae9588a58"
};

// 2. تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
// لا نستخدم Firebase Storage لتجنب خطة الدفع

// 3. إعدادات Cloudinary
const CLOUDINARY_CLOUD_NAME = 'b8d2borp';
const CLOUDINARY_UPLOAD_PRESET = 'chatapp_preset';