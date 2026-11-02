(() => {
  "use strict";

  const PAGE_SIZE = 8;
  const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MUTATIONS = ["Ember", "Transcendent", "Inferno"];

  const grid = document.querySelector(".pet-grid");

  if (!grid) {
    console.error("Catalog element .pet-grid was not found.");
    return;
  }

  let db;
  let state = { pets: [], photos: [] };
  let page = 0;
  let selectedPhotoId = "";
  let busy = false;

  const escapeHTML = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  const makeId = () => crypto.randomUUID();

  const numberFormat = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  });

  // -------------------------
  // PANEL STYLES
  // -------------------------

  const style = document.createElement("style");

  style.textContent = `
    [hidden] { display: none !important; }

    .admin-toggle,
    .admin-btn {
      border: 1px solid #30435f;
      border-radius: 9px;
      padding: 10px 14px;
      background: #142238;
      color: #e5efff;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    .admin-btn:hover,
    .admin-toggle:hover {
      background: #1b304d;
    }

    .admin-btn:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .admin-btn.primary {
      background: #3d91ed;
      color: #06111f;
      font-weight: 700;
      border-color: #3d91ed;
    }

    .admin-btn.danger {
      background: #29171e;
      border-color: #69323f;
      color: #ffb1bd;
    }

    .admin-tools {
      width: min(100%, 1440px);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .admin-panel {
      width: min(100%, 1440px);
      padding: 24px;
      background: #0d1420;
      border: 1px solid #253247;
      border-radius: 16px;
    }

    .admin-heading {
      margin: 0 0 6px;
      font-size: 22px;
    }

    .admin-note {
      margin: 0 0 22px;
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

    .admin-field.full { grid-column: 1 / -1; }

    .admin-field input,
    .admin-field select {
      width: 100%;
      min-width: 0;
      background: #080e18;
      border: 1px solid #30405a;
      border-radius: 8px;
      padding: 11px;
      color: #f2f6fc;
      font: inherit;
      font-size: 14px;
    }

    .admin-field input:focus,
    .admin-field select:focus {
      outline: 2px solid #59a7ff;
      outline-offset: 2px;
    }

    .admin-check {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 18px 0;
      font-size: 13px;
      color: #ccd9ec;
    }

    .admin-check input { accent-color: #59a7ff; }

    .admin-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .admin-section-title {
      margin: 0 0 12px;
      font-size: 15px;
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
      background: #080e18;
      border: 2px solid #26364c;
      border-radius: 10px;
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
      border-top: 1px solid #253247;
      padding-top: 20px;
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
      gap: 7px;
      flex-shrink: 0;
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

    .slide-button:not(:disabled) { cursor: pointer; }

    body.capture-mode .admin-tools,
    body.capture-mode .admin-panel {
      display: none !important;
    }

    .capture-exit {
      display: none;
      position: fixed;
      bottom: 14px;
      right: 14px;
      z-index: 100;
      border: 1px solid #526782;
      border-radius: 8px;
      padding: 9px 12px;
      background: #101722;
      color: white;
      cursor: pointer;
    }

    body.capture-mode .capture-exit:focus {
      display: block;
    }

    @media (max-width: 800px) {
      .admin-layout { grid-template-columns: 1fr; }
      .admin-panel { padding: 18px; }
    }

    @media (max-width: 480px) {
      .admin-fields { grid-template-columns: 1fr; }
      .stock-row { align-items: flex-start; flex-direction: column; }
    }

    @media print {
      .admin-tools,
      .admin-panel,
      .capture-exit { display: none !important; }
    }
  `;

  document.head.append(style);

  // -------------------------
  // PANEL MARKUP
  // -------------------------

  const tools = document.createElement("div");
  tools.className = "admin-tools";
  tools.innerHTML = `
    <button type="button" class="admin-toggle" id="toggle-admin"
      aria-expanded="false" aria-controls="admin-panel">
      Manage stock
    </button>
    <button type="button" class="admin-btn" id="capture-button">
      Screenshot mode
    </button>
  `;

  const panel = document.createElement("section");
  panel.className = "admin-panel";
  panel.id = "admin-panel";
  panel.hidden = true;

  panel.innerHTML = `
    <h1 class="admin-heading">Stock Manager</h1>
    <p class="admin-note">
      Manage your pets and reusable photo library.
      Data is stored in this browser only. This panel is not login-protected.
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

          <label class="admin-field">
            Age
            <input id="pet-age" type="number"
              min="0" max="999999" step="1" required>
          </label>

          <label class="admin-field">
            Mutation
            <select id="pet-mutation" required>
              <option value="Ember">Ember</option>
              <option value="Transcendent">Transcendent</option>
              <option value="Inferno">Inferno</option>
            </select>
          </label>

          <label class="admin-field">
            Price (tokens)
            <input id="pet-price" type="number"
              min="0" max="999999999" step="1" required>
          </label>
        </div>

        <label class="admin-check">
          <input id="pet-sold" type="checkbox">
          Mark as SOLD
        </label>

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
          PNG, JPG or WebP. Maximum 5 MB per photo.
          Select a photo below before saving a pet.
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

  const workspace = document.querySelector(".workspace");
  const catalog = document.querySelector(".catalog");

  workspace.insertBefore(tools, catalog);
  workspace.append(panel);

  const exitCapture = document.createElement("button");
  exitCapture.type = "button";
  exitCapture.className = "capture-exit";
  exitCapture.textContent = "Exit screenshot mode";
  exitCapture.setAttribute("aria-label", "Exit screenshot mode");
  document.body.append(exitCapture);

  const $ = (id) => document.getElementById(id);

  const form = $("pet-form");
  const message = $("admin-message");

  function notify(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }

  // -------------------------
  // INDEXEDDB
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
        notify("Close other catalog tabs, then reload.", true);
      };
    });
  }

  function readState() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("app", "readonly");
      const request = transaction.objectStore("app").get("state");

      request.onsuccess = () => {
        resolve(request.result ?? { pets: [], photos: [] });
      };

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

  async function commit(next) {
    await writeState(next);
    state = next;
    renderAll();
  }

  async function runAction(action) {
    if (busy || !db) return;

    busy = true;

    const controls = [...panel.querySelectorAll("button, input, select")];

    const previousDisabled = controls.map((control) => control.disabled);

    controls.forEach((control) => {
      control.disabled = true;
    });

    try {
      await action();
    } catch (error) {
      console.error(error);
      notify(
        "Could not save changes. Browser storage may be full or unavailable.",
        true,
      );
    } finally {
      controls.forEach((control, index) => {
        control.disabled = previousDisabled[index];
      });

      busy = false;
    }
  }

  // -------------------------
  // CATALOG RENDERING
  // -------------------------

  function renderCatalog() {
    const totalPages = Math.max(1, Math.ceil(state.pets.length / PAGE_SIZE));

    page = Math.max(0, Math.min(page, totalPages - 1));

    const visiblePets = state.pets.slice(
      page * PAGE_SIZE,
      (page + 1) * PAGE_SIZE,
    );

    if (!state.pets.length) {
      grid.innerHTML = `
        <div class="catalog-empty">
          <strong>No pets in stock</strong>
          <span>Add your first pet through Manage stock.</span>
        </div>
      `;
    } else {
      grid.innerHTML = visiblePets
        .map((pet, index) => {
          const photo = state.photos.find((item) => item.id === pet.photoId);

          const position = String(page * PAGE_SIZE + index + 1).padStart(
            2,
            "0",
          );

          const visual = photo
            ? `<img class="pet-image"
               src="${escapeHTML(photo.dataUrl)}"
               alt="${escapeHTML(pet.name)}">`
            : `<div class="photo-placeholder">
               <svg aria-hidden="true">
                 <use href="#icon-photo"></use>
               </svg>
               <span>Pet photo</span>
             </div>`;

          return `
          <article class="pet-card${pet.sold ? " is-sold" : ""}">
            <div class="pet-visual">
              <span class="stock-id">${position}</span>
              ${visual}
              <div class="sold-label"><span>SOLD</span></div>
            </div>

            <div class="pet-info">
              <h2 class="pet-name">${escapeHTML(pet.name)}</h2>

              <span class="mutation mutation--${pet.mutation.toLowerCase()}">
                ${escapeHTML(pet.mutation)}
              </span>

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
                    <dt>Age</dt>
                    <dd>${pet.age}</dd>
                  </div>
                </dl>

                <div class="price"
                  aria-label="${pet.price} tokens">
                  <svg class="token-icon" aria-hidden="true">
                    <use href="#icon-token"></use>
                  </svg>
                  ${numberFormat.format(pet.price)}
                </div>
              </div>
            </div>
          </article>
        `;
        })
        .join("");
    }

    const controls = document.querySelector(".slide-controls");

    if (controls) {
      controls.innerHTML = `
        <button class="slide-button" type="button"
          data-page="previous" aria-label="Previous slide"
          ${page === 0 ? "disabled" : ""}>
          &#8592;
        </button>

        <div class="slide-counter">
          <span>${String(page + 1).padStart(2, "0")}</span>
          / ${String(totalPages).padStart(2, "0")}
        </div>

        <button class="slide-button" type="button"
          data-page="next" aria-label="Next slide"
          ${page >= totalPages - 1 ? "disabled" : ""}>
          &#8594;
        </button>
      `;
    }
  }

  function renderGallery() {
    $("photo-gallery").innerHTML = state.photos
      .map(
        (photo) => `
      <button type="button" class="gallery-item"
        data-photo-id="${escapeHTML(photo.id)}"
        aria-label="Select ${escapeHTML(photo.name)}"
        aria-pressed="${photo.id === selectedPhotoId}">
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
    $("stock-title").textContent = `Your stock (${state.pets.length})`;

    if (!state.pets.length) {
      $("stock-list").innerHTML = `
        <p class="admin-note">Your pet list is empty.</p>
      `;
      return;
    }

    $("stock-list").innerHTML = state.pets
      .map(
        (pet) => `
      <div class="stock-row">
        <div class="stock-row-info">
          <span class="stock-row-name">
            ${escapeHTML(pet.name)}${pet.sold ? " · SOLD" : ""}
          </span>

          <span class="stock-row-meta">
            ${numberFormat.format(pet.weight)} kg
            · Age ${pet.age}
            · ${escapeHTML(pet.mutation)}
            · ${numberFormat.format(pet.price)} tokens
          </span>
        </div>

        <div class="stock-row-actions">
          <button type="button" class="admin-btn"
            data-edit="${escapeHTML(pet.id)}">Edit</button>

          <button type="button" class="admin-btn danger"
            data-delete="${escapeHTML(pet.id)}">Delete</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  function renderAll() {
    renderCatalog();
    renderGallery();
    renderStock();
  }

  // -------------------------
  // FORM / CRUD
  // -------------------------

  function resetForm() {
    form.reset();
    $("pet-id").value = "";
    selectedPhotoId = "";
    $("form-title").textContent = "Add pet";
    $("save-pet").textContent = "Save pet";
    renderGallery();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const id = $("pet-id").value;
    const name = $("pet-name").value.trim();
    const weight = Number($("pet-weight").value);
    const age = Number($("pet-age").value);
    const price = Number($("pet-price").value);
    const mutation = $("pet-mutation").value;
    const sold = $("pet-sold").checked;

    if (
      !name ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isInteger(age) ||
      age < 0 ||
      !Number.isInteger(price) ||
      price < 0 ||
      !MUTATIONS.includes(mutation)
    ) {
      notify("Please enter valid pet information.", true);
      return;
    }

    if (!state.photos.some((photo) => photo.id === selectedPhotoId)) {
      notify("Upload or select a pet photo first.", true);
      return;
    }

    const pet = {
      id: id || makeId(),
      name,
      weight,
      age,
      mutation,
      price,
      sold,
      photoId: selectedPhotoId,
    };

    runAction(async () => {
      const next = structuredClone(state);

      if (id) {
        const index = next.pets.findIndex((item) => item.id === id);

        if (index === -1) {
          notify("This pet no longer exists.", true);
          return;
        }

        next.pets[index] = pet;
      } else {
        next.pets.push(pet);
        page = Math.floor((next.pets.length - 1) / PAGE_SIZE);
      }

      await commit(next);
      resetForm();
      notify(id ? "Pet updated." : "Pet added.");
    });
  });

  $("reset-form").addEventListener("click", () => {
    resetForm();
    notify("Form cleared.");
  });

  $("stock-list").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (busy) return;

    if (editButton) {
      const pet = state.pets.find(
        (item) => item.id === editButton.dataset.edit,
      );

      if (!pet) return;

      $("pet-id").value = pet.id;
      $("pet-name").value = pet.name;
      $("pet-weight").value = pet.weight;
      $("pet-age").value = pet.age;
      $("pet-price").value = pet.price;
      $("pet-mutation").value = pet.mutation;
      $("pet-sold").checked = pet.sold;

      selectedPhotoId = pet.photoId;

      $("form-title").textContent = "Edit pet";
      $("save-pet").textContent = "Update pet";

      renderGallery();
      $("pet-name").focus();
      notify(`Editing ${pet.name}.`);
    }

    if (deleteButton) {
      const pet = state.pets.find(
        (item) => item.id === deleteButton.dataset.delete,
      );

      if (!pet || !window.confirm(`Delete "${pet.name}" from stock?`)) {
        return;
      }

      runAction(async () => {
        const next = structuredClone(state);
        next.pets = next.pets.filter((item) => item.id !== pet.id);

        await commit(next);

        if ($("pet-id").value === pet.id) resetForm();

        notify("Pet deleted. Its photo remains in the library.");
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
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error("Invalid image."));
        } else {
          resolve();
        }
      };

      image.onerror = () => reject(new Error("Invalid image."));
      image.src = dataUrl;
    });
  }

  $("photo-upload").addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      notify("Use a PNG, JPG or WebP image.", true);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      notify("The photo must be 5 MB or smaller.", true);
      event.target.value = "";
      return;
    }

    runAction(async () => {
      const dataUrl = await fileToDataURL(file);

      try {
        await validateImage(dataUrl);
      } catch {
        notify("The file could not be read as an image.", true);
        $("photo-upload").value = "";
        return;
      }

      const existing = state.photos.find((photo) => photo.dataUrl === dataUrl);

      if (existing) {
        selectedPhotoId = existing.id;
        renderGallery();
        notify("This photo is already in your library and is now selected.");
      } else {
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
        notify("Photo uploaded and selected. Save the pet to use it.");
      }

      $("photo-upload").value = "";
    });
  });

  $("photo-gallery").addEventListener("click", (event) => {
    const button = event.target.closest("[data-photo-id]");

    if (!button || busy) return;

    selectedPhotoId = button.dataset.photoId;
    renderGallery();
  });

  $("clear-photo").addEventListener("click", () => {
    selectedPhotoId = "";
    renderGallery();
  });

  $("delete-photo").addEventListener("click", () => {
    const photo = state.photos.find((item) => item.id === selectedPhotoId);

    if (!photo) {
      notify("Select a photo first.", true);
      return;
    }

    if (state.pets.some((pet) => pet.photoId === photo.id)) {
      notify(
        "This photo is used by a pet. Change or delete that pet first.",
        true,
      );
      return;
    }

    if (!window.confirm(`Delete photo "${photo.name}"?`)) return;

    runAction(async () => {
      const next = structuredClone(state);
      next.photos = next.photos.filter((item) => item.id !== photo.id);

      await commit(next);
      selectedPhotoId = "";
      renderGallery();
      notify("Photo deleted.");
    });
  });

  // -------------------------
  // PANEL / PAGINATION / CAPTURE
  // -------------------------

  $("toggle-admin").addEventListener("click", () => {
    panel.hidden = !panel.hidden;

    $("toggle-admin").setAttribute("aria-expanded", String(!panel.hidden));
  });

  document
    .querySelector(".slide-controls")
    ?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");

      if (!button || button.disabled) return;

      page += button.dataset.page === "next" ? 1 : -1;
      renderCatalog();
    });

  function leaveCapture() {
    document.body.classList.remove("capture-mode");
    $("capture-button").focus();
  }

  $("capture-button").addEventListener("click", () => {
    document.body.classList.add("capture-mode");
    exitCapture.focus({ preventScroll: true });

    // Remove focus so the exit button is not visible in the screenshot.
    exitCapture.blur();
  });

  exitCapture.addEventListener("click", leaveCapture);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (document.body.classList.contains("capture-mode")) {
        leaveCapture();
      }
      return;
    }

    const target = event.target;

    if (
      target instanceof Element &&
      target.closest("input, select, textarea, button, [contenteditable]")
    ) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      page += event.key === "ArrowRight" ? 1 : -1;
      renderCatalog();
    }
  });

  // Touch swipe, useful in screenshot mode on mobile.
  let touchStart = null;

  catalog.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) return;

      touchStart = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    },
    { passive: true },
  );

  catalog.addEventListener(
    "touchend",
    (event) => {
      if (!touchStart || !event.changedTouches.length) return;

      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;

      touchStart = null;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        page += dx < 0 ? 1 : -1;
        renderCatalog();
      }
    },
    { passive: true },
  );

  // Double-tap / double-click the catalog to leave capture mode.
  catalog.addEventListener("dblclick", () => {
    if (document.body.classList.contains("capture-mode")) {
      leaveCapture();
    }
  });

  // -------------------------
  // START
  // -------------------------

  async function initialize() {
    panel.querySelectorAll("button, input, select").forEach((control) => {
      control.disabled = true;
    });

    try {
      db = await openDatabase();
      state = await readState();

      renderAll();

      panel.querySelectorAll("button, input, select").forEach((control) => {
        control.disabled = false;
      });

      notify("Ready. Your changes are saved automatically in this browser.");
    } catch (error) {
      console.error(error);
      panel.hidden = false;

      $("toggle-admin").setAttribute("aria-expanded", "true");

      notify(
        "Browser storage could not be opened. Try a regular browser window " +
          "with storage enabled.",
        true,
      );
    }
  }

  initialize();
})();
