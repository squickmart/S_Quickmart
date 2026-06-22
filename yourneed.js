      const WA = "919545148205";
      const S = {
        cr: { cat: "", slot: "ASAP", area: "" },
        pd: { cat: "", slot: "ASAP", fromArea: "", toArea: "" },
      };

      /* ─ SERVICE SWITCH ─ */
      function switchService(s) {
        document
          .querySelectorAll(".section-panel")
          .forEach((p) => p.classList.remove("active"));
        document
          .querySelectorAll(".sn-tab")
          .forEach((t) => t.classList.remove("active"));
        document.getElementById("panel-" + s).classList.add("active");
        document.getElementById("tab-" + s).classList.add("active");
        window.scrollTo({
          top: document.querySelector(".service-nav").offsetTop - 10,
          behavior: "smooth",
        });
      }

      /* ─ STEP HELPERS ─ */
      function panelOf(p) {
        return p === "cr" ? "custom" : "pickup";
      }
      function toggleStep(p, n) {
        const el = document.getElementById("step-" + p + "-" + n);
        const was = el.classList.contains("active");
        document
          .querySelectorAll("#panel-" + panelOf(p) + " .step")
          .forEach((s) => s.classList.remove("active"));
        if (!was) el.classList.add("active");
      }
      function openStep(p, n) {
        document
          .querySelectorAll("#panel-" + panelOf(p) + " .step")
          .forEach((s) => s.classList.remove("active"));
        const el = document.getElementById("step-" + p + "-" + n);
        el.classList.add("active");
        // Scroll only if the step header has gone above the visible area
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          if (rect.top < 116) {
            window.scrollTo({ top: Math.max(0, rect.top + window.pageYOffset - 124), behavior: "smooth" });
          }
        }, 100);
      }

      /* ─ CATEGORY ─ */
      function selectCat(p, cat) {
        S[p].cat = cat;
        document
          .getElementById(p + "-cat-grid")
          .querySelectorAll(".cat-btn")
          .forEach((b) =>
            b.classList.toggle("selected", b.dataset.cat === cat),
          );
        document.getElementById("step-" + p + "-1").classList.remove("active");
        document.getElementById("step-" + p + "-1").classList.add("completed");
        const s2 = document.getElementById("step-" + p + "-2");
        s2.classList.remove("completed");
        openStep(p, 2);
      }

      /* ─ AREA ─ */
      function selectArea(p, area) {
        S[p].area = area;
        document
          .getElementById(p + "-area-grid")
          .querySelectorAll(".area-btn")
          .forEach((b) =>
            b.classList.toggle("selected", b.dataset.area === area),
          );
        // Update delivery charge display for custom request
        if (p === "cr") {
          const areas = window._latestYnAreas || [];
          const areaData = areas.find(a => a.name === area);
          const charge = areaData && areaData.deliveryCharge !== undefined ? areaData.deliveryCharge : 20;
          const delEl = document.getElementById("cr-delivery-charge");
          const totalEl = document.getElementById("cr-total-text");
          if (delEl) delEl.textContent = "₹" + charge;
          if (totalEl) totalEl.textContent = "Item Cost + ₹" + charge;
          S[p].deliveryCharge = charge;
        }
      }
      function selectAreaPD(type, area) {
        if (type === "from") S.pd.fromArea = area;
        else S.pd.toArea = area;
        document
          .getElementById("pd-" + type + "-area-grid")
          .querySelectorAll(".area-btn")
          .forEach((b) =>
            b.classList.toggle("selected", b.dataset.area === area),
          );
      }

      /* ─ TIME SLOT ─ */
      function selectSlot(p, slot) {
        S[p].slot = slot;
        document
          .getElementById(p + "-slot-grid")
          .querySelectorAll(".slot-btn")
          .forEach((b) =>
            b.classList.toggle("selected", b.dataset.slot === slot),
          );
        const cw = document.getElementById(p + "-custom-time");
        if (slot === "custom") cw.classList.add("show");
        else cw.classList.remove("show");
      }
      function finalSlot(p) {
        if (S[p].slot !== "custom") return S[p].slot;
        const t = document.getElementById(p + "_custom_time").value;
        if (!t) {
          showToast("❌ Please select a custom time!");
          return null;
        }
        const [h, m] = t.split(":");
        const hr = parseInt(h),
          ampm = hr >= 12 ? "PM" : "AM",
          d = hr > 12 ? hr - 12 : hr || 12;
        return `Custom — ${d}:${m} ${ampm}`;
      }

      /* ─ ITEMS ─ */
      let crc = 0;
      function initItems() {
        crc = 0;
        document.getElementById("cr-items-wrap").innerHTML = "";
        addCrItem();
      }
      function addCrItem() {
        crc++;
        const w = document.getElementById("cr-items-wrap");
        const d = document.createElement("div");
        d.className = "item-card";
        d.id = "ci-" + crc;
        d.innerHTML = `<div class="item-top">
    <div class="item-num">${crc}</div>
    <input class="item-name-in" type="text" placeholder="Item name (e.g. Boost 500g, Crocin 650)" id="cin-${crc}" autocomplete="off">
    <button class="remove-btn" onclick="removeCrItem(${crc})" ${crc === 1 ? 'style="opacity:0;pointer-events:none"' : ""}>✕</button>
  </div>
  <div class="item-bottom">
    <div class="qty-wrap"><span class="qty-lbl">Qty</span>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="chQty(${crc},-1)">−</button>
        <input class="qty-val" type="number" id="ciq-${crc}" value="1" min="1">
        <button class="qty-btn" onclick="chQty(${crc},1)">+</button>
      </div>
    </div>
    <input class="item-note-in" type="text" placeholder="Brand / size preference..." id="cib-${crc}">
  </div>`;
        w.appendChild(d);
        if (crc > 1) {
          const f = w.querySelector(".remove-btn");
          f.style.opacity = "1";
          f.style.pointerEvents = "auto";
        }
      }
      function removeCrItem(n) {
        document.getElementById("ci-" + n)?.remove();
        const all = document.querySelectorAll("#cr-items-wrap .item-card");
        if (all.length === 1) {
          const b = all[0].querySelector(".remove-btn");
          b.style.opacity = "0";
          b.style.pointerEvents = "none";
        }
      }
      function chQty(n, d) {
        const i = document.getElementById("ciq-" + n);
        if (i) i.value = Math.max(1, (parseInt(i.value) || 1) + d);
      }
      function getItems() {
        return Array.from(
          document.querySelectorAll("#cr-items-wrap .item-card"),
        )
          .map((c) => {
            const id = c.id.split("-").pop();
            const name = document.getElementById("cin-" + id)?.value.trim();
            const qty = document.getElementById("ciq-" + id)?.value || "1";
            const brand = document.getElementById("cib-" + id)?.value.trim();
            return name ? { name, qty, brand } : null;
          })
          .filter(Boolean);
      }

      /* ─ REVIEW CR ─ */
      function reviewCR() {
        const items = getItems();
        const name = document.getElementById("cr_name").value.trim();
        const phone = document.getElementById("cr_phone").value.trim();
        const addr = document.getElementById("cr_address").value.trim();
        if (!S.cr.cat) {
          showToast("❌ Please select a category!");
          openStep("cr", 1);
          return;
        }
        if (!items.length) {
          showToast("❌ Please add at least one item!");
          openStep("cr", 2);
          return;
        }
        if (!name) {
          showToast("❌ Please enter your name!");
          openStep("cr", 3);
          return;
        }
        if (!/^\d{10}$/.test(phone)) {
          showToast("❌ Please enter a valid 10-digit mobile number!");
          openStep("cr", 3);
          return;
        }
        if (!S.cr.area) {
          showToast("❌ Please select your area!");
          openStep("cr", 3);
          return;
        }
        if (!addr) {
          showToast("❌ Please enter your delivery address!");
          openStep("cr", 3);
          return;
        }
        const slot = finalSlot("cr");
        if (!slot) return;
        document.getElementById("step-cr-3").classList.remove("active");
        document.getElementById("step-cr-3").classList.add("completed");
        const iHTML = items
          .map(
            (i) =>
              `<div class="op-row"><span style="color:var(--primary);font-weight:800;flex-shrink:0">•</span><span>${i.name} × ${i.qty}${i.brand ? " — " + i.brand : ""}</span></div>`,
          )
          .join("");
        document.getElementById("cr-preview").innerHTML = `
    <div class="op-title">📋 Order Summary</div>
    <div class="op-sec"><div class="op-sec-label">Category</div><div class="op-row">📦 ${S.cr.cat}</div></div>
    <div class="op-div"></div>
    <div class="op-sec"><div class="op-sec-label">Items (${items.length})</div>${iHTML}</div>
    <div class="op-div"></div>
    <div class="op-sec"><div class="op-sec-label">Delivery Details</div>
      <div class="op-row">👤 ${name} — 📞 ${phone}</div>
      <div class="op-row">📍 ${S.cr.area}</div>
      <div class="op-row">🏠 ${addr}</div>
      <div class="op-row">⏰ ${slot}</div>
    </div>`;
        openStep("cr", 4);
      }

      /* ─ SUBMIT CR ─ */
      async function submitCR() {
        const items = getItems();
        const name = document.getElementById("cr_name").value.trim();
        const phone = document.getElementById("cr_phone").value.trim();
        const addr = document.getElementById("cr_address").value.trim();
        const note = document.getElementById("cr_note").value.trim();
        const slot = finalSlot("cr");
        if (!slot) return;
        if (!items.length || !name || !addr) {
          showToast("❌ Please complete all required fields!");
          return;
        }
        const t = new Date().toLocaleString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "short",
        });
        const iLines = items
          .map(
            (i) =>
              `  • ${i.name} — Qty: ${i.qty}${i.brand ? " (" + i.brand + ")" : ""}`,
          )
          .join("\n");
        let reqId = "------";
        if (window.fbSaveYourNeed) {
          const savedId = await window.fbSaveYourNeed({
            type: "custom_item",
            category: S.cr.cat,
            items,
            name,
            phone,
            area: S.cr.area,
            address: addr,
            deliverySlot: slot,
            note,
            requestedAt: t,
          });
          if (savedId) reqId = savedId.slice(-6).toUpperCase();
        }
        const msg = `🛍️ *NEW CUSTOM REQUEST — S_Quick Mart*
🔖 Request ID: #${reqId}

📂 *Category:* ${S.cr.cat}
👤 *Name:* ${name}
📞 *Phone:* ${phone}
📍 *Area:* ${S.cr.area}
🏠 *Address:* ${addr}
⏰ *Delivery Time:* ${slot}

📦 *Items Requested:*
${iLines}${note ? `\n\n📝 *Note:* ${note}` : ""}

💵 *Payment:* Cash on Delivery
🕐 *Requested At:* ${t}

_Please confirm price & availability._`;
        window.open(
          `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`,
          "_blank",
        );
        document.getElementById("sucMsg").textContent =
          "Your custom item request has been sent on WhatsApp! We'll confirm price and availability shortly. You pay only on delivery. 😊";
        document.getElementById("sucOverlay").classList.add("open");
        resetCR();
      }
      function resetCR() {
        ["cr_name", "cr_phone", "cr_address", "cr_note"].forEach(
          (id) => (document.getElementById(id).value = ""),
        );
        S.cr = { cat: "", slot: "ASAP", area: "" };
        document
          .querySelectorAll("#cr-cat-grid .cat-btn,#cr-area-grid .area-btn")
          .forEach((b) => b.classList.remove("selected"));
        document
          .querySelectorAll("#cr-slot-grid .slot-btn")
          .forEach((b) => b.classList.remove("selected"));
        document
          .querySelector('#cr-slot-grid [data-slot="ASAP"]')
          .classList.add("selected");
        document.getElementById("cr-custom-time").classList.remove("show");
        document
          .querySelectorAll("#panel-custom .step")
          .forEach((s) => s.classList.remove("active", "completed"));
        document.getElementById("step-cr-1").classList.add("active");
        initItems();
      }

      /* ─ REVIEW PD ─ */
      function reviewPD() {
        const item = document.getElementById("pd_item").value.trim();
        const fromAddr = document.getElementById("pd_from_addr").value.trim();
        const fromName = document.getElementById("pd_from_name").value.trim();
        const fromPhone = document.getElementById("pd_from_phone").value.trim();
        const toAddr = document.getElementById("pd_to_addr").value.trim();
        const name = document.getElementById("pd_name").value.trim();
        const phone = document.getElementById("pd_phone").value.trim();
        if (!S.pd.cat) {
          showToast("❌ Please select item type!");
          openStep("pd", 1);
          return;
        }
        if (!item) {
          showToast("❌ Please describe the item!");
          openStep("pd", 1);
          return;
        }
        if (!S.pd.fromArea) {
          showToast("❌ Please select pickup area!");
          openStep("pd", 2);
          return;
        }
        if (!fromAddr) {
          showToast("❌ Please enter pickup address!");
          openStep("pd", 2);
          return;
        }
        if (!fromName) {
          showToast("❌ Please enter pickup person's name!");
          openStep("pd", 2);
          return;
        }
        if (!/^\d{10}$/.test(fromPhone)) {
          showToast("❌ Please enter pickup person's valid mobile number!");
          openStep("pd", 2);
          return;
        }
        if (!S.pd.toArea) {
          showToast("❌ Please select delivery area!");
          openStep("pd", 2);
          return;
        }
        if (!toAddr) {
          showToast("❌ Please enter delivery address!");
          openStep("pd", 2);
          return;
        }
        if (!name) {
          showToast("❌ Please enter your name!");
          openStep("pd", 3);
          return;
        }
        if (!/^\d{10}$/.test(phone)) {
          showToast("❌ Please enter your valid 10-digit mobile!");
          openStep("pd", 3);
          return;
        }
        const slot = finalSlot("pd");
        if (!slot) return;
        document.getElementById("step-pd-3").classList.remove("active");
        document.getElementById("step-pd-3").classList.add("completed");
        const note = document.getElementById("pd_note").value.trim();
        document.getElementById("pd-preview").innerHTML = `
    <div class="op-title">📋 Request Summary</div>
    <div class="op-sec"><div class="op-sec-label">Item Type &amp; Description</div><div class="op-row">📦 ${S.pd.cat} — ${item}</div></div>
    <div class="op-div"></div>
    <div class="op-sec"><div class="op-sec-label">Pickup From</div>
      <div class="op-row">📍 ${S.pd.fromArea} — ${fromAddr}</div>
      <div class="op-row">👤 ${fromName} — 📞 ${fromPhone}</div>
    </div>
    <div class="op-div"></div>
    <div class="op-sec"><div class="op-sec-label">Deliver To</div>
      <div class="op-row">🏁 ${S.pd.toArea} — ${toAddr}</div>
    </div>
    <div class="op-div"></div>
    <div class="op-sec"><div class="op-sec-label">Your Details &amp; Timing</div>
      <div class="op-row">👤 ${name} — 📞 ${phone}</div>
      <div class="op-row">⏰ ${slot}</div>
      ${note ? `<div class="op-row">📝 ${note}</div>` : ""}
    </div>`;
        openStep("pd", 4);
      }

      /* ─ SUBMIT PD ─ */
      async function submitPD() {
        const item = document.getElementById("pd_item").value.trim();
        const fromAddr = document.getElementById("pd_from_addr").value.trim();
        const fromName = document.getElementById("pd_from_name").value.trim();
        const fromPhone = document.getElementById("pd_from_phone").value.trim();
        const toAddr = document.getElementById("pd_to_addr").value.trim();
        const name = document.getElementById("pd_name").value.trim();
        const phone = document.getElementById("pd_phone").value.trim();
        const note = document.getElementById("pd_note").value.trim();
        const slot = finalSlot("pd");
        if (!slot) return;
        if (!fromAddr || !toAddr || !item || !name) {
          showToast("❌ Please complete all required fields!");
          return;
        }
        const t = new Date().toLocaleString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "short",
        });
        let reqId = "------";
        if (window.fbSaveYourNeed) {
          const savedId = await window.fbSaveYourNeed({
            type: "pickup_drop",
            itemType: S.pd.cat,
            itemDesc: item,
            pickupArea: S.pd.fromArea,
            pickupAddr: fromAddr,
            pickupName: fromName,
            pickupPhone: fromPhone,
            dropArea: S.pd.toArea,
            dropAddr: toAddr,
            name,
            phone,
            deliverySlot: slot,
            note,
            requestedAt: t,
          });
          if (savedId) reqId = savedId.slice(-6).toUpperCase();
        }
        const msg = `🏍️ *NEW PICKUP & DROP REQUEST — S_Quick Mart*
🔖 Request ID: #${reqId}

📂 *Item Type:* ${S.pd.cat}
📦 *Description:* ${item}

📍 *Pickup From:*
  Area: ${S.pd.fromArea}
  Address: ${fromAddr}
  Person: ${fromName} — 📞 ${fromPhone}

🏁 *Deliver To:*
  Area: ${S.pd.toArea}
  Address: ${toAddr}

👤 *Your Name:* ${name}
📞 *Your Phone:* ${phone}
⏰ *Pickup Time:* ${slot}${note ? `\n📝 *Instructions:* ${note}` : ""}

💵 *Payment:* Cash on Delivery
🕐 *Requested At:* ${t}

_Please confirm charge & timing._`;
        window.open(
          `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`,
          "_blank",
        );
        document.getElementById("sucMsg").textContent =
          "Your Pickup & Drop request has been sent on WhatsApp! We'll confirm the charge and timing shortly. 😊";
        document.getElementById("sucOverlay").classList.add("open");
        resetPD();
      }
      function resetPD() {
        [
          "pd_item",
          "pd_from_addr",
          "pd_from_name",
          "pd_from_phone",
          "pd_to_addr",
          "pd_note",
          "pd_name",
          "pd_phone",
        ].forEach((id) => (document.getElementById(id).value = ""));
        S.pd = { cat: "", slot: "ASAP", fromArea: "", toArea: "" };
        document
          .querySelectorAll(
            "#pd-cat-grid .cat-btn,#pd-from-area-grid .area-btn,#pd-to-area-grid .area-btn",
          )
          .forEach((b) => b.classList.remove("selected"));
        document
          .querySelectorAll("#pd-slot-grid .slot-btn")
          .forEach((b) => b.classList.remove("selected"));
        document
          .querySelector('#pd-slot-grid [data-slot="ASAP"]')
          .classList.add("selected");
        document.getElementById("pd-custom-time").classList.remove("show");
        document
          .querySelectorAll("#panel-pickup .step")
          .forEach((s) => s.classList.remove("active", "completed"));
        document.getElementById("step-pd-1").classList.add("active");
      }

      function closeSuc() {
        document.getElementById("sucOverlay").classList.remove("open");
      }

      let tT = null;
      function showToast(msg) {
        const t = document.getElementById("toast");
        if (tT) {
          clearTimeout(tT);
          t.classList.remove("show");
        }
        t.textContent = msg;
        void t.offsetWidth;
        t.classList.add("show");
        tT = setTimeout(() => {
          t.classList.remove("show");
          tT = null;
        }, 2800);
      }

      // ── AREA SEARCH FILTER ───────────────────────────────────────
      function filterAreaSearch(gridId, noResultId, query) {
        const grid = document.getElementById(gridId);
        const noRes = document.getElementById(noResultId);
        if (!grid) return;
        const q = query.trim().toLowerCase();
        const btns = grid.querySelectorAll(".area-btn");
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

      initItems();

      // ── FIREBASE AREAS REAL-TIME CONNECT ─────────────────────────
      // This function applies admin-saved areas to the YourNeed page
      function applyAreasToGrids(areas) {
        var grids = [
          {
            id: "cr-area-grid",
            selFn: function (a) {
              selectArea("cr", a);
            },
          },
          {
            id: "pd-from-area-grid",
            selFn: function (a) {
              selectAreaPD("from", a);
            },
          },
          {
            id: "pd-to-area-grid",
            selFn: function (a) {
              selectAreaPD("to", a);
            },
          },
        ];
        grids.forEach(function (g) {
          var grid = document.getElementById(g.id);
          if (!grid) return;

          // Remember current selection
          var sel = grid.querySelector(".area-btn.selected");
          var prevArea = sel ? sel.getAttribute("data-area") : null;

          // Rebuild buttons
          grid.innerHTML = areas
            .map(function (a) {
              var na = !a.available;
              return (
                '<div class="area-btn' +
                (na ? " area-na" : "") +
                '" data-area="' +
                a.name +
                '" ' +
                (na
                  ? 'style="opacity:1.5;pointer-events:none;border-color:#f10505;background:#fff5f5;color:#000000;position:relative;"'
                  : "") +
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

          // Restore selection if still available
          if (prevArea) {
            var btn = grid.querySelector(
              '.area-btn[data-area="' + prevArea + '"]:not(.area-na)',
            );
            if (btn) btn.classList.add("selected");
          }

          // Attach click listeners
          grid
            .querySelectorAll(".area-btn:not(.area-na)")
            .forEach(function (btn) {
              btn.addEventListener("click", function () {
                grid.querySelectorAll(".area-btn").forEach(function (b) {
                  b.classList.remove("selected");
                });
                btn.classList.add("selected");
                g.selFn(btn.getAttribute("data-area"));
              });
            });
        });
      }

      // Expose globally so module script can call directly
      window.applyAreasToGrids = applyAreasToGrids;

      // When areas arrive from Firebase via event fallback
      document.addEventListener("ynAreasUpdated", function (e) {
        applyAreasToGrids(e.detail);
      });

      // If Firebase already fired before this script loaded, apply cached areas now
      if (window._latestYnAreas && window._latestYnAreas.length > 0) {
        applyAreasToGrids(window._latestYnAreas);
      }
    