(() => {
  "use strict";

  const PAGE_SIZE = 18;
  const SLIDE_INTERVAL = 8000;
  const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

  const MUTATIONS = [
    "Ember",
    "Transcendent",
    "Inferno",
    "Gigantic",
    "Iridescent",
    "Everchanted",
  ];

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const grid = document.querySelector(".pet-grid");
  const catalog = document.querySelector(".catalog");
  const workspace = document.querySelector(".workspace");
  const slideControls = document.querySelector(".slide-controls");

  if (!grid || !catalog || !workspace) {
    console.error("Required catalog elements were not found.");
    return;
  }

  let db;
  let state = {
    version: 2,
    pets: [],
    requests: [],
    photos: [],
  };

  let currentView = "sell";
  let page = 0;
  let selectedPhotoId = "";
  let busy = false;
  let ready = false;
  let slideTimer = null;
  let slideAnimation = null;

  const $ = (id) => document.getElementById(id);

  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  const makeId = () => crypto.randomUUID();

  const numberFormat = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  });

  const getItems = () => (currentView === "sell" ? state.pets : state.requests);

  const getPageCount = () =>
    Math.max(1, Math.ceil(getItems().length / PAGE_SIZE));

  const mutationClass = (mutation) =>
    MUTATIONS.includes(mutation) ? mutation.toLowerCase() : "any";

  // -------------------------
  // ADMIN STYLES
  // -------------------------

  const style = document.createElement("style");

  style.textContent = `
    [hidden] {
      display: none !important;
    }

    .admin-tools {
      width: min(100%, 1440px);
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .view-nav,
    .tool-actions,
    .admin-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .admin-btn,
    .view-button,
    .quantity-button {
      border: 1px solid #30435f;
      border-radius: 8px;
      padding: 10px 14px;
      background: #142238;
      color: #e5efff;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    .admin-btn:hover,
    .view-button:hover,
    .quantity-button:hover {
      background: #1b304d;
    }

    .view-button[aria-pressed="true"],
    .admin-btn.primary {
      background: #3d91ed;
      color: #06111f;
      border-color: #3d91ed;
      font-weight: 700;
    }

    .admin-btn.danger {
      background: #29171e;
      border-color: #69323f;
      color: #ffb1bd;
    }

    button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .admin-panel {
      width: min(100%, 1440px);
      padding: 24px;
      background: #0d1420;
      border: 1px solid #253247;
      border-radius: 16px;
    }

    .admin-heading {
      margin: 0 0 8px;
      font-size: 22px;
    }

    .admin-note {
      margin: 0 0 18px;
      color: #8191a8;
      font-size: 13px;
      line-height: 1.6;
    }

    .admin-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 28px;
    }

    .admin-fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .admin-field {
      display: flex;
      flex-direction: column;
      gap: 7px;
      color: #adbed5;
      font-size: 12px;
    }

    .admin-field.full {
      grid-column: 1 / -1;
    }

    .admin-field input,
    .admin-field select {
      width: 100%;
      min-width: 0;
      padding: 11px;
      border: 1px solid #30405a;
      border-radius: 8px;
      background: #080e18;
      color: #f2f6fc;
      font: inherit;
      font-size: 14px;
    }

    .admin-field input:focus,
    .admin-field select:focus {
      outline: 2px solid #59a7ff;
      outline-offset: 2px;
    }

    .admin-actions {
      margin-top: 16px;
    }

    .admin-section-title {
      margin: 0 0 12px;
      font-size: 15px;
    }

    .mutation-picker {
      margin: 18px 0 0;
      padding: 14px;
      border: 1px solid #30405a;
      border-radius: 10px;
    }

    .mutation-picker legend {
      padding: 0 6px;
      color: #adbed5;
      font-size: 12px;
    }

    .mutation-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 12px;
    }

    .admin-check {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ccd9ec;
      font-size: 13px;
    }

    .admin-check input {
      accent-color: #59a7ff;
    }

    .photo-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
      gap: 9px;
      max-height: 250px;
      overflow: auto;
      margin: 14px 0;
      padding: 3px;
    }

    .gallery-item {
      aspect-ratio: 1;
      overflow: hidden;
      padding: 7px;
      border: 2px solid #26364c;
      border-radius: 10px;
      background: #080e18;
      cursor: pointer;
    }

    .gallery-item[aria-pressed="true"] {
      border-color: #59a7ff;
      background: #13243b;
    }

    .gallery-item img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .photo-selection {
      color: #9eb3cd;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .admin-stock {
      margin-top: 26px;
      padding-top: 20px;
      border-top: 1px solid #253247;
    }

    .stock-list {
      display: grid;
      gap: 9px;
      max-height: 420px;
      overflow: auto;
    }

    .stock-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 12px;
      background: #101a29;
      border-radius: 10px;
    }

    .stock-row-info {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .stock-row-name {
      font-size: 14px;
      overflow-wrap: anywhere;
    }

    .stock-row-meta {
      color: #8191a8;
      font-size: 12px;
      line-height: 1.5;
    }

    .stock-row-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px;
    }

    .quantity-control {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .quantity-button {
      width: 32px;
      height: 32px;
      padding: 0;
      font-size: 18px;
    }

    .quantity-value {
      min-width: 24px;
      text-align: center;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }

    .admin-message {
      min-height: 20px;
      margin: 14px 0 0;
      color: #9fcaff;
      font-size: 13px;
      line-height: 1.5;
    }

    .admin-message[data-error="true"] {
      color: #ff9fab;
    }

    .catalog-empty {
      grid-column: 1 / -1;
      grid-row: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1cqw;
      color: #8191a8;
      font-size: 1.1cqw;
      text-align: center;
    }

    .catalog-empty strong {
      color: #dce7f7;
      font-size: 2cqw;
    }

    .slide-controls {
      flex-wrap: wrap;
    }

    .slide-button:not(:disabled) {
      cursor: pointer;
    }

    .auto-button {
      border: 1px solid #30435f;
      border-radius: 8px;
      padding: 8px 10px;
      background: #101722;
      color: #adbed5;
      font: inherit;
      font-size: 11px;
      cursor: pointer;
    }

    body.capture-mode .admin-tools,
    body.capture-mode .admin-panel {
      display: none !important;
    }

    @media (max-width: 800px) {
      .admin-layout {
        grid-template-columns: 1fr;
      }

      .admin-panel {
        padding: 18px;
      }
    }

    @media (max-width: 480px) {
      .admin-fields {
        grid-template-columns: 1fr;
      }

      .stock-row {
        flex-direction: column;
        align-items: flex-start;
      }

      .admin-tools {
        justify-content: center;
      }
    }

    @media print {
      .admin-tools,
      .admin-panel {
        display: none !important;
      }
    }
  `;

  document.head.append(style);

  // -------------------------
  // PANEL MARKUP
  // -------------------------

  const tools = document.createElement("div");
  tools.className = "admin-tools";

  tools.innerHTML = `
    <nav class="view-nav" aria-label="Catalog mode">
      <button type="button" class="view-button"
        data-view="sell" aria-pressed="true">
        Jual Pet
      </button>

      <button type="button" class="view-button"
        data-view="buy" aria-pressed="false">
        Beli Pet
      </button>
    </nav>

    <div class="tool-actions">
      <button type="button" class="admin-btn" id="toggle-admin"
        aria-expanded="false" aria-controls="admin-panel">
        Manage stock
      </button>

      <button type="button" class="admin-btn" id="capture-button">
        Screenshot mode
      </button>
    </div>
  `;

  const panel = document.createElement("section");
  panel.className = "admin-panel";
  panel.id = "admin-panel";
  panel.hidden = true;

  panel.innerHTML = `
    <h1 class="admin-heading" id="manager-title">Stock Manager</h1>

    <p class="admin-note">
      Data dan foto tersimpan hanya di browser ini.
      Panel ini tidak dilindungi login.
      Tutup panel untuk melanjutkan slide otomatis.
    </p>

    <div class="admin-layout">
      <form id="pet-form">
        <h2 class="admin-section-title" id="form-title">Add pet</h2>
        <input type="hidden" id="pet-id">

        <div class="admin-fields">
          <label class="admin-field full">
            Pet name
            <input id="pet-name" type="text"
              maxlength="60" required placeholder="Raccoon">
          </label>

          <label class="admin-field">
            Weight (kg)
            <input id="pet-weight" type="number"
              min="0.01" max="999999" step="0.01" required>
          </label>

          <label class="admin-field" id="stock-field">
            Stock
            <input id="pet-stock" type="number"
              min="0" max="999999" step="1" value="1" required>
          </label>

          <label class="admin-field" id="sell-mutation-field">
            Mutation
            <select id="pet-mutation">
              ${MUTATIONS.map(
                (mutation) => `
                  <option value="${mutation}">${mutation}</option>
                `,
              ).join("")}
            </select>
          </label>

          <label class="admin-field">
            <span id="price-label">Price (tokens)</span>
            <input id="pet-price" type="number"
              min="0" max="999999999" step="1" required>
          </label>
        </div>

        <fieldset class="mutation-picker" id="buy-mutation-field" hidden>
          <legend>Accepted mutations</legend>

          <label class="admin-check">
            <input type="checkbox" id="any-mutation" checked>
            Any mutation
          </label>

          <div class="mutation-options">
            ${MUTATIONS.map(
              (mutation) => `
                <label class="admin-check">
                  <input type="checkbox"
                    name="wanted-mutation" value="${mutation}">
                  ${mutation}
                </label>
              `,
            ).join("")}
          </div>
        </fieldset>

        <div class="admin-actions">
          <button class="admin-btn primary" type="submit" id="save-pet">
            Save pet
          </button>

          <button class="admin-btn" type="button" id="reset-form">
            Clear / Cancel
          </button>
        </div>
      </form>

      <section>
        <h2 class="admin-section-title">Photo library</h2>

        <label class="admin-field">
          Upload pet photo
          <input id="photo-upload" type="file"
            accept="image/png,image/jpeg,image/webp">
        </label>

        <p class="admin-note" style="margin:8px 0">
          PNG, JPG atau WebP. Maksimal 5 MB per foto.
          Pilih foto sebelum menyimpan pet.
          Library foto dipakai bersama oleh halaman jual dan beli.
        </p>

        <div class="photo-gallery" id="photo-gallery"></div>

        <div class="photo-selection" id="photo-selection">
          No photo selected.
        </div>

        <div class="admin-actions">
          <button class="admin-btn" type="button" id="clear-photo">
            Clear selection
          </button>

          <button class="admin-btn danger" type="button" id="delete-photo">
            Delete selected photo
          </button>
        </div>
      </section>
    </div>

    <p class="admin-message" id="admin-message"
      role="status" aria-live="polite"></p>

    <section class="admin-stock">
      <h2 class="admin-section-title" id="stock-title">Your stock</h2>
      <div class="stock-list" id="stock-list"></div>
    </section>
  `;

  workspace.insertBefore(tools, catalog);
  workspace.append(panel);

  const form = $("pet-form");

  function notify(text, error = false) {
    $("admin-message").textContent = text;
    $("admin-message").dataset.error = String(error);
  }

  // -------------------------
  // DATABASE + MIGRATION
  // -------------------------

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("pet-stock-catalog", 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore("app");
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);

      request.onblocked = () => {
        notify("Tutup tab katalog lain lalu reload.", true);
      };
    });
  }

  function readState() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("app", "readonly");
      const request = transaction.objectStore("app").get("state");

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function writeState(next) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("app", "readwrite");

      transaction.objectStore("app").put(next, "state");

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error || new Error("Storage transaction aborted."));
    });
  }

  function migrateState(saved) {
    const source = saved || {};
    const pets = Array.isArray(source.pets) ? source.pets : [];

    return {
      version: 2,

      pets: pets.map((pet) => {
        const { age, sold, stock, ...remaining } = pet;

        return {
          ...remaining,
          stock: Number.isInteger(stock)
            ? Math.max(0, Math.min(999999, stock))
            : sold
              ? 0
              : 1,
        };
      }),

      requests: Array.isArray(source.requests) ? source.requests : [],

      photos: Array.isArray(source.photos) ? source.photos : [],
    };
  }

  async function commit(next) {
    await writeState(next);
    state = next;
    renderAll();
    restartAutoSlide();
  }

  function syncFormControls() {
    const buying = currentView === "buy";

    $("pet-stock").disabled = busy || !ready || buying;
    $("pet-stock").required = !buying;

    $("pet-mutation").disabled = busy || !ready || buying;
    $("pet-mutation").required = !buying;

    $("any-mutation").disabled = busy || !ready || !buying;

    panel.querySelectorAll('[name="wanted-mutation"]').forEach((input) => {
      input.disabled = busy || !ready || !buying || $("any-mutation").checked;
    });
  }

  function setBusy(value) {
    busy = value;

    panel.querySelectorAll("button, input, select").forEach((control) => {
      control.disabled = value || !ready;
    });

    tools.querySelectorAll("[data-view]").forEach((button) => {
      button.disabled = value || !ready;
    });

    syncFormControls();
  }

  async function runAction(action) {
    if (busy || !ready) return;

    setBusy(true);

    try {
      await action();
    } catch (error) {
      console.error(error);
      notify(
        "Perubahan gagal disimpan. Penyimpanan browser mungkin penuh atau tidak tersedia.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }

  // -------------------------
  // CARD RENDERING
  // -------------------------

  function renderVisual(item) {
    const photo = state.photos.find((entry) => entry.id === item.photoId);

    if (photo) {
      return `
        <img class="pet-image"
          src="${escapeHTML(photo.dataUrl)}"
          alt="${escapeHTML(item.name)}">
      `;
    }

    return `
      <div class="photo-placeholder">
        <svg aria-hidden="true">
          <use href="#icon-photo"></use>
        </svg>
        <span>Pet photo</span>
      </div>
    `;
  }

  function renderBadge(mutation) {
    return `
      <span class="mutation mutation--${mutationClass(mutation)}">
        ${escapeHTML(mutation)}
      </span>
    `;
  }

  function renderPrice(price) {
    return `
      <div class="price" aria-label="${Number(price)} tokens">
        <svg class="token-icon" aria-hidden="true">
          <use href="#icon-token"></use>
        </svg>
        ${numberFormat.format(price)}
      </div>
    `;
  }

  function renderSellCard(pet, position) {
    return `
      <article class="pet-card${pet.stock === 0 ? " is-sold" : ""}">
        <div class="pet-visual">
          <span class="stock-id">${position}</span>

          ${renderVisual(pet)}

          <div class="sold-label"><span>SOLD</span></div>
        </div>

        <div class="pet-info">
          <h2 class="pet-name">${escapeHTML(pet.name)}</h2>

          <div class="mutation-list">
            ${renderBadge(pet.mutation)}
          </div>

          <div class="pet-bottom">
            <dl class="pet-stats">
              <div class="stat">
                <dt>Weight</dt>
                <dd>
                  ${numberFormat.format(pet.weight)}
                  <span class="unit">kg</span>
                </dd>
              </div>

              <div class="stat">
                <dt>Stock</dt>
                <dd>${pet.stock}</dd>
              </div>
            </dl>

            ${renderPrice(pet.price)}
          </div>
        </div>
      </article>
    `;
  }

  function renderBuyCard(pet, position) {
    const mutations = pet.anyMutation ? ["Any mutation"] : pet.mutations;

    return `
      <article class="pet-card buy-card">
        <div class="pet-visual">
          <span class="stock-id">${position}</span>
          <span class="trade-you">YOU</span>

          ${renderVisual(pet)}
        </div>

        <div class="pet-info">
          <h2 class="pet-name">${escapeHTML(pet.name)}</h2>

          <div class="mutation-list">
            ${mutations.map(renderBadge).join("")}
          </div>

          <div class="buy-weight">
            Weight:
            <span>${numberFormat.format(pet.weight)} kg</span>
          </div>

          <div class="buy-offer">
            <span class="trade-me">ME</span>
            ${renderPrice(pet.price)}
          </div>
        </div>
      </article>
    `;
  }

  let autoEnabled = true;

  function renderSlideControls() {
    if (!slideControls) return;

    const totalPages = getPageCount();

    slideControls.innerHTML = `
      <button class="slide-button" type="button"
        data-page="previous" aria-label="Previous slide"
        ${totalPages <= 1 ? "disabled" : ""}>
        &#8592;
      </button>

      <div class="slide-counter">
        <span>${String(page + 1).padStart(2, "0")}</span>
        / ${String(totalPages).padStart(2, "0")}
      </div>

      <button class="slide-button" type="button"
        data-page="next" aria-label="Next slide"
        ${totalPages <= 1 ? "disabled" : ""}>
        &#8594;
      </button>

      <button class="auto-button" type="button"
        data-auto aria-pressed="${autoEnabled}">
        Auto: ${autoEnabled ? "ON · 8s" : "OFF"}
      </button>
    `;
  }

  function renderCatalog(animate = false) {
    const items = getItems();
    const totalPages = getPageCount();

    page = Math.max(0, Math.min(page, totalPages - 1));

    if (slideAnimation) {
      slideAnimation.cancel();
      slideAnimation = null;
    }

    if (!items.length) {
      grid.innerHTML = `
        <div class="catalog-empty">
          <strong>
            ${currentView === "sell" ? "No pets in stock" : "No wanted pets"}
          </strong>

          <span>
            ${
              currentView === "sell"
                ? "Tambahkan pet melalui Manage stock."
                : "Tambahkan pet yang dicari melalui Manage wanted pets."
            }
          </span>
        </div>
      `;
    } else {
      const visible = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      grid.innerHTML = visible
        .map((item, index) => {
          const position = String(page * PAGE_SIZE + index + 1).padStart(
            2,
            "0",
          );

          return currentView === "sell"
            ? renderSellCard(item, position)
            : renderBuyCard(item, position);
        })
        .join("");
    }

    renderSlideControls();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (animate && !reducedMotion && typeof grid.animate === "function") {
      slideAnimation = grid.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: 450,
          easing: "ease-out",
        },
      );
    }
  }

  function renderGallery() {
    $("photo-gallery").innerHTML = state.photos
      .map(
        (photo) => `
          <button type="button" class="gallery-item"
            data-photo-id="${escapeHTML(photo.id)}"
            aria-label="Select ${escapeHTML(photo.name)}"
            aria-pressed="${photo.id === selectedPhotoId}"
            ${busy || !ready ? "disabled" : ""}>
            <img src="${escapeHTML(photo.dataUrl)}"
              alt="${escapeHTML(photo.name)}">
          </button>
        `,
      )
      .join("");

    const selected = state.photos.find((photo) => photo.id === selectedPhotoId);

    $("photo-selection").textContent = selected
      ? `Selected: ${selected.name}`
      : "No photo selected.";
  }

  function renderStock() {
    const buying = currentView === "buy";
    const items = getItems();

    $("stock-title").textContent =
      `${buying ? "Wanted pets" : "Your stock"} (${items.length})`;

    if (!items.length) {
      $("stock-list").innerHTML = `
        <p class="admin-note">Belum ada pet.</p>
      `;
      return;
    }

    $("stock-list").innerHTML = items
      .map((pet) => {
        const mutationText = buying
          ? pet.anyMutation
            ? "Any mutation"
            : pet.mutations.join(" / ")
          : pet.mutation;

        return `
          <div class="stock-row">
            <div class="stock-row-info">
              <span class="stock-row-name">
                ${escapeHTML(pet.name)}
                ${!buying && pet.stock === 0 ? " · SOLD" : ""}
              </span>

              <span class="stock-row-meta">
                ${numberFormat.format(pet.weight)} kg
                · ${escapeHTML(mutationText)}
                · ${numberFormat.format(pet.price)} tokens
                ${!buying ? ` · Stock ${pet.stock}` : ""}
              </span>
            </div>

            <div class="stock-row-actions">
              ${
                !buying
                  ? `
                <div class="quantity-control">
                  <button type="button" class="quantity-button"
                    data-quantity="${escapeHTML(pet.id)}"
                    data-delta="-1"
                    aria-label="Kurangi stok ${escapeHTML(pet.name)}"
                    ${busy || !ready || pet.stock === 0 ? "disabled" : ""}>
                    −
                  </button>

                  <span class="quantity-value">${pet.stock}</span>

                  <button type="button" class="quantity-button"
                    data-quantity="${escapeHTML(pet.id)}"
                    data-delta="1"
                    aria-label="Tambah stok ${escapeHTML(pet.name)}"
                    ${busy || !ready || pet.stock >= 999999 ? "disabled" : ""}>
                    +
                  </button>
                </div>
              `
                  : ""
              }

              <button type="button" class="admin-btn"
                data-edit="${escapeHTML(pet.id)}"
                ${busy || !ready ? "disabled" : ""}>
                Edit
              </button>

              <button type="button" class="admin-btn danger"
                data-delete="${escapeHTML(pet.id)}"
                ${busy || !ready ? "disabled" : ""}>
                Delete
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderAll() {
    renderCatalog();
    renderGallery();
    renderStock();
  }

  // -------------------------
  // VIEW + FORM
  // -------------------------

  function resetForm() {
    form.reset();

    $("pet-id").value = "";
    $("pet-stock").value = "1";
    $("any-mutation").checked = true;

    selectedPhotoId = "";

    const buying = currentView === "buy";

    $("form-title").textContent = buying ? "Add wanted pet" : "Add pet";

    $("save-pet").textContent = buying ? "Save wanted pet" : "Save pet";

    syncFormControls();
    renderGallery();
  }

  function updateViewUI() {
    const buying = currentView === "buy";

    tools.querySelectorAll("[data-view]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.view === currentView),
      );
    });

    $("toggle-admin").textContent = buying
      ? "Manage wanted pets"
      : "Manage stock";

    $("manager-title").textContent = buying
      ? "Wanted Pet Manager"
      : "Stock Manager";

    $("price-label").textContent = buying
      ? "Tokens I will pay"
      : "Price (tokens)";

    $("stock-field").hidden = buying;
    $("sell-mutation-field").hidden = buying;
    $("buy-mutation-field").hidden = !buying;

    const label = document.querySelector(".workspace-label");

    if (label) {
      label.innerHTML = `
        <span class="workspace-dot"></span>
        ${buying ? "Buying Pet Catalog" : "Selling Pet Catalog"}
      `;
    }

    const note = document.querySelector(".toolbar-note");

    if (note) {
      note.textContent = "16:9 canvas · 18 pets per slide · auto 8s";
    }

    catalog.setAttribute(
      "aria-label",
      buying ? "Wanted pet catalog" : "Pet stock catalog",
    );

    document.title = buying ? "Wanted Pet Catalog" : "Pet Stock Catalog";
  }

  function switchView(view) {
    if (busy || !ready || view === currentView) return;

    currentView = view;
    page = 0;

    updateViewUI();
    resetForm();
    renderAll();
    restartAutoSlide();

    notify(
      view === "sell" ? "Halaman jual pet." : "Halaman pet yang ingin dibeli.",
    );
  }

  tools.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) switchView(button.dataset.view);
  });

  $("any-mutation").addEventListener("change", syncFormControls);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (busy || !ready || !form.reportValidity()) return;

    const buying = currentView === "buy";
    const key = buying ? "requests" : "pets";

    const id = $("pet-id").value;
    const name = $("pet-name").value.trim();
    const weight = Number($("pet-weight").value);
    const price = Number($("pet-price").value);
    const stock = Number($("pet-stock").value);
    const mutation = $("pet-mutation").value;
    const anyMutation = $("any-mutation").checked;

    const mutations = [
      ...panel.querySelectorAll('[name="wanted-mutation"]:checked'),
    ].map((input) => input.value);

    if (
      !name ||
      name.length > 60 ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 999999 ||
      !Number.isInteger(price) ||
      price < 0 ||
      price > 999999999
    ) {
      notify("Isi data pet dengan benar.", true);
      return;
    }

    if (
      !buying &&
      (!Number.isInteger(stock) ||
        stock < 0 ||
        stock > 999999 ||
        !MUTATIONS.includes(mutation))
    ) {
      notify("Stok atau mutasi tidak valid.", true);
      return;
    }

    if (buying && !anyMutation && !mutations.length) {
      notify("Pilih minimal satu mutasi atau Any mutation.", true);
      return;
    }

    if (!state.photos.some((photo) => photo.id === selectedPhotoId)) {
      notify("Upload atau pilih foto pet terlebih dahulu.", true);
      return;
    }

    const item = {
      id: id || makeId(),
      name,
      weight,
      price,
      photoId: selectedPhotoId,

      ...(buying
        ? {
            anyMutation,
            mutations: anyMutation ? [] : mutations,
          }
        : {
            stock,
            mutation,
          }),
    };

    runAction(async () => {
      const next = structuredClone(state);

      if (id) {
        const index = next[key].findIndex((pet) => pet.id === id);

        if (index === -1) {
          notify("Pet ini sudah tidak ada.", true);
          return;
        }

        next[key][index] = item;
      } else {
        next[key].push(item);
        page = Math.floor((next[key].length - 1) / PAGE_SIZE);
      }

      await commit(next);
      resetForm();

      notify(id ? "Pet diperbarui." : "Pet ditambahkan.");
    });
  });

  $("reset-form").addEventListener("click", () => {
    resetForm();
    notify("Form dibersihkan.");
  });

  $("stock-list").addEventListener("click", (event) => {
    if (busy || !ready) return;

    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    const quantityButton = event.target.closest("[data-quantity]");

    const key = currentView === "sell" ? "pets" : "requests";

    if (quantityButton && currentView === "sell") {
      if (quantityButton.disabled) return;

      const id = quantityButton.dataset.quantity;
      const delta = Number(quantityButton.dataset.delta);

      runAction(async () => {
        const next = structuredClone(state);
        const pet = next.pets.find((item) => item.id === id);

        if (!pet) return;

        pet.stock = Math.max(0, Math.min(999999, pet.stock + delta));

        await commit(next);

        if ($("pet-id").value === id) {
          $("pet-stock").value = pet.stock;
        }

        notify(
          `${pet.name}: stok ${pet.stock}${pet.stock === 0 ? " · SOLD" : ""}`,
        );
      });

      return;
    }

    if (editButton) {
      const pet = state[key].find(
        (item) => item.id === editButton.dataset.edit,
      );

      if (!pet) return;

      $("pet-id").value = pet.id;
      $("pet-name").value = pet.name;
      $("pet-weight").value = pet.weight;
      $("pet-price").value = pet.price;

      if (currentView === "sell") {
        $("pet-stock").value = pet.stock;
        $("pet-mutation").value = pet.mutation;
      } else {
        $("any-mutation").checked = pet.anyMutation;

        panel.querySelectorAll('[name="wanted-mutation"]').forEach((input) => {
          input.checked = pet.mutations.includes(input.value);
        });
      }

      selectedPhotoId = pet.photoId;

      $("form-title").textContent =
        currentView === "sell" ? "Edit pet" : "Edit wanted pet";

      $("save-pet").textContent = "Update pet";

      syncFormControls();
      renderGallery();
      $("pet-name").focus();

      notify(`Editing ${pet.name}.`);
      return;
    }

    if (deleteButton) {
      const pet = state[key].find(
        (item) => item.id === deleteButton.dataset.delete,
      );

      if (!pet || !window.confirm(`Hapus "${pet.name}"?`)) return;

      runAction(async () => {
        const next = structuredClone(state);

        next[key] = next[key].filter((item) => item.id !== pet.id);

        await commit(next);

        if ($("pet-id").value === pet.id) resetForm();

        notify("Pet dihapus. Foto tetap ada di library.");
      });
    }
  });

  // -------------------------
  // PHOTO LIBRARY
  // -------------------------

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);

      reader.readAsDataURL(file);
    });
  }

  function validateImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        if (image.naturalWidth && image.naturalHeight) {
          resolve();
        } else {
          reject(new Error("Invalid image."));
        }
      };

      image.onerror = () => reject(new Error("Invalid image."));
      image.src = dataUrl;
    });
  }

  $("photo-upload").addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (!file || busy || !ready) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      notify("Gunakan PNG, JPG atau WebP.", true);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      notify("Ukuran foto maksimal 5 MB.", true);
      event.target.value = "";
      return;
    }

    runAction(async () => {
      try {
        const dataUrl = await fileToDataURL(file);

        try {
          await validateImage(dataUrl);
        } catch {
          notify("File tidak dapat dibaca sebagai gambar.", true);
          return;
        }

        const existing = state.photos.find(
          (photo) => photo.dataUrl === dataUrl,
        );

        if (existing) {
          selectedPhotoId = existing.id;
          renderGallery();
          notify("Foto sudah ada di library dan telah dipilih.");
          return;
        }

        const photo = {
          id: makeId(),
          name: file.name,
          dataUrl,
        };

        const next = structuredClone(state);
        next.photos.push(photo);

        await commit(next);

        selectedPhotoId = photo.id;
        renderGallery();

        notify("Foto diupload dan dipilih. Simpan pet untuk memakainya.");
      } finally {
        $("photo-upload").value = "";
      }
    });
  });

  $("photo-gallery").addEventListener("click", (event) => {
    const button = event.target.closest("[data-photo-id]");

    if (!button || busy || !ready) return;

    selectedPhotoId = button.dataset.photoId;
    renderGallery();
  });

  $("clear-photo").addEventListener("click", () => {
    selectedPhotoId = "";
    renderGallery();
  });

  $("delete-photo").addEventListener("click", () => {
    if (busy || !ready) return;

    const photo = state.photos.find((item) => item.id === selectedPhotoId);

    if (!photo) {
      notify("Pilih foto terlebih dahulu.", true);
      return;
    }

    const inUse = [...state.pets, ...state.requests].some(
      (pet) => pet.photoId === photo.id,
    );

    if (inUse) {
      notify(
        "Foto dipakai di halaman jual atau beli. Ganti foto pet tersebut terlebih dahulu.",
        true,
      );
      return;
    }

    if (!window.confirm(`Hapus foto "${photo.name}"?`)) return;

    runAction(async () => {
      const next = structuredClone(state);

      next.photos = next.photos.filter((item) => item.id !== photo.id);

      await commit(next);

      selectedPhotoId = "";
      renderGallery();

      notify("Foto dihapus.");
    });
  });

  // -------------------------
  // SLIDES + AUTO PLAY
  // -------------------------

  function restartAutoSlide() {
    window.clearInterval(slideTimer);
    slideTimer = null;

    if (
      !ready ||
      !autoEnabled ||
      document.hidden ||
      !panel.hidden ||
      getPageCount() <= 1
    ) {
      return;
    }

    slideTimer = window.setInterval(() => {
      changeSlide(1, false);
    }, SLIDE_INTERVAL);
  }

  function changeSlide(direction, resetTimer = true) {
    if (!ready || getPageCount() <= 1) return;

    const totalPages = getPageCount();

    page = (page + direction + totalPages) % totalPages;

    renderCatalog(true);

    if (resetTimer) restartAutoSlide();
  }

  slideControls?.addEventListener("click", (event) => {
    const autoButton = event.target.closest("[data-auto]");

    if (autoButton) {
      autoEnabled = !autoEnabled;
      renderSlideControls();
      restartAutoSlide();
      return;
    }

    const button = event.target.closest("[data-page]");

    if (!button || button.disabled) return;

    changeSlide(button.dataset.page === "next" ? 1 : -1);
  });

  document.addEventListener("visibilitychange", restartAutoSlide);

  // -------------------------
  // PANEL + CAPTURE
  // -------------------------

  $("toggle-admin").addEventListener("click", () => {
    panel.hidden = !panel.hidden;

    $("toggle-admin").setAttribute("aria-expanded", String(!panel.hidden));

    restartAutoSlide();
  });

  function leaveCapture() {
    document.body.classList.remove("capture-mode");
    $("capture-button").focus();
    restartAutoSlide();
  }

  $("capture-button").addEventListener("click", () => {
    panel.hidden = true;

    $("toggle-admin").setAttribute("aria-expanded", "false");

    document.body.classList.add("capture-mode");

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    window.scrollTo({ top: 0, behavior: "instant" });
    restartAutoSlide();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (document.body.classList.contains("capture-mode")) {
        leaveCapture();
      }
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest("input, select, textarea, button, [contenteditable]")
    ) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      changeSlide(event.key === "ArrowRight" ? 1 : -1);
    }
  });

  let touchStart = null;
  let lastTap = 0;

  catalog.addEventListener(
    "touchstart",
    (event) => {
      touchStart =
        event.touches.length === 1
          ? {
              x: event.touches[0].clientX,
              y: event.touches[0].clientY,
            }
          : null;
    },
    { passive: true },
  );

  catalog.addEventListener(
    "touchend",
    (event) => {
      if (!touchStart || !event.changedTouches.length) return;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;

      touchStart = null;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        lastTap = 0;
        changeSlide(dx < 0 ? 1 : -1);
        return;
      }

      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        const now = Date.now();

        if (
          now - lastTap < 350 &&
          document.body.classList.contains("capture-mode")
        ) {
          leaveCapture();
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }
    },
    { passive: true },
  );

  catalog.addEventListener("touchcancel", () => {
    touchStart = null;
    lastTap = 0;
  });

  catalog.addEventListener("dblclick", () => {
    if (document.body.classList.contains("capture-mode")) {
      leaveCapture();
    }
  });

  // -------------------------
  // INITIALIZATION
  // -------------------------

  async function initialize() {
    setBusy(true);
    updateViewUI();

    try {
      db = await openDatabase();

      const saved = await readState();
      const migrated = migrateState(saved);

      await writeState(migrated);
      state = migrated;

      ready = true;
      setBusy(false);

      resetForm();
      renderAll();
      restartAutoSlide();

      notify(
        "Siap. Perubahan tersimpan di browser ini. Slide otomatis berjalan saat panel ditutup.",
      );
    } catch (error) {
      console.error(error);

      ready = false;
      setBusy(false);

      panel.hidden = false;

      $("toggle-admin").setAttribute("aria-expanded", "true");

      grid.innerHTML = `
        <div class="catalog-empty">
          <strong>Storage unavailable</strong>
          <span>Penyimpanan browser tidak dapat dibuka.</span>
        </div>
      `;

      notify(
        "Penyimpanan browser tidak dapat dibuka. Gunakan browser dengan storage aktif, lalu reload.",
        true,
      );
    }
  }

  initialize();
})();
