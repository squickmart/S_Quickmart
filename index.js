    (async function () {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js");
    const {
      getFirestore,
      doc,
      getDoc,
      setDoc,
      onSnapshot,
      collection,
      addDoc,
      query,
      where,
      orderBy,
      getDocs,
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

    async function loadProducts() {
      try {
        const snap = await getDoc(doc(db, "store", "products"));
        window.products = snap.exists() ? snap.data().list || [] : [];
      } catch (e) {
        window.products = [];
      }
      window.renderProducts();
      window.updateCartUI();
      window.renderSubcatStrip && window.renderSubcatStrip();
    }

    onSnapshot(doc(db, "store", "products"), (snap) => {
      if (snap.exists()) {
        window.products = snap.data().list || [];
        window.renderProducts();
        window.renderDetailIfOpen();
        window.renderSubcatStrip && window.renderSubcatStrip();
      }
    });
    onSnapshot(doc(db, "store", "announcements"), (snap) => {
      if (snap.exists()) {
        window.announceItems = (snap.data().list || []).filter(
          (t) => t && t.trim(),
        );
        window.renderAnnouncements();
      }
    });

    // ── SAVE ORDER TO FIREBASE ────────────────────────────────
    window.saveOrderToFirebase = async function (orderData) {
      try {
        const ref = await addDoc(collection(db, "orders"), orderData);
        // Telegram Notification
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: orderData.name,
            total: orderData.total,
            items: orderData.items
          })
        });
        return ref.id;
      } catch (e) {
        console.error(e);
        return null;
      }
    };

    // ── LOAD USER ORDERS ──────────────────────────────────────
    window.loadUserOrders = async function (phone) {
      try {
        const q = query(
          collection(db, "orders"),
          where("phone", "==", phone),
          orderBy("createdAt", "desc"),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error(e);
        return [];
      }
    };

    // ── EXPOSE FIRESTORE FUNCTIONS TO GLOBAL SCRIPT ──────────
    window._query = query;
    window._collection = collection;
    window._orderBy = orderBy;
    window._where = where;
    window._onSnapshot = onSnapshot;
    window._getDocs = getDocs;
    window._db = db;
    window._setDoc = setDoc;
    window._doc = doc;

    // load categories first so product rendering has category info
    loadCategories().then(() => loadProducts());

    // realtime update when admin changes categories
    onSnapshot(doc(db, "store", "categories"), (snap) => {
      if (!snap.exists()) return;
      window.categories = snap.data().list || [];
      buildCatInfo();
      renderCategoryGrid();
      // re-render products/groups if needed
      window.renderProducts && window.renderProducts();
    });

    // ── STORE STATUS LISTENER (real-time from Firebase) ───────
    onSnapshot(doc(db, "store", "status"), (snap) => {
      if (!snap.exists()) return;
      const s = snap.data();
      window._storeOpen = s.open !== false;
      window._storeMsg = s.message || "";
      const wasOpen =
        window._productsClosed === false ||
        window._productsClosed === undefined;
      window._productsClosed = s.productsClosed === true;
      applyStoreStatus();
      window.renderProducts && window.renderProducts();
      // Show popup when products just got closed
      const popup = document.getElementById("productsClosedOverlay");
      if (popup)
        popup.style.display = window._productsClosed ? "flex" : "none";
    });

    // add code

    // ── AREAS REAL-TIME LISTENER ──────────────────────────────
    onSnapshot(doc(db, "store", "yourneed_areas"), (snap) => {
      if (!snap.exists()) return;
      const areas = snap.data().list || [];
      if (areas.length > 0) {
        window._ynAreas = areas;
        window.applyAreasToCheckout && window.applyAreasToCheckout(areas);
      }
    });

    window.applyStoreStatus = function () {
      const manualClosed = window._storeOpen === false;
      const timeClosed = !isOpen();
      const isClosed = manualClosed || timeClosed;
      const overlay = document.getElementById("closedOverlay");
      const msgEl = document.getElementById("closedCustomMsg");
      if (isClosed) {
        overlay.classList.add("show");
        if (msgEl)
          msgEl.textContent =
            window._storeMsg ||
            (manualClosed
              ? "Store closed today. Please visit again tomorrow! 🙏"
              : "");
        // Disable all add-to-cart clicks via overlay
        document.getElementById("storeBlocker").style.display = "block";
      } else {
        overlay.classList.remove("show");
        document.getElementById("storeBlocker").style.display = "none";
      }
    };
      let catInfo = {};
      // default categories fallback (keeps same structure as admin)
      const defaultCategories = [
        {
          id: "grocery",
          label: "Grocery",
          emoji: "🌾",
          subs: [
            "Dal & Rice",
            "Atta & Flour",
            "Oil & Ghee",
            "Sugar & Salt",
            "Masale",
            "Dry Fruits",
          ],
        },
        {
          id: "dairy",
          label: "Dairy",
          emoji: "🥛",
          subs: ["Milk", "Curd & Paneer", "Butter & Cheese"],
        },
        {
          id: "snacks",
          label: "Snacks",
          emoji: "🍪",
          subs: ["Biscuits", "Chips", "Instant Food", "Namkeen"],
        },
        {
          id: "personal",
          label: "Personal Care",
          emoji: "🧴",
          subs: [
            "Bath & Body",
            "Oral Care",
            "Hair Care",
            "Skin Care",
            "Grooming",
          ],
        },
        {
          id: "home",
          label: "Home Needs",
          emoji: "🧹",
          subs: ["Laundry", "Kitchen", "Bathroom", "Cleaning"],
        },
      ];

      async function loadCategories() {
        try {
          const snap = await getDoc(doc(db, "store", "categories"));
          window.categories = snap.exists()
            ? snap.data().list || defaultCategories
            : defaultCategories;
          // if categories doc missing, initialize it so admin and index stay in sync
          if (!snap.exists())
            await setDoc(doc(db, "store", "categories"), {
              list: window.categories,
            });
        } catch (e) {
          window.categories = defaultCategories;
        }
        // build catInfo map and render the category grid
        buildCatInfo();
        renderCategoryGrid();
      }

      window.buildCatInfo = buildCatInfo;
      window.renderCategoryGrid = renderCategoryGrid;
      function buildCatInfo() {
        catInfo = {};
        (window.categories || []).forEach((c) => {
          catInfo[c.id] = { label: c.label, emoji: c.emoji, subs: c.subs || [] };
        });
        renderSubcatStrip();
      }

      window.renderSubcatStrip = renderSubcatStrip;
      function renderSubcatStrip() {
        var inner = document.getElementById("subcatStripInner");
        var wrap  = document.getElementById("subcatStrip");
        if (!inner || !wrap) return;

        var subImgMap = {};
        (window.products || []).forEach(function(p) {
          var key = (p.cat || "") + "|||" + (p.sub || "");
          if (!subImgMap[key] && p.img) subImgMap[key] = p.img;
        });

        var seen = {};
        var cards = [];
        (window.categories || []).forEach(function(cat) {
          (cat.subs || []).forEach(function(sub) {
            var key = cat.id + "|||" + sub;
            var hasProduct = (window.products || []).some(function(p) {
              return p.cat === cat.id && (p.sub || "").trim() === sub.trim() && p.visible !== false;
            });
            if (!hasProduct) return;
            if (seen[sub]) return;
            seen[sub] = true;
            var emoji = (typeof getSubEmoji === 'function') ? getSubEmoji(sub) : '📦';
            cards.push({ cat: cat.id, sub: sub, img: subImgMap[key] || null, emoji: emoji });
          });
        });

        if (!cards.length) { wrap.style.display = "none"; return; }

        var html = "";
        cards.forEach(function(c) {
          var imgTag = c.img
            ? "<img src='" + c.img + "' style='width:100%;height:100%;object-fit:contain;' onerror=\"this.parentNode.innerHTML='" + c.emoji + "'\">"
            : c.emoji;
          html += "<div class='scs-card' onclick=\"scsNav('" + c.cat + "','" + c.sub.replace(/'/g, "\\'") + "')\">"
            + "<div class='scs-img'>" + imgTag + "</div>"
            + "<div class='scs-name'>" + c.sub + "</div>"
            + "</div>";
        });

        inner.innerHTML = html;
        wrap.style.display = "block";
      }

      function scsNav(catId, subName) {
        openDetailModal(catId, subName);
      }

      function renderCategoryGrid() {
        const grid = document.querySelector(".cat-grid");
        if (!grid) return;
        const html = [];
        html.push(
          `<div class="cat-card ${curCat === "all" ? "active" : ""}" onclick="selCat('all', this)"><div class="cat-emoji">🏪</div><div class="cat-lbl">All Items</div></div>`,
        );
        (window.categories || []).forEach((c) => {
          html.push(
            `<div class="cat-card ${curCat === c.id ? "active" : ""}" onclick="selCatScroll('${c.id}', this)"><div class="cat-emoji">${c.emoji}</div><div class="cat-lbl">${c.label}</div></div>`,
          );
        });
        grid.innerHTML = html.join("");
      }
      window.products = [];
      window.announceItems = [];
      let cart = {},
        curCat = "all",
        curDetailCat = null,
        curDetailSub = null;
      let announceIndex = 0,
        announceTimer = null;
      const OPEN_HOUR = 7,
        CLOSE_HOUR = 22;

      // ── USER DATA (localStorage) ──────────────────────────────
      let currentUser = { phone: "", name: "", address: "", area: "" };
      let orderHistoryUnsub = null;

      function loadUser() {
        const saved = localStorage.getItem("sqm_user");
        if (saved) {
          currentUser = JSON.parse(saved);
          updateProfileUI();
          autoFillCheckout();
        } else {
          setTimeout(() => {
            if (!currentUser.phone) openProfile();
          }, 3000);
        }
      }

      // function setOverlayFooterState(hidden) {
      //   document.body.classList.toggle("overlay-open", hidden);
      // }
      function savePhoneLogin() {
        const ph = document.getElementById("phoneModalInput").value.trim();
        if (ph.length !== 10) {
          showToast("❌ Please enter a 10-digit number!");
          return;
        }
        currentUser.phone = ph;
        localStorage.setItem("sqm_user", JSON.stringify(currentUser));
        document.getElementById("phoneModal").classList.remove("open");
        // setOverlayFooterState(false);
        updateProfileUI();
        showToast("✅ Number saved!");
      }
      function skipPhoneLogin() {
        document.getElementById("phoneModal").classList.remove("open");
        // setOverlayFooterState(false);
      }

      let selectedProfileArea = "";
      function selectProfileArea(area) {
        selectedProfileArea = area;
        document
          .getElementById("pAreaGrid")
          .querySelectorAll(".profile-area-btn")
          .forEach(function (b) {
            b.classList.toggle("selected", b.dataset.area === area);
          });
        // After select, collapse picker and show badge
        document.getElementById("pAreaPicker").classList.remove("open");
        document.getElementById("pAreaBadgeText").textContent = area;
        document.getElementById("pAreaBadgeWrap").style.display = "block";
      }
      function openProfileAreaPicker() {
        document.getElementById("pAreaPicker").classList.add("open");
        document.getElementById("pAreaBadgeWrap").style.display = "none";
        var ps = document.getElementById("p-area-search");
        if (ps) {
          ps.value = ""; filterAreaSearch("pAreaGrid", "p-area-no-result", "");
        }
      }
      function loadProfileAreaUI(area) {
        if (!area) return;
        selectedProfileArea = area;
        document
          .getElementById("pAreaGrid")
          .querySelectorAll(".profile-area-btn")
          .forEach(function (b) {
            b.classList.toggle("selected", b.dataset.area === area);
          });
        document.getElementById("pAreaBadgeText").textContent = area;
        document.getElementById("pAreaBadgeWrap").style.display = "block";
        document.getElementById("pAreaPicker").classList.remove("open");
      }
      function saveProfile() {
        const ph = document.getElementById("pPhone").value.trim();
        const nm = document.getElementById("pName").value.trim();
        const addr = document.getElementById("pAddr").value.trim();
        if (!ph || ph.length !== 10) {
          showToast("❌ Please fill your phone number!");
          document.getElementById("pPhone").focus();
          return;
        }
        if (!nm) {
          showToast("❌ Please fill your name!");
          document.getElementById("pName").focus();
          return;
        }
        if (!selectedProfileArea) {
          showToast("❌ Please select your area!");
          openProfileAreaPicker();
          return;
        }
        if (!addr) {
          showToast("❌ Please fill your address!");
          document.getElementById("pAddr").focus();
          return;
        }
        currentUser = {
          phone: ph,
          name: nm,
          address: addr,
          area: selectedProfileArea,
        };
        localStorage.setItem("sqm_user", JSON.stringify(currentUser));
        updateProfileUI();
        autoFillCheckout();
        showToast("✅ Details saved!");
        // Auto close
        // Save to Firebase customers collection (silent)
        try {
          if (window._db && window._setDoc && window._doc) {
            window._setDoc(window._doc(window._db, "customers", currentUser.phone), {
              phone: currentUser.phone,
              name: currentUser.name,
              address: currentUser.address,
              area: currentUser.area,
              lastSeen: new Date().toISOString(),
            }, { merge: true });
          }
        } catch(e) {}
        document.getElementById("profileOverlay").classList.remove("open");
        document.getElementById("profileSidebar").classList.remove("open");
        document.body.style.overflow = "";   // ✅ YE ADD KARE
        setOverlayFooterState(false);        // ✅ YE ADD KARE
      }

      function logoutUser() {
        if (!confirm("Are you sure you want to logout?")) return;
        currentUser = {};
        localStorage.removeItem("sqm_user");
        updateProfileUI();
        closeProfile();
        showToast("Logged out successfully!");
      }

      function updateProfileUI() {
        const hasUser = currentUser.phone || currentUser.name;
        // Show logout button only if logged in
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) logoutBtn.style.display = hasUser ? "block" : "none";
        document.getElementById("hdrUserLabel").textContent = currentUser.name
          ? currentUser.name.split(" ")[0]
          : currentUser.phone
            ? currentUser.phone
            : "Login";
        document.getElementById("profileName").textContent =
          currentUser.name || "Guest User";
        document.getElementById("profilePhoneLabel").textContent =
          currentUser.phone
            ? "📱 " + currentUser.phone
            : "Login to save your details";
        document.getElementById("profileAvatar").textContent = currentUser.name
          ? currentUser.name[0].toUpperCase()
          : "👤";
        document.getElementById("pPhone").value = currentUser.phone || "";
        document.getElementById("pName").value = currentUser.name || "";
        document.getElementById("pAddr").value = currentUser.address || "";
        if (currentUser.area) loadProfileAreaUI(currentUser.area);
      }

      function autoFillCheckout() {
        if (currentUser.name)
          document.getElementById("cName").value = currentUser.name;
        if (currentUser.phone)
          document.getElementById("cPhone").value = currentUser.phone;
        if (currentUser.address)
          document.getElementById("cAddr").value = currentUser.address;
        if (currentUser.area) {
          selectedCheckoutArea = currentUser.area;
          document
            .getElementById("chk-area-grid")
            .querySelectorAll(".area-btn")
            .forEach(function (b) {
              b.classList.toggle(
                "selected",
                b.dataset.area === currentUser.area,
              );
            });
          document.getElementById("chkAreaBadgeText").textContent =
            currentUser.area;
          document.getElementById("chkAreaBadgeWrap").style.display = "block";
          document.getElementById("chkAreaPicker").style.display = "none";
        }
      }

      function openProfile() {
        document.getElementById("profileOverlay").classList.add("open");
        document.getElementById("profileSidebar").classList.add("open");
        document.body.style.overflow = "hidden";
        // setOverlayFooterState(true);
        if (currentUser.phone) loadOrderHistory(currentUser.phone);
      }
      function closeProfile() {
        document.getElementById("profileOverlay").classList.remove("open");
        document.getElementById("profileSidebar").classList.remove("open");
        document.body.style.overflow = "";
        // setOverlayFooterState(false);
        if (orderHistoryUnsub) {
          orderHistoryUnsub();
          orderHistoryUnsub = null;
        }
      }

      function loadOrderHistory(phone) {
        const list = document.getElementById("orderHistoryList");
        list.innerHTML =
          '<p style="text-align:center;padding:20px;color:#aaa;">Loading orders...</p>';

        // Stop previous listener if any
        if (orderHistoryUnsub) {
          orderHistoryUnsub();
          orderHistoryUnsub = null;
        }

        let regularOrders = [];
        let ynOrders = [];
        let regularDone = false;
        let ynDone = false;

        function renderAll() {
          if (!regularDone || !ynDone) return;
          // Merge and sort by createdAt desc
          const all = [...regularOrders, ...ynOrders].sort((a, b) => {
            const ta = a.createdAt ? a.createdAt.seconds : 0;
            const tb = b.createdAt ? b.createdAt.seconds : 0;
            return tb - ta;
          });

          if (!all.length) {
            list.innerHTML =
              '<div class="no-orders"><div class="no-orders-icon">📭</div><p>No orders yet</p></div>';
            return;
          }

          const statusMap = {
            pending: "📋 Pending",
            confirmed: "✅ Confirmed",
            out_for_delivery: "🛵 Out for Delivery",
            delivered: "🎉 Delivered",
            cancelled: "❌ Cancelled",
          };

          list.innerHTML = all.map((o) => {
            const isYN = o._type === "yourneed";
            const st = o.status || "pending";
            const cls = "order-status status-" + st;
            const dt = o.createdAt
              ? new Date(o.createdAt.seconds * 1000).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "";

            if (isYN) {
              // YourNeed order card
              const ynType = o.type === "pickup_drop" ? "🏍️ Pickup & Drop" : "🛍️ Custom Item";
              const ynDetails = o.type === "pickup_drop"
                ? `<div style="font-size:12px;color:#555;margin-bottom:4px"><b>Items:</b> ${o.itemDesc || "[object Object]"}</div>
                   <div style="font-size:12px;color:#555"><b>Address:</b> ${o.dropAddr || o.address || ""}</div>`
                : `<div style="font-size:12px;color:#555;margin-bottom:4px"><b>Items:</b> ${(o.items || []).map(i => i.name + " ×" + i.qty).join(", ") || o.itemDesc || ""}</div>
                   <div style="font-size:12px;color:#555"><b>Address:</b> ${o.address || ""}</div>`;

              const ynSteps = ["pending", "confirmed", "out_for_delivery", "delivered"];
              const ynStepIdx = ynSteps.indexOf(st);
              const ynStepLabels = ["Placed", "Confirmed", "On Way", "Delivered"];
              const ynStepIcons = ["📋", "✅", "🛵", "🎉"];
              const ynProgressBar = ynSteps.map((s, i) => {
                const done = i <= ynStepIdx && st !== "cancelled" && st !== "rejected";
                return `<div style="flex:1;text-align:center">
                  <div style="width:28px;height:28px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;
                    background:${done ? "#7c3aed" : "#eee"};color:${done ? "#fff" : "#aaa"}">
                    ${done ? ynStepIcons[i] : i + 1}
                  </div>
                  <div style="font-size:10px;font-weight:600;color:${done ? "#7c3aed" : "#aaa"}">${ynStepLabels[i]}</div>
                </div>`;
              }).join('<div style="flex:0 0 20px;display:flex;align-items:center;padding-bottom:16px"><div style="height:2px;width:100%;background:#eee;flex:1"></div></div>');

              return `<div class="order-card yn-card" style="margin-bottom:14px;">
                <div class="order-card-top">
                  <div>
                    <div style="font-size:12px;font-weight:700;color:#7c3aed;">✨ YourNeed #${o.id.slice(-6).toUpperCase()}</div>
                    <div class="order-date">${dt}</div>
                  </div>
                  <span class="${cls}">${statusMap[st] || st}</span>
                </div>
                ${st !== "cancelled" && st !== "rejected"
                  ? `<div style="display:flex;align-items:flex-start;gap:0;background:#f5f3ff;border-radius:10px;padding:12px 8px;margin-bottom:10px">
                  ${ynProgressBar}
                </div>`
                  : st === "rejected"
                    ? `<div style="background:#fdecea;border-radius:10px;padding:10px;margin-bottom:10px;text-align:center;font-size:13px;color:#c62828;font-weight:600">❌ Request Rejected</div>`
                    : `<div style="background:#fdecea;border-radius:10px;padding:10px;margin-bottom:10px;text-align:center;font-size:13px;color:#c62828;font-weight:600">❌ Order Cancelled</div>`
                }
                <div style="background:#f5f3ff;border-radius:10px;padding:10px 12px;margin-bottom:6px">
                  <div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:6px">${ynType}</div>
                  ${ynDetails}
                </div>
              </div>`;
            }

            // Regular order card
            const itemsList =
              o.items && o.items.length
                ? `<div style="background:#f8f9fa;border-radius:10px;padding:10px 12px;margin-bottom:8px">
                  <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">ITEMS ORDERED</div>
                  ${o.items
                  .map(
                    (i) => `
                    <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #eee">
                      <div style="width:36px;height:36px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;overflow:hidden;border:1px solid #eee">
                        ${i.img ? `<img src="${i.img}" style="width:36px;height:36px;object-fit:contain" onerror="this.style.display='none';this.parentNode.innerHTML='${i.emoji || "📦"}'">` : i.emoji || "📦"}
                      </div>
                      <div style="flex:1">
                        <div style="font-size:13px;font-weight:600;color:#1e1e1e">${i.name}</div>
                        <div style="font-size:11px;color:#999">${i.unit} &nbsp;×&nbsp; ${i.qty}</div>
                      </div>
                      <div style="font-size:14px;font-weight:700;color:#246a73">₹${i.price * i.qty}</div>
                    </div>`,
                  )
                  .join("")}
                  <div style="display:flex;justify-content:space-between;padding-top:8px;font-size:13px;color:#777">
                    <span>Delivery</span><span>${o.delivery === 0 ? '<span style="color:#1a9e5c;font-weight:700">FREE</span>' : "₹" + (o.delivery || 23)}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;padding-top:4px;font-family:'Baloo 2',cursive;font-size:16px;font-weight:700;color:#1e1e1e">
                    <span>Total</span><span>₹${o.total}</span>
                  </div>
                </div>`
                : `<div style="color:#aaa;font-size:13px;padding:8px">No items found</div>`;

            const steps = ["pending", "confirmed", "delivered"];
            const stepIdx = steps.indexOf(st);
            const progressBar = steps
              .map((s, i) => {
                const done = i <= stepIdx && st !== "cancelled";
                const label =
                  s === "pending" ? "Placed" : s === "confirmed" ? "Confirmed" : "Delivered";
                return `<div style="flex:1;text-align:center">
                <div style="width:28px;height:28px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;
                  background:${done ? "#246a73" : "#eee"};color:${done ? "#fff" : "#aaa"}">
                  ${done ? (i === 2 ? "🎉" : i === 1 ? "✅" : "📋") : i + 1}
                </div>
                <div style="font-size:10px;font-weight:600;color:${done ? "#246a73" : "#aaa"}">${label}</div>
              </div>`;
              })
              .join('<div style="flex:0 0 20px;display:flex;align-items:center;padding-bottom:16px"><div style="height:2px;width:100%;background:#eee;flex:1"></div></div>');

            return `<div class="order-card" style="margin-bottom:14px">
              <div class="order-card-top">
                <div>
                  <div class="order-id">Order #${o.id.slice(-6).toUpperCase()}</div>
                  <div class="order-date">${dt}</div>
                </div>
                <span class="${cls}">${statusMap[st] || st}</span>
              </div>
              ${st !== "cancelled"
                ? `<div style="display:flex;align-items:flex-start;gap:0;background:#f8f8f8;border-radius:10px;padding:12px 8px;margin-bottom:10px">
                ${progressBar}
              </div>`
                : `<div style="background:#fdecea;border-radius:10px;padding:10px;margin-bottom:10px;text-align:center;font-size:13px;color:#c62828;font-weight:600">❌ Order Cancelled</div>`
              }
              <div class="order-items">${itemsList}</div>
            </div>`;
          }).join("");
        }

        // Listener 1: regular orders
        const q1 = window._query(
          window._collection(window._db, "orders"),
          window._orderBy("createdAt", "desc"),
        );
        const unsub1 = window._onSnapshot(q1, (snap) => {
          regularOrders = snap.docs
            .map((d) => ({ id: d.id, ...d.data(), _type: "regular" }))
            .filter((o) => o.phone === phone);
          regularDone = true;
          renderAll();
        }, (err) => {
          console.error(err);
          regularDone = true;
          renderAll();
        });

        // Listener 2: yourneed_requests
        const q2 = window._query(
          window._collection(window._db, "yourneed_requests"),
          window._orderBy("createdAt", "desc"),
        );
        const unsub2 = window._onSnapshot(q2, (snap) => {
          ynOrders = snap.docs
            .map((d) => ({ id: d.id, ...d.data(), _type: "yourneed" }))
            .filter((o) => o.phone === phone);
          ynDone = true;
          renderAll();
        }, (err) => {
          console.error(err);
          ynDone = true;
          renderAll();
        });

        // Combined unsubscribe
        orderHistoryUnsub = () => { unsub1(); unsub2(); };
      }

      // ── STORE OPEN/CLOSE ──────────────────────────────────────
      function isOpen() {
        const h = new Date().getHours();
        return h >= OPEN_HOUR && h < CLOSE_HOUR;
      }

      function setupTiming() {
        const bar = document.getElementById("timingBar");
        if (isOpen()) {
          bar.innerHTML = `<span class="open-dot"></span>&nbsp;<span class="timing-status open">OPEN</span>&nbsp;Delivering 7AM–10PM`;
        } else {
          bar.innerHTML = `<span class="closed-dot"></span>&nbsp;<span class="timing-status closed">CLOSED</span>&nbsp;Open at 7AM`;
          setTimeout(
            () =>
              document.getElementById("closedOverlay").classList.add("show"),
            800,
          );
        }
      }

      // ── ANNOUNCEMENTS ─────────────────────────────────────────
      function setAnnounceText(t) {
        const el = document.getElementById("announceTrack");
        el.textContent = "• " + t.trim();
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "announce-scroll 18s linear infinite";
      }
      window.renderAnnouncements = function () {
        const items = (window.announceItems || []).filter((t) => t && t.trim());
        const bar = document.getElementById("announceBar");
        if (!items.length) {
          bar.classList.add("hidden");
          if (announceTimer) {
            clearInterval(announceTimer);
            announceTimer = null;
          }
          return;
        }
        announceIndex = 0;
        bar.classList.remove("hidden");
        setAnnounceText(items[0]);
        if (announceTimer) clearInterval(announceTimer);
        if (items.length > 1)
          announceTimer = setInterval(() => {
            announceIndex = (announceIndex + 1) % items.length;
            setAnnounceText(items[announceIndex]);
          }, 18000);
      };

      // ── SEARCH ────────────────────────────────────────────────
      function onSearch(val) {
        const drop = document.getElementById("searchDrop");
        const q = val.trim().toLowerCase();
        if (!q) {
          drop.classList.remove("show");
          return;
        }
        const normalize = (s) =>
          (s || "").toLowerCase().replace(/\s+/g, " ").trim();
        const singular = (s) => normalize(s).replace(/\b([a-z]+)s\b/g, "$1");
        const qNorm = normalize(val);
        const qSing = singular(val);
        const results = window.products.filter((p) => {
          const name = normalize(p.name);
          const catId = normalize(p.cat);
          const cat = normalize(catInfo[p.cat]?.label);
          const sub = normalize(p.sub);
          const targets = [name, catId, cat, sub];
          return targets.some((text) => {
            const textSing = singular(text);
            return (
              text.includes(qNorm) ||
              textSing.includes(qNorm) ||
              text.includes(qSing) ||
              textSing.includes(qSing)
            );
          });
        });
        if (!results.length) {
          drop.innerHTML = `<div class="no-res">😕 "${val}" not found</div>`;
        } else {
          drop.innerHTML = results
            .map((p) => {
              const oos = p.active === false;
              const pclosed = window._productsClosed === true && !oos;
              const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
              const dUnit = p.unit;
              const dPrice = p.price;
              return `<div class="sr-item" style="${pclosed ? "opacity:0.85;" : ""}cursor:pointer;" onclick="document.getElementById('searchDrop').classList.remove('show');document.getElementById('searchInput').value='';openDetailModal('${p.cat}','${p.sub}')"><div class="sr-img" style="position:relative;">${p.img ? `<img src="${p.img}" onerror="this.style.display='none'">` : `${p.emoji}`}</div><div style="flex:1"><div class="sr-name">${p.name}${oos ? ` <span style="color:#e74c3c;font-size:11px">(Out of Stock)</span>` : ""}${pclosed ? ` <span style="color:#e74c3c;font-size:11px;">(Closed)</span>` : ""}</div><div class="sr-unit">${dUnit}</div></div><div class="sr-price">₹${dPrice}</div>${p.active !== false && !pclosed ? (hasVariants ? `<button class="sr-add" onclick="event.stopPropagation();addFromSearch(${p.id})" style="display:flex;flex-direction:column;align-items:center;gap:0;line-height:1.2;padding:5px 10px;min-width:56px;"><span style="font-size:12px;font-weight:800;">ADD</span><span style="font-size:9px;font-weight:600;opacity:0.7;">${p.variants.length + (p.unit && p.price ? 1 : 0)} options</span></button>` : `<button class="sr-add" onclick="event.stopPropagation();addFromSearch(${p.id})">ADD</button>`) : p.active !== false && pclosed ? `<button class="sr-add" style="background:#c0392b;cursor:not-allowed;" disabled></button>` : ""}</div>`;
            })
            .join("");
        }
        drop.classList.add("show");
      }
      function addFromSearch(id) {
        const p = window.products.find((x) => x.id === id);
        if (p && Array.isArray(p.variants) && p.variants.length > 0) {
          document.getElementById("searchInput").value = "";
          document.getElementById("searchDrop").classList.remove("show");
          openVariantModal(id);
          return;
        }
        addToCart(id);
        document.getElementById("searchInput").value = "";
        document.getElementById("searchDrop").classList.remove("show");
      }
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-wrap"))
          document.getElementById("searchDrop").classList.remove("show");
      });

      // ── CATEGORIES ────────────────────────────────────────────
      function selCat(cat, el) {
        curCat = cat;
        document
          .querySelectorAll(".cat-card")
          .forEach((c) => c.classList.remove("active"));
        if (el) el.classList.add("active");
        renderProducts();
        setTimeout(() => {
          if (cat === "all") {
            // Scroll to first cat-group (e.g. grocery heading)
            const first = document.querySelector(".cat-group");
            if (first) {
              const hh = document.querySelector("header").offsetHeight || 70;
              window.scrollTo({ top: first.getBoundingClientRect().top + window.scrollY - hh - 8, behavior: "smooth" });
            }
          } else {
            const t = document.getElementById("prodSec");
            if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 80);
      }
      function selCatScroll(cat, el) {
        curCat = cat;
        document
          .querySelectorAll(".cat-card")
          .forEach((c) => c.classList.remove("active"));
        if (el) el.classList.add("active");
        renderProducts();
        setTimeout(() => {
          const t = document.getElementById("cg-" + cat);
          if (t) {
            const hh = document.querySelector("header").offsetHeight + 8;
            window.scrollTo({
              top: t.getBoundingClientRect().top + window.scrollY - hh,
              behavior: "smooth",
            });
          }
        }, 80);
      }

      // ── PRODUCTS ──────────────────────────────────────────────
      window.renderProducts = function () {
        const con = document.getElementById("prodContainer");
        con.innerHTML = "";
        const cats = curCat === "all" ? Object.keys(catInfo) : [curCat];
        let any = false;

        cats.forEach((cat) => {
          const items = window.products.filter(
            (p) =>
              p.cat === cat && (curCat === "all" ? p.visible !== false : true),
          );
          if (!items.length) return;
          any = true;

          const g = document.createElement("div");
          g.className = "cat-group";
          g.id = "cg-" + cat;
          g.innerHTML = `<div class="cat-heading">${catInfo[cat].emoji} ${catInfo[cat].label}</div>`;

          // Group by subcategory
          const subMap = {};
          items.forEach((p) => {
            const sub = (p.sub && p.sub.trim()) ? p.sub.trim() : catInfo[cat].label;
            if (!subMap[sub]) subMap[sub] = [];
            subMap[sub].push(p);
          });

          const subKeys = Object.keys(subMap);
          const hasMultipleSubs = subKeys.length > 1;

          // Helper: render a grid of products
          function makeGrid(prods) {
            const grid = document.createElement("div");
            grid.className = "prod-grid";
            prods.forEach((p) => {
              const card = document.createElement("div");
              card.className = "prod-card" + (p.active === false ? " out-of-stock" : "");
              card.id = "pc-" + p.id;
              card.innerHTML = cardHTML(p);
              if (p.active !== false && window._productsClosed !== true)
                card.addEventListener("click", function (e) {
                  if (!e.target.closest("button")) openDetailModal(p.cat, p.sub);
                });
              grid.appendChild(card);
            });
            return grid;
          }

          if (curCat === "all") {
            // ALL VIEW — subcategory-wise horizontal scroll rows
            // Use ALL products for this cat (ignore visible filter for subMap building)
            const allCatProds = window.products.filter(p => p.cat === cat && p.visible !== false);
            if (!allCatProds.length) return;

            // Rebuild subMap from allCatProds
            const subMapFull = {};
            allCatProds.forEach((p) => {
              const sub = (p.sub && p.sub.trim()) ? p.sub.trim() : (catInfo[cat] ? catInfo[cat].label : "Other");
              if (!subMapFull[sub]) subMapFull[sub] = [];
              subMapFull[sub].push(p);
            });

            const subKeysFull = Object.keys(subMapFull);

            subKeysFull.forEach((sub) => {
              const subProds = subMapFull[sub];
              if (!subProds || !subProds.length) return;

              // Professional subcategory heading row
              const lbl = document.createElement("div");
              lbl.className = "allview-subcat-label";

              const titleWrap = document.createElement("div");
              titleWrap.className = "allview-subcat-title";
              titleWrap.innerHTML = `<div class="allview-subcat-emoji">${getSubEmoji(sub)}</div>${sub}`;

              const seeAllBtn = document.createElement("button");
              seeAllBtn.className = "allview-see-all";
              seeAllBtn.textContent = "See All →";
              seeAllBtn.addEventListener("click", (e) => { e.stopPropagation(); openDetailModal(cat, sub); });

              lbl.appendChild(titleWrap);
              lbl.appendChild(seeAllBtn);
              g.appendChild(lbl);

              // Horizontal scroll wrapper with arrow buttons
              const hWrap = document.createElement("div");
              hWrap.className = "prod-hscroll-wrap";

              const btnLeft = document.createElement("button");
              btnLeft.className = "hscroll-arrow left hidden-arr";
              btnLeft.innerHTML = "&#8249;";
              btnLeft.setAttribute("aria-label", "Scroll left");

              const btnRight = document.createElement("button");
              btnRight.className = "hscroll-arrow right hidden-arr";
              btnRight.innerHTML = "&#8250;";
              btnRight.setAttribute("aria-label", "Scroll right");

              const hScroll = document.createElement("div");
              hScroll.className = "prod-hscroll";

              // Add cards directly
              subProds.forEach((p) => {
                const card = document.createElement("div");
                card.className = "prod-card" + (p.active === false ? " out-of-stock" : "");
                card.id = "pc-" + p.id;
                card.innerHTML = cardHTML(p);
                if (p.active !== false && window._productsClosed !== true) {
                  card.addEventListener("click", function (e) {
                    if (!e.target.closest("button")) openDetailModal(p.cat, p.sub);
                  });
                }
                hScroll.appendChild(card);
              });

              // Arrow scroll logic
              const scrollAmt = 340;
              function updateArrows() {
                const noScroll = hScroll.scrollWidth <= hScroll.clientWidth + 6;
                const atStart = hScroll.scrollLeft <= 4;
                const atEnd = noScroll || (hScroll.scrollLeft + hScroll.clientWidth >= hScroll.scrollWidth - 4);
                btnLeft.classList.toggle("hidden-arr", atStart);
                btnRight.classList.toggle("hidden-arr", atEnd);
              }
              btnLeft.addEventListener("click", () => hScroll.scrollBy({ left: -scrollAmt, behavior: "smooth" }));
              btnRight.addEventListener("click", () => hScroll.scrollBy({ left: scrollAmt, behavior: "smooth" }));
              hScroll.addEventListener("scroll", updateArrows, { passive: true });
              setTimeout(updateArrows, 120);
              window.addEventListener("resize", updateArrows, { passive: true });

              hWrap.appendChild(btnLeft);
              hWrap.appendChild(hScroll);
              hWrap.appendChild(btnRight);
              g.appendChild(hWrap);
            });

          } else if (!hasMultipleSubs) {
            // SPECIFIC CAT, single subcat — flat grid
            g.appendChild(makeGrid(items));

          } else {
            // SPECIFIC CAT, multiple subcats — pills filter grid
            let activeSub = subKeys[0];
            const pillsRow = document.createElement("div");
            pillsRow.className = "subcat-pills";
            const gridWrap = document.createElement("div");
            gridWrap.id = "subgrid-" + cat;
            gridWrap.appendChild(makeGrid(subMap[activeSub]));
            subKeys.forEach((sub, i) => {
              const pill = document.createElement("button");
              pill.className = "subcat-pill" + (i === 0 ? " active" : "");
              pill.innerHTML = `${getSubEmoji(sub)} ${sub}`;
              pill.addEventListener("click", function () {
                pillsRow.querySelectorAll(".subcat-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                activeSub = sub;
                gridWrap.innerHTML = "";
                gridWrap.appendChild(makeGrid(subMap[sub]));
              });
              pillsRow.appendChild(pill);
            });
            g.appendChild(pillsRow);
            g.appendChild(gridWrap);
          }

          con.appendChild(g);
        });
        if (!any)
          con.innerHTML = `<div style="text-align:center;padding:50px;color:#aaa">No products found</div>`;
      };

      function cartKeyFor(pid, vIdx) {
        return vIdx === undefined || vIdx === null ? String(pid) : `${pid}-v${vIdx}`;
      }
      function totalQtyForProduct(pid) {
        return Object.keys(cart).reduce((s, k) => {
          if (k === String(pid) || k.startsWith(pid + "-v")) return s + cart[k].qty;
          return s;
        }, 0);
      }
      function discountInfo(price, mrp) {
        const m = parseFloat(mrp);
        const pr = parseFloat(price);
        const has = !isNaN(m) && m > pr;
        const pct = has ? Math.round(((m - pr) / m) * 100) : 0;
        return { has, pct, m, pr };
      }
      function cardHTML(p) {
        const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
        const oos = p.active === false;
        const pclosed = window._productsClosed === true && !oos;
        const imgWrap = `<div class="pc-img-wrap">${p.img ? `<img src="${p.img}" onerror="this.style.display='none';this.nextSibling.style.display='block'" alt="${p.name}"><span style="display:none;font-size:34px">${p.emoji}</span>` : `<span style="font-size:34px">${p.emoji}</span>`}</div>`;
        const closedOverlayInner = pclosed
          ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none;border-radius:14px;"><span style="background:rgba(180,0,0,0.78);color:#fff;font-size:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:7px 18px;border-radius:50px;box-shadow:0 2px 12px rgba(0,0,0,0.18);">Closed</span></div>`
          : "";
        const cardStyle = `style="position:relative;"`;

        // Display price: base product price always shown first
        const displayUnit = p.unit;
        const displayPrice = p.price;
        const displayMrp = p.mrp;
        const disc = discountInfo(displayPrice, displayMrp);
        const discBadge = disc.has ? `<div class="disc-badge">${disc.pct}%<br>OFF</div>` : "";
        const priceHTML = disc.has
          ? `<div class="pc-price-wrap"><span class="pc-mrp">₹${disc.m}</span><span class="pc-price">₹${displayPrice}</span></div>`
          : `<div class="pc-price-wrap"><span class="pc-price">₹${displayPrice}</span></div>`;

        let actionHTML;
        if (oos) {
          actionHTML = `<button class="oos-btn">Not Available</button>`;
        } else if (pclosed) {
          actionHTML = `<div class="pc-btns" style="pointer-events:none;opacity:0.5;"><button class="btn-add">+ Add</button></div>`;
        } else if (hasVariants) {
          const totalQty = totalQtyForProduct(p.id);
          const optCount = p.variants.length + (p.unit && p.price ? 1 : 0);
          actionHTML = `<div class="pc-btns"><button class="btn-add" onclick="event.stopPropagation();openVariantModal(${p.id})" style="display:flex;flex-direction:column;align-items:center;gap:0;line-height:1.3;padding:4px 10px;min-width:60px;${totalQty > 0 ? 'background:var(--primary);color:#fff;border-color:var(--primary);' : ''}"><span style="font-size:13px;font-weight:800;">${totalQty > 0 ? totalQty + ' in cart' : 'ADD'}</span><span style="font-size:9px;font-weight:600;opacity:0.75;">${optCount} options</span></button></div>`;
        } else {
          const qty = cart[p.id] ? cart[p.id].qty : 0;
          actionHTML = qty > 0
            ? `<div class="qty-ctrl"><button class="qty-btn" onclick="event.stopPropagation();chQty(${p.id},-1)">−</button><span class="qty-num">${qty}</span><button class="qty-btn" onclick="event.stopPropagation();chQty(${p.id},1)">+</button></div>`
            : `<div class="pc-btns"><button class="btn-add" onclick="event.stopPropagation();addToCart(${p.id})">+ Add</button></div>`;
        }

        return `<div ${cardStyle}>${oos ? `<div class="oos-badge">Out of Stock</div>` : discBadge}${closedOverlayInner}${imgWrap}<div class="pc-name">${p.name}</div><div class="pc-unit">${displayUnit}</div><div class="pc-bottom">${priceHTML}<div id="act-${p.id}">${actionHTML}</div></div></div>`;
      }

      function refreshCard(id) {
        const el = document.getElementById("pc-" + id);
        if (!el) return;
        const p = window.products.find((x) => x.id === id);
        if (!p) return;
        el.className =
          "prod-card" + (p.active === false ? " out-of-stock" : "");
        el.innerHTML = cardHTML(p);
        if (p.active !== false && window._productsClosed !== true) {
          el.onclick = function (e) {
            if (!e.target.closest("button")) openDetailModal(p.cat, p.sub);
          };
        } else el.onclick = null;
      }

      // ── DETAIL MODAL ──────────────────────────────────────────
      function openDetailModal(cat, sub) {
        curDetailCat = cat;
        const subs = [
          ...new Set(
            window.products.filter((p) => p.cat === cat).map((p) => p.sub),
          ),
        ];
        curDetailSub = sub || subs[0];
        document.getElementById("dmTitle").textContent =
          catInfo[cat].emoji + " " + catInfo[cat].label;
        renderDMLeft(cat, subs);
        renderDMRight(cat, curDetailSub);
        document.getElementById("detailOverlay").classList.add("open");
        document.body.style.overflow = "hidden";
      }
      window.renderDetailIfOpen = function () {
        if (
          document.getElementById("detailOverlay").classList.contains("open") &&
          curDetailCat
        ) {
          const subs = [
            ...new Set(
              window.products
                .filter((p) => p.cat === curDetailCat)
                .map((p) => p.sub),
            ),
          ];
          renderDMLeft(curDetailCat, subs);
          renderDMRight(curDetailCat, curDetailSub);
        }
      };
      function renderDMLeft(cat, subs) {
        document.getElementById("dmLeft").innerHTML = subs
          .map(function(s) {
            // First product image in this subcategory
            var prod = (window.products || []).find(function(p) {
              return p.cat === cat && p.sub === s && p.img;
            });
            var icon = prod
              ? `<img src="${prod.img}" style="width:38px;height:38px;border-radius:8px;object-fit:contain;display:block;margin:0 auto 4px;background:#f5f5f5;" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="dm-sub-emoji" style="display:none">${getSubEmoji(s)}</span>`
              : `<span class="dm-sub-emoji">${getSubEmoji(s)}</span>`;
            return `<div class="dm-sub-item ${s === curDetailSub ? "active" : ""}" onclick="selectDMSub('${cat}','${s}')">${icon}<div class="dm-sub-lbl">${s}</div></div>`;
          })
          .join("");
      }
      function renderDMRight(cat, sub) {
        const right = document.getElementById("dmRight");
        const items = window.products.filter((p) => p.cat === cat && p.sub === sub);
        const cards = items.map((p) => {
          const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
          const oos = p.active === false;
          const pclosed = window._productsClosed === true && !oos;
          const displayUnit = p.unit;
          const displayPrice = p.price;
          const displayMrp = p.mrp;
          const disc = discountInfo(displayPrice, displayMrp);
          const discBadge = disc.has ? `<div class="disc-badge" style="font-size:9px;padding:3px 4px;">${disc.pct}%<br>OFF</div>` : "";
          const priceHTML = disc.has
            ? `<div style="display:flex;flex-direction:column;gap:1px;"><span style="font-size:10px;color:#999;text-decoration:line-through;">₹${disc.m}</span><span class="dm-prod-price">₹${displayPrice}</span></div>`
            : `<span class="dm-prod-price">₹${displayPrice}</span>`;
          let actionInner;
          if (oos) {
            actionInner = `<button class="dm-oos-btn" style="width:100%;">N/A</button>`;
          } else if (pclosed) {
            actionInner = `<button class="dm-add-btn" style="width:100%;opacity:0.4;cursor:not-allowed;" disabled>ADD</button>`;
          } else if (hasVariants) {
            const totalQty = totalQtyForProduct(p.id);
            const optCount = p.variants.length + (p.unit && p.price ? 1 : 0);
            actionInner = `<button class="dm-add-btn" onclick="openVariantModal(${p.id})" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:0;line-height:1.3;padding:6px 4px;${totalQty > 0 ? 'background:var(--primary);color:#fff;border-color:var(--primary);' : ''}"><span style="font-size:13px;font-weight:800;">${totalQty > 0 ? totalQty+' in cart' : 'ADD'}</span><span style="font-size:9px;font-weight:600;opacity:0.75;">${optCount} options</span></button>`;
          } else {
            const qty = cart[p.id] ? cart[p.id].qty : 0;
            actionInner = qty > 0
              ? `<div class="dm-qty-ctrl" style="width:100%;"><button class="dm-qty-btn" onclick="chQtyDM(${p.id},-1)">−</button><span class="dm-qty-num">${qty}</span><button class="dm-qty-btn" onclick="chQtyDM(${p.id},1)">+</button></div>`
              : `<button class="dm-add-btn" onclick="addToDM(${p.id})" style="width:100%;">ADD</button>`;
          }
          return `<div class="dm-prod-row" id="dmrow-${p.id}" style="position:relative;">${discBadge}${pclosed ? `<div style="position:absolute;inset:0;background:rgba(180,0,0,0.12);border-radius:14px;z-index:2;pointer-events:none;"></div>` : ""}<div class="dm-prod-img">${p.img ? `<img src="${p.img}" onerror="this.style.display='none'" alt="${p.name}">` : `<span style="font-size:28px">${p.emoji}</span>`}</div><div class="dm-prod-info"><div class="dm-prod-name">${p.name}</div><div class="dm-prod-unit">${displayUnit}</div>${priceHTML}</div><div class="dm-prod-action" id="dmact-${p.id}">${actionInner}</div></div>`;
        }).join("");
        right.innerHTML = `<div class="dm-section-title">${getSubEmoji(sub)} ${sub}</div><div class="dm-prod-grid">${cards}</div>`;
      }
      function refreshDMRow(id) {
        const el = document.getElementById("dmact-" + id);
        if (!el) return;
        const p = window.products.find((x) => x.id === id);
        if (!p) return;
        const qty = cart[id] ? cart[id].qty : 0;
        const pclosedR = window._productsClosed === true && p.active !== false;
        el.innerHTML =
          p.active === false
            ? `<button class="dm-oos-btn" style="width:100%;">N/A</button>`
            : pclosedR
              ? `<button class="dm-add-btn" style="width:100%;opacity:0.4;cursor:not-allowed;" disabled>ADD</button>`
              : qty > 0
                ? `<div class="dm-qty-ctrl" style="width:100%;"><button class="dm-qty-btn" onclick="chQtyDM(${id},-1)">−</button><span class="dm-qty-num">${qty}</span><button class="dm-qty-btn" onclick="chQtyDM(${id},1)">+</button></div>`
                : `<button class="dm-add-btn" onclick="addToDM(${id})" style="width:100%;">ADD</button>`;
      }
      function selectDMSub(cat, sub) {
        curDetailSub = sub;
        const subs = [
          ...new Set(
            window.products.filter((p) => p.cat === cat).map((p) => p.sub),
          ),
        ];
        renderDMLeft(cat, subs);
        renderDMRight(cat, sub);
      }
      function addToDM(id) {
        addToCart(id);
        refreshDMRow(id);
        refreshCard(id);
      }
      function chQtyDM(id, d) {
        if (!cart[id]) return;
        cart[id].qty += d;
        if (cart[id].qty <= 0) delete cart[id];
        updateCartUI();
        refreshDMRow(id);
        refreshCard(id);
      }
      function getSubEmoji(sub) {
        const exact = {
          "Dal & Rice": "🫘", "Atta & Flour": "🌾", "Oil & Ghee": "🫙",
          "Sugar & Salt": "🍬", "Milk": "🥛", "Curd & Paneer": "🥣",
          "Butter & Cheese": "🧈", "Biscuits": "🍪", "Chips": "🥔",
          "Instant Food": "🍜", "Namkeen": "🥨", "Snacks": "🍿",
          "Snacks & Chips": "🍟", "Bath & Body": "🧼", "Oral Care": "🦷",
          "Hair Care": "🧴", "Skin Care": "💆", "Grooming": "🪒",
          "Laundry": "🧺", "Kitchen": "🍽️", "Bathroom": "🚽",
          "Cleaning": "🧹", "Grocery": "🛒", "Dairy": "🥛",
          "Beverages": "🧃", "Spices": "🌶️", "Masala": "🌶️",
          "Tea & Coffee": "☕", "Noodles": "🍜", "Bread": "🍞",
          "Eggs": "🥚", "Pulses": "🫘", "Rice": "🍚",
        };
        if (exact[sub]) return exact[sub];
        // keyword partial match
        const s = sub.toLowerCase();
        if (s.includes("chip") || s.includes("wafer") || s.includes("crisps")) return "🥔";
        if (s.includes("biscuit") || s.includes("cookie")) return "🍪";
        if (s.includes("snack") || s.includes("namkeen") || s.includes("fry")) return "🍿";
        if (s.includes("dal") || s.includes("pulse") || s.includes("lentil")) return "🫘";
        if (s.includes("rice") || s.includes("chawal")) return "🍚";
        if (s.includes("atta") || s.includes("flour") || s.includes("wheat")) return "🌾";
        if (s.includes("oil") || s.includes("ghee") || s.includes("butter")) return "🫙";
        if (s.includes("milk") || s.includes("dairy") || s.includes("curd") || s.includes("paneer")) return "🥛";
        if (s.includes("sugar") || s.includes("salt")) return "🍬";
        if (s.includes("spice") || s.includes("masala")) return "🌶️";
        if (s.includes("noodle") || s.includes("pasta") || s.includes("instant")) return "🍜";
        if (s.includes("tea") || s.includes("coffee") || s.includes("beverage") || s.includes("drink")) return "☕";
        if (s.includes("soap") || s.includes("bath") || s.includes("body")) return "🧼";
        if (s.includes("hair")) return "🧴";
        if (s.includes("tooth") || s.includes("oral") || s.includes("dent")) return "🦷";
        if (s.includes("skin") || s.includes("cream") || s.includes("face")) return "💆";
        if (s.includes("shave") || s.includes("groom")) return "🪒";
        if (s.includes("laundry") || s.includes("wash") || s.includes("detergent")) return "🧺";
        if (s.includes("kitchen") || s.includes("utensil") || s.includes("vessel")) return "🍽️";
        if (s.includes("clean") || s.includes("mop") || s.includes("broom")) return "🧹";
        if (s.includes("bread") || s.includes("pav") || s.includes("roti")) return "🍞";
        return "📦";
      }
      function closeDetailIfBg(e) {
        if (e.target === document.getElementById("detailOverlay"))
          closeDetail();
      }
      function closeDetail() {
        document.getElementById("detailOverlay").classList.remove("open");
        document.body.style.overflow = "";
      }

      // ── CART ─────────────────────────────────────────────────
      function addToCart(id) {
        if (!isOpen()) {
          showToast("❌ Store closed! 7AM–10PM");
          return;
        }
        const p = window.products.find((x) => x.id === id);
        if (!p || p.active === false) return;
        cart[id] ? cart[id].qty++ : (cart[id] = { ...p, qty: 1 });
        updateCartUI();
        refreshCard(id);
        if (curVariantProductId === id) renderVariantRows(id);
        showToast(`✅ ${p.name} added!`);
      }
      function chQty(id, d) {
        if (!cart[id]) return;
        cart[id].qty += d;
        if (cart[id].qty <= 0) delete cart[id];
        updateCartUI();
        const m = String(id).match(/^(\d+)-v(\d+)$/);
        if (m) {
          const pid = parseInt(m[1]);
          refreshCard(pid);
          if (curVariantProductId === pid) renderVariantRows(pid);
        } else {
          refreshCard(id);
          if (curVariantProductId === id) renderVariantRows(id);
        }
      }

      // ── VARIANT MODAL ──────────────────────────────────────────
      let curVariantProductId = null;
      function openVariantModal(pid) {
        if (window._productsClosed === true) return;
        const p = window.products.find((x) => x.id === pid);
        if (!p || !Array.isArray(p.variants) || !p.variants.length) return;
        curVariantProductId = pid;
        document.getElementById("vmTitle").textContent = p.name;
        renderVariantRows(pid);
        document.getElementById("variantOverlay").classList.add("open");
        document.body.style.overflow = "hidden";
      }
      function closeVariantModal() {
        document.getElementById("variantOverlay").classList.remove("open");
        document.body.style.overflow = "";
        curVariantProductId = null;
      }
      function closeVariantIfBg(e) {
        if (e.target.id === "variantOverlay") closeVariantModal();
      }
      function renderVariantRows(pid) {
        const p = window.products.find((x) => x.id === pid);
        if (!p) return;
        const body = document.getElementById("vmBody");

        // Build full list: base product first, then variants array
        const allRows = [];
        if (p.unit && p.price) {
          allRows.push({ unit: p.unit, price: p.price, mrp: p.mrp || null, _isBase: true });
        }
        (p.variants || []).forEach((v, i) => allRows.push({ ...v, _vIdx: i }));

        body.innerHTML = allRows.map((v) => {
            const key = v._isBase ? String(pid) : cartKeyFor(pid, v._vIdx);
            const qty = cart[key] ? cart[key].qty : 0;
            const disc = discountInfo(v.price, v.mrp);
            const priceLine = disc.has
              ? `<span class="vm-row-price">₹${v.price}</span><span class="vm-row-mrp">₹${disc.m}</span><span class="vm-row-off">${disc.pct}% off</span>`
              : `<span class="vm-row-price">₹${v.price}</span>`;
            let action;
            if (v._isBase) {
              action = qty > 0
                ? `<div class="qty-ctrl" style="width:auto;"><button class="qty-btn" onclick="chQty(${pid},-1)">−</button><span class="qty-num">${qty}</span><button class="qty-btn" onclick="chQty(${pid},1)">+</button></div>`
                : `<button class="btn-add" onclick="addToCart(${pid})" style="white-space:nowrap;">ADD</button>`;
            } else {
              action = qty > 0
                ? `<div class="qty-ctrl" style="width:auto;"><button class="qty-btn" onclick="chQtyVariant(${pid},${v._vIdx},-1)">−</button><span class="qty-num">${qty}</span><button class="qty-btn" onclick="chQtyVariant(${pid},${v._vIdx},1)">+</button></div>`
                : `<button class="btn-add" onclick="addVariantToCart(${pid},${v._vIdx})" style="white-space:nowrap;">ADD</button>`;
            }
            return `<div class="vm-row"><div class="vm-row-img">${p.img ? `<img src="${p.img}" onerror="this.style.display='none'">` : `<span style="font-size:22px">${p.emoji}</span>`}</div><div class="vm-row-info"><div class="vm-row-unit">${v.unit}</div><div class="vm-row-price-line">${priceLine}</div></div><div class="vm-row-action">${action}</div></div>`;
          })
          .join("");
      }
      function refreshDMRowFor(pid) {
        const el = document.getElementById("dmact-" + pid);
        if (!el) return;
        const p = window.products.find((x) => x.id === pid);
        if (!p) return;
        const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
        if (!hasVariants) {
          refreshDMRow(pid);
          return;
        }
        const oos = p.active === false;
        const pclosed = window._productsClosed === true && !oos;
        if (oos) {
          el.innerHTML = `<button class="dm-oos-btn">N/A</button>`;
          return;
        }
        if (pclosed) {
          el.innerHTML = ``;
          return;
        }
        const totalQty = totalQtyForProduct(pid);
        const optCount = p.variants.length + (p.unit && p.price ? 1 : 0);
        el.innerHTML = `<button class="dm-add-btn" onclick="openVariantModal(${pid})" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:0;line-height:1.3;padding:6px 4px;${totalQty > 0 ? 'background:var(--primary);color:#fff;border-color:var(--primary);' : ''}"><span style="font-size:13px;font-weight:800;">${totalQty > 0 ? totalQty+' in cart' : 'ADD'}</span><span style="font-size:9px;font-weight:600;opacity:0.75;">${optCount} options</span></button>`;
      }
      function addVariantToCart(pid, vIdx) {
        if (!isOpen()) {
          showToast("❌ Store closed! 7AM–10PM");
          return;
        }
        const p = window.products.find((x) => x.id === pid);
        if (!p || p.active === false) return;
        const v = p.variants[vIdx];
        if (!v) return;
        const key = cartKeyFor(pid, vIdx);
        if (cart[key]) {
          cart[key].qty++;
        } else {
          cart[key] = {
            ...p,
            id: key,
            unit: v.unit,
            price: v.price,
            mrp: v.mrp,
            qty: 1,
          };
        }
        updateCartUI();
        refreshCard(pid);
        refreshDMRowFor(pid);
        if (curVariantProductId === pid) renderVariantRows(pid);
        showToast(`✅ ${p.name} (${v.unit}) added!`);
      }
      function chQtyVariant(pid, vIdx, d) {
        const key = cartKeyFor(pid, vIdx);
        if (!cart[key]) return;
        cart[key].qty += d;
        if (cart[key].qty <= 0) delete cart[key];
        updateCartUI();
        refreshCard(pid);
        refreshDMRowFor(pid);
        if (curVariantProductId === pid) renderVariantRows(pid);
      }
      function quickOrder(id) {
        if (!isOpen()) {
          showToast("❌ Store closed! 7AM–10PM");
          return;
        }
        const p = window.products.find((x) => x.id === id);
        if (!p || p.active === false) return;
        cart = {};
        cart[id] = { ...p, qty: 1 };
        updateCartUI();
        renderProducts();
        openCheckout();
      }

      window.updateCartUI = function () {
        const items = Object.values(cart);
        const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
        const cnt = items.reduce((s, i) => s + i.qty, 0);
        const isFreeDel = sub >= 399 || items.length >= 5;
        const baseDel = selectedCheckoutArea ? getAreaDeliveryCharge() : 23;
        const del = sub > 0 ? (isFreeDel ? 0 : baseDel) : 23;
        const grand = sub + del;
        const hdrCartText = document.getElementById("hdrCartText");
        if (cnt > 0) {
          hdrCartText.innerHTML = `<span class="hcb-count">${cnt} ${cnt === 1 ? "item" : "items"}</span><span class="hcb-price">₹${sub}</span>`;
        } else {
          hdrCartText.textContent = "Cart";
        }
        document.getElementById("cSub").textContent = "₹" + sub;
        document.getElementById("cDel").textContent =
          del === 0 ? "FREE 🎉" : "₹" + del;
        document.getElementById("cTotal").textContent = "₹" + grand;
        const di = document.getElementById("delInfo");
        if (sub === 0) di.innerHTML = `🚚 Delivery: <strong>₹${baseDel}</strong>`;
        else if (isFreeDel)
          di.innerHTML =
            '🎉 <strong style="color:#1a9e5c">Free Delivery!</strong>';
        else
          di.innerHTML = `🚚 Delivery: <strong>₹${baseDel}</strong> | ₹${399 - sub} more or ${5 - items.length} more product${5 - items.length === 1 ? "" : "s"} for free!`;
        renderCartItems();
      };

      function renderCartItems() {
        const el = document.getElementById("cItems");
        const items = Object.values(cart);
        if (!items.length) {
          el.innerHTML = `<div class="c-empty"><div class="c-empty-icon">🛒</div><p>Cart empty! Add some items 😊</p></div>`;
          return;
        }
        el.innerHTML = items
          .map(
            (i) =>
              `<div class="c-item"><div class="ci-img">${i.img ? `<img src="${i.img}" onerror="this.style.display='none'">` : `<span>${i.emoji}</span>`}</div><div class="ci-info"><div class="ci-name">${i.name} <span style="font-size:11px;color:#aaa">${i.unit}</span></div><div class="ci-price">₹${i.price} × ${i.qty} = ₹${i.price * i.qty}</div></div><div class="ci-ctrl"><button class="ci-btn" onclick="chQty('${i.id}',-1)">−</button><span class="ci-qty">${i.qty}</span><button class="ci-btn" onclick="chQty('${i.id}',1)">+</button></div></div>`,
          )
          .join("");
      }

      // My order
      function openMyOrders() {
        closeCart();
        if (!currentUser.phone) {
          openProfile();
          showToast("⚠️ Please login first!");
          return;
        }
        document.getElementById("ordersOverlay").classList.add("open");
        document.getElementById("ordersPanel").classList.add("open");
        loadOrderHistory(currentUser.phone);
      }

      function closeMyOrders() {
        document.getElementById("ordersOverlay").classList.remove("open");
        document.getElementById("ordersPanel").classList.remove("open");
        if (orderHistoryUnsub) {
          orderHistoryUnsub();
          orderHistoryUnsub = null;
        }
      }
      function openCart() {
        document.getElementById("cOverlay").classList.add("open");
        document.getElementById("cSidebar").classList.add("open");
        document.body.style.overflow = "hidden";
      }
      function closeCart() {
        document.getElementById("cOverlay").classList.remove("open");
        document.getElementById("cSidebar").classList.remove("open");
        document.body.style.overflow = "";
      }

      // ── CHECKOUT ──────────────────────────────────────────────
      function openCheckout() {
        if (!isOpen()) {
          showToast("❌ Store closed!");
          return;
        }
        if (!Object.keys(cart).length) {
          showToast("❌ Cart empty!");
          return;
        }
        closeCart();
        closeDetail();
        autoFillCheckout();
        renderOrdSum();
        document.getElementById("ckOverlay").classList.add("open");
        document.body.style.overflow = "hidden";
      }
      function closeCheckout() {
        document.getElementById("ckOverlay").classList.remove("open");
        document.body.style.overflow = "";
      }
      function renderOrdSum() {
        const items = Object.values(cart);
        const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
        const cnt = items.reduce((s, i) => s + i.qty, 0);
        const del = (sub >= 399 || items.length >= 5) ? 0 : (selectedCheckoutArea ? getAreaDeliveryCharge() : 23);
        const grand = sub + del;
        let html = `<div class="ord-sum-title">📦 Your Order</div>`;
        items.forEach((i) => {
          html += `<div class="sum-row"><span>${i.emoji} ${i.name} ×${i.qty}</span><span>₹${i.price * i.qty}</span></div>`;
        });
        html += `<hr class="sum-div"><div class="sum-row"><span>Items</span><span>₹${sub}</span></div><div class="sum-row"><span>Delivery</span><span>${del === 0 ? "FREE 🎉" : "₹" + del}</span></div><hr class="sum-div"><div class="sum-total"><span>Total</span><span>₹${grand}</span></div>`;
        document.getElementById("ordSum").innerHTML = html;
      }
      function checkPin(val) {
        const hint = document.getElementById("pinHint");
        const inp = document.getElementById("cPin");
        if (val.length < 6) {
          hint.className = "pin-hint";
          inp.className = "fi";
          return;
        }
        if (val === "431401") {
          hint.className = "pin-hint valid";
          hint.textContent = "✅ Parbhani — Delivery available!";
          inp.className = "fi valid";
        } else {
          hint.className = "pin-hint invalid";
          hint.textContent = "❌ Only Parbhani (431401) delivery";
          inp.className = "fi invalid";
        }
      }

      window.applyAreasToCheckout = function (areas) {
        // Checkout area grid rebuild
        const chkGrid = document.getElementById("chk-area-grid");
        if (chkGrid) {
          const prevSel = selectedCheckoutArea;
          chkGrid.innerHTML = areas
            .map(function (a) {
              const na = !a.available;
              return (
                '<div class="area-btn' +
                (na ? " area-na" : "") +
                '" data-area="' +
                a.name +
                '" ' +
                (na
                  ? 'style="opacity:1.5;pointer-events:none;border-color:#f10505;background:#fff5f5;color:#000;position:relative;"'
                  : "onclick=\"selectAreaChk('" +
                  a.name.replace(/'/g, "\\'") +
                  "')\"") +
                ">" +
                '<span class="area-dot"></span>' +
                a.name +
                (na
                  ? '<span style="position:absolute;bottom:2px;right:6px;font-size:9px;font-weight:800;color:#b91c1c;">🚫 N/A</span>'
                  : "") +
                "</div>"
              );
            })
            .join("");
          // If the selected area is no longer available, reset it and notify the user immediately
          if (prevSel) {
            const btn = chkGrid.querySelector(
              '.area-btn[data-area="' + prevSel + '"]:not(.area-na)',
            );
            if (!btn) {
              selectedCheckoutArea = "";
              const badgeWrap = document.getElementById("chkAreaBadgeWrap");
              const picker = document.getElementById("chkAreaPicker");
              if (badgeWrap) badgeWrap.style.display = "none";
              if (picker) picker.style.display = "block";
              // If checkout is open, warn the user immediately
              const ckOverlay = document.getElementById("ckOverlay");
              if (ckOverlay && ckOverlay.classList.contains("open")) {
                showToast("⚠️ " + prevSel + " is now Not Available. Please select another area.");
              }
            }
          }
        }
        // Profile area grid rebuild
        const pGrid = document.getElementById("pAreaGrid");
        if (pGrid) {
          pGrid.innerHTML = areas
            .map(function (a) {
              const na = !a.available;
              return (
                '<div class="profile-area-btn' +
                (na ? " area-na" : "") +
                '" data-area="' +
                a.name +
                '" ' +
                (na
                  ? 'style="opacity:1.5;pointer-events:none;border-color:#f10505;background:#fff5f5;color:#625252;"'
                  : "onclick=\"selectProfileArea('" +
                  a.name.replace(/'/g, "\\'") +
                  "')\"") +
                ">" +
                '<span class="area-dot"></span>' +
                a.name +
                (na
                  ? '<span style="font-size:9px;font-weight:800;color:#b91c1c;margin-left:4px;">🚫 N/A</span>'
                  : "") +
                "</div>"
              );
            })
            .join("");
        }
      };

      let selectedCheckoutArea = "";
      function getAreaDeliveryCharge() {
        const areas = window._ynAreas || [];
        const areaData = areas.find(a => a.name === selectedCheckoutArea);
        if (areaData && areaData.deliveryCharge !== undefined) return areaData.deliveryCharge;
        return 23; // default fallback
      }
      function selectAreaChk(area) {
        selectedCheckoutArea = area;
        document
          .getElementById("chk-area-grid")
          .querySelectorAll(".area-btn")
          .forEach(function (b) {
            b.classList.toggle("selected", b.dataset.area === area);
          });
        // Collapse picker, show badge
        document.getElementById("chkAreaPicker").style.display = "none";
        document.getElementById("chkAreaBadgeText").textContent = area;
        document.getElementById("chkAreaBadgeWrap").style.display = "block";
        // Refresh order summary with area-based delivery charge
        renderOrdSum();
      }
      function openChkAreaPicker() {
        document.getElementById("chkAreaPicker").style.display = "block";
        document.getElementById("chkAreaBadgeWrap").style.display = "none";
      }
      function filterAreaSearch(gridId, noResultId, query) {
        const grid = document.getElementById(gridId);
        const noRes = document.getElementById(noResultId);
        if (!grid) return;
        const q = query.trim().toLowerCase();
        const btns = grid.querySelectorAll(".area-btn, .profile-area-btn");
        let visible = 0;
        btns.forEach(function (btn) {
          const name = btn.getAttribute("data-area") || "";
          const match = q === "" || name.toLowerCase().includes(q);
          btn.style.display = match ? "" : "none";
          if (match) visible++;
        });
        if (noRes)
          noRes.style.display =
            visible === 0 && q.length > 0 ? "block" : "none";
      }
      async function placeOrder() {
        if (!isOpen()) {
          showToast("❌ Store closed!");
          return;
        }
        const name = document.getElementById("cName").value.trim();
        const phone = document.getElementById("cPhone").value.trim();
        const addr = document.getElementById("cAddr").value.trim();
        const pin = document.getElementById("cPin").value.trim();
        if (!name) {
          showToast("❌ Please enter your name!");
          return;
        }
        if (phone.length !== 10) {
          showToast("❌ Please enter a valid 10-digit number!");
          return;
        }
        if (!addr) {
          showToast("❌ Please enter an address!");
          return;
        }
        if (!selectedCheckoutArea) {
          showToast("❌ Please select your area!");
          return;
        }
        // Check if selected area is still available
        const _areas = window._ynAreas || [];
        if (_areas.length > 0) {
          const _selArea = _areas.find(a => a.name === selectedCheckoutArea);
          if (_selArea && _selArea.available === false) {
            showToast("❌ " + selectedCheckoutArea + " is currently Not Available. Please select another area.");
            // Reset area selection so user picks a new one
            selectedCheckoutArea = "";
            document.getElementById("chkAreaBadgeWrap").style.display = "none";
            document.getElementById("chkAreaPicker").style.display = "block";
            return;
          }
        }
        const fullAddr = selectedCheckoutArea + ", " + addr;
        if (pin !== "431401") {
          showToast("❌ Delivery available only in Parbhani (431401)!");
          return;
        }
        const items = Object.values(cart);
        const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
        const cnt = items.reduce((s, i) => s + i.qty, 0);
        const del = (sub >= 399 || items.length >= 5) ? 0 : getAreaDeliveryCharge();
        const grand = sub + del;
        // Save to Firebase
        const orderData = {
          name,
          phone,
          address: fullAddr,
          pincode: pin,
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            price: i.price,
            qty: i.qty,
            emoji: i.emoji || "📦",
            img: i.img || null,
          })),
          subtotal: sub,
          delivery: del,
          total: grand,
          status: "pending",
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        };
        const orderId = await window.saveOrderToFirebase(orderData);
        // Save user details for next time
        if (!currentUser.phone || !currentUser.name) {
          currentUser = { phone, name, address: fullAddr };
          localStorage.setItem("sqm_user", JSON.stringify(currentUser));
          updateProfileUI();
        }
        closeCheckout();
        cart = {};
        updateCartUI();
        renderProducts();
        document.getElementById("sucOverlay").classList.add("open");
      }

      function closeSuc() {
        document.getElementById("sucOverlay").classList.remove("open");
        document.body.style.overflow = "";
        ["cName", "cPhone", "cAddr", "cPin"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        });
        document.getElementById("pinHint").className = "pin-hint";
        document.getElementById("cPin").className = "fi";
        // Reset area then re-apply saved user area
        selectedCheckoutArea = "";
        document
          .getElementById("chk-area-grid")
          .querySelectorAll(".area-btn")
          .forEach(function (b) {
            b.classList.remove("selected");
          });
        document.getElementById("chk-area-search").value = "";
        filterAreaSearch("chk-area-grid", "chk-area-no-result", "");
        document.getElementById("chkAreaBadgeWrap").style.display = "none";
        document.getElementById("chkAreaPicker").style.display = "block";
        // Re-fill from saved profile
        autoFillCheckout();
      }

      let toastTmr = null;
      function showToast(msg) {
        const t = document.getElementById("toast");
        if (toastTmr) {
          clearTimeout(toastTmr);
          t.classList.remove("show");
        }
        t.textContent = msg;
        void t.offsetWidth;
        t.classList.add("show");
        toastTmr = setTimeout(() => {
          t.classList.remove("show");
          toastTmr = null;
        }, 2500);
      }

      // ── EXPOSE FUNCTIONS CALLED VIA INLINE onclick/oninput/etc. ──
      // (needed because this script is wrapped in an IIFE for file:// compatibility;
      // inline HTML event attributes can only reach functions on window)
      window.addFromSearch = addFromSearch;
      window.addToCart = addToCart;
      window.addToDM = addToDM;
      window.addVariantToCart = addVariantToCart;
      window.chQty = chQty;
      window.chQtyDM = chQtyDM;
      window.chQtyVariant = chQtyVariant;
      window.checkPin = checkPin;
      window.closeCart = closeCart;
      window.closeCheckout = closeCheckout;
      window.closeDetail = closeDetail;
      window.closeDetailIfBg = closeDetailIfBg;
      window.closeMyOrders = closeMyOrders;
      window.closeProfile = closeProfile;
      window.closeSuc = closeSuc;
      window.closeVariantIfBg = closeVariantIfBg;
      window.closeVariantModal = closeVariantModal;
      window.filterAreaSearch = filterAreaSearch;
      window.logoutUser = logoutUser;
      window.onSearch = onSearch;
      window.openCart = openCart;
      window.openCheckout = openCheckout;
      window.openChkAreaPicker = openChkAreaPicker;
      window.openDetailModal = openDetailModal;
      window.openMyOrders = openMyOrders;
      window.openProfile = openProfile;
      window.openProfileAreaPicker = openProfileAreaPicker;
      window.openVariantModal = openVariantModal;
      window.placeOrder = placeOrder;
      window.savePhoneLogin = savePhoneLogin;
      window.saveProfile = saveProfile;
      window.scsNav = scsNav;
      window.selCat = selCat;
      window.selCatScroll = selCatScroll;
      window.selectAreaChk = selectAreaChk;
      window.selectDMSub = selectDMSub;
      window.selectProfileArea = selectProfileArea;
      window.skipPhoneLogin = skipPhoneLogin;

      setupTiming();
      loadUser();
    })();
