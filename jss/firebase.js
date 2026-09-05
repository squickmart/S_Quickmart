/* ============================================================
   S_QUICK MART — FIREBASE DATA LAYER
   ============================================================ */

(async function () {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js");
  const {
    getFirestore, doc, getDoc, setDoc, onSnapshot,
    collection, addDoc, query, where, orderBy, getDocs,
  } = await import("https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js");

  const firebaseConfig = {
    apiKey: "AIzaSyD1qOrie6i62ThyR0oeZtAomJbeYQwjMh4",
    authDomain: "quickmart-b117e.firebaseapp.com",
    projectId: "quickmart-b117e",
    storageBucket: "quickmart-b117e.firebasestorage.app",
    messagingSenderId: "128330058901",
    appId: "1:128330058901:web:2bbd1eae9231308ef79f9c",
  };
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  window._query = query; window._collection = collection; window._orderBy = orderBy;
  window._where = where; window._onSnapshot = onSnapshot; window._getDocs = getDocs;
  window._db = db; window._setDoc = setDoc; window._doc = doc; window._addDoc = addDoc;

  window.products = [];
  window.categories = [];
  window.catInfo = {};
  window.announceItems = [];
  window._ynAreas = [];

  const defaultCategories = [
    { id: "grocery", label: "Grocery", emoji: "🌾", subs: ["Dal & Rice", "Atta & Flour", "Oil & Ghee", "Sugar & Salt", "Masale", "Dry Fruits"] },
    { id: "dairy", label: "Dairy", emoji: "🥛", subs: ["Milk", "Curd & Paneer", "Butter & Cheese"] },
    { id: "snacks", label: "Snacks", emoji: "🍪", subs: ["Biscuits", "Chips", "Instant Food", "Namkeen"] },
    { id: "personal", label: "Personal Care", emoji: "🧴", subs: ["Bath & Body", "Oral Care", "Hair Care", "Skin Care", "Grooming"] },
    { id: "home", label: "Home Needs", emoji: "🧹", subs: ["Laundry", "Kitchen", "Bathroom", "Cleaning"] },
  ];

  function buildCatInfo() {
    window.catInfo = {};
    (window.categories || []).forEach(c => { window.catInfo[c.id] = { label: c.label, emoji: c.emoji, subs: c.subs || [] }; });
  }

  function notifyReady() { document.dispatchEvent(new CustomEvent('sqm:data-ready')); }

  async function loadCategories() {
    try {
      const snap = await getDoc(doc(db, "store", "categories"));
      window.categories = snap.exists() ? (snap.data().list || defaultCategories) : defaultCategories;
      if (!snap.exists()) await setDoc(doc(db, "store", "categories"), { list: window.categories });
    } catch (e) { window.categories = defaultCategories; }
    buildCatInfo();
  }

  async function loadProducts() {
    try {
      const snap = await getDoc(doc(db, "store", "products"));
      window.products = snap.exists() ? (snap.data().list || []) : [];
    } catch (e) { window.products = []; }
    notifyReady();
  }

  onSnapshot(doc(db, "store", "products"), (snap) => {
    if (snap.exists()) { window.products = snap.data().list || []; notifyReady(); }
  });
  onSnapshot(doc(db, "store", "categories"), (snap) => {
    if (!snap.exists()) return;
    window.categories = snap.data().list || [];
    buildCatInfo();
    notifyReady();
  });
  onSnapshot(doc(db, "store", "announcements"), (snap) => {
    if (snap.exists()) { window.announceItems = (snap.data().list || []).filter(t => t && t.trim()); window.renderAnnouncements && window.renderAnnouncements(); }
  });
  onSnapshot(doc(db, "store", "status"), (snap) => {
    if (!snap.exists()) return;
    const s = snap.data();
    window._storeOpen = s.open === true;
    window._storeMsg = s.message || "";
    window._productsClosed = s.productsClosed === true;
    window.sqmApplyStoreStatus && window.sqmApplyStoreStatus();
    window.updateCheckoutClosedNotice && window.updateCheckoutClosedNotice();
    notifyReady();
  });
  onSnapshot(doc(db, "store", "yourneed_areas"), (snap) => {
    if (!snap.exists()) return;
    const areas = snap.data().list || [];
    if (areas.length > 0) { window._ynAreas = areas; window.applyAreasToUI && window.applyAreasToUI(areas); }
  });

  // ── ORDERS (Firestore) ────────────────────────────────
  window.saveOrderToFirebase = async function (orderData) {
    try {
      const ref = await addDoc(collection(db, "orders"), orderData);
      fetch("/api/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orderData.name, total: orderData.total, items: orderData.items })
      }).catch(() => {});
      return ref.id;
    } catch (e) { console.error(e); return null; }
  };

  window.loadUserOrders = async function (phone) {
    try {
      const q = query(collection(db, "orders"), where("phone", "==", phone), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error(e); return []; }
  };

  window.saveCustomerProfile = function (user) {
    try {
      if (window._db && window._setDoc && window._doc && user.phone) {
        window._setDoc(window._doc(window._db, "customers", user.phone),
          { phone: user.phone, name: user.name, address: user.address, area: user.area, lastSeen: new Date().toISOString(), loggedOut: false },
          { merge: true });
      }
    } catch (e) {}
  };

  await loadCategories();
  await loadProducts();
})();
