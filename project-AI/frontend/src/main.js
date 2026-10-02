import './styles.css';
import { productApi } from './api/products.js';
import { errorMessage, fieldErrors, formatPrice, validateProductInput } from './lib/product.js';

const app = document.querySelector('#app');
let controller;

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const productPath = (id) => `#/products/${id}`;
const route = () => location.hash.slice(1) || '/products';

function cancelPreviousRequest() {
  controller?.abort();
  controller = new AbortController();
  return controller.signal;
}

function layout(content) {
  app.innerHTML = `<header class="site-header"><a class="brand" href="#/products">Katalog Produk</a><nav aria-label="Navigasi utama"><a href="#/products">Produk</a><a class="button button-small" href="#/products/new">Tambah produk</a></nav></header><main id="main" tabindex="-1">${content}</main>`;
}

function retryButton() {
  return '<button class="button" type="button" data-retry>Coba lagi</button>';
}

function errorState(error, { back = false } = {}) {
  return `<section class="state error" role="alert"><h1>${escapeHtml(errorMessage(error))}</h1><p>${error.status === 404 ? 'Produk yang Anda cari tidak tersedia.' : 'Silakan ulangi permintaan Anda.'}</p>${retryButton()}${back ? ' <a class="button secondary" href="#/products">Kembali ke daftar</a>' : ''}</section>`;
}

function productImage(product) {
  return `<img class="product-image" src="${escapeHtml(product.image)}" alt="Foto ${escapeHtml(product.name)}" data-product-image />`;
}

function installImageFallback() {
  document.querySelectorAll('[data-product-image]').forEach((image) => image.addEventListener('error', () => {
    image.removeAttribute('src');
    image.classList.add('image-fallback');
    image.alt = `Gambar untuk ${image.alt.replace(/^Foto /, '')} tidak tersedia`;
  }, { once: true }));
}

async function renderList() {
  layout('<section class="state loading" aria-busy="true"><h1>Memuat produk…</h1><p>Daftar produk sedang disiapkan.</p></section>');
  try {
    const { products, total } = await productApi.list({ signal: cancelPreviousRequest() });
    if (route() !== '/products') return;
    if (!products.length || total === 0) {
      layout('<section class="state"><h1>Belum ada produk</h1><p>Tambahkan produk pertama untuk memulai katalog.</p><a class="button" href="#/products/new">Tambah produk</a></section>');
      return;
    }
    layout(`<section><div class="page-heading"><div><h1>Produk</h1><p>${total} produk tersedia</p></div><a class="button" href="#/products/new">Tambah produk</a></div><div class="product-grid">${products.map((product) => `<article class="product-card"><a href="${productPath(product.id)}">${productImage(product)}<h2>${escapeHtml(product.name)}</h2><p class="price">${formatPrice(product.price)}</p><p>${product.variants.quantity === 0 ? '<span class="out-of-stock">Stok habis</span>' : `${product.variants.quantity} tersedia`}</p></a></article>`).join('')}</div></section>`);
    installImageFallback();
  } catch (error) {
    if (error.name !== 'AbortError') layout(errorState(error));
  }
}

async function renderDetail(id) {
  if (!/^\d+$/.test(id) || Number(id) < 1) {
    layout(errorState({ status: 400, problem: { type: 'https://api.example.com/problems/invalid-product-id' } }, { back: true }));
    bindRetry(renderRoute);
    return;
  }
  layout('<section class="state loading" aria-busy="true"><h1>Memuat produk…</h1><p>Detail produk sedang disiapkan.</p></section>');
  try {
    const product = await productApi.get(id, { signal: cancelPreviousRequest() });
    if (route() !== `/products/${id}`) return;
    const stock = product.variants.quantity === 0 ? '<span class="out-of-stock">Stok habis</span>' : `${product.variants.quantity} tersedia`;
    layout(`<article class="product-detail"><div>${productImage(product)}</div><div><a class="back" href="#/products">← Semua produk</a><h1>${escapeHtml(product.name)}</h1><p class="price">${formatPrice(product.price)}</p><h2>Variasi</h2><ul class="chips">${product.variants.colorOrSize.map((variant) => `<li>${escapeHtml(variant)}</li>`).join('')}</ul><p class="stock">Stok: ${stock}</p><h2>Deskripsi</h2><p class="description">${escapeHtml(product.description)}</p><div class="actions"><a class="button" href="#/products/${product.id}/edit">Ubah</a><button class="button danger" type="button" data-delete="${product.id}" data-name="${escapeHtml(product.name)}">Hapus</button></div></div></article>`);
    installImageFallback();
    document.querySelector('[data-delete]').addEventListener('click', () => confirmDelete(product));
  } catch (error) {
    if (error.name !== 'AbortError') {
      layout(errorState(error, { back: error.status === 404 || error.status === 400 }));
      bindRetry(renderRoute);
    }
  }
}

function input(name, label, value, { type = 'text', help = '' } = {}) {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${type === 'number' ? 'min="0" step="1"' : ''} required aria-describedby="${name}-error" />${help ? `<small>${help}</small>` : ''}<p class="field-error" id="${name}-error"></p></div>`;
}

function formMarkup(product = {}) {
  const values = { name: product.name || '', price: product.price ?? '', image: product.image || '', variants: product.variants?.colorOrSize?.join(', ') || '', quantity: product.variants?.quantity ?? '', description: product.description || '' };
  return `<form id="product-form" novalidate><div class="form-grid">${input('name', 'Nama produk', values.name)}${input('price', 'Harga (Rupiah)', values.price, { type: 'number' })}${input('image', 'URL gambar', values.image, { type: 'url' })}${input('variants', 'Variasi warna/ukuran', values.variants, { help: 'Pisahkan setiap variasi dengan koma.' })}${input('quantity', 'Quantity / stok', values.quantity, { type: 'number' })}<div class="field full"><label for="description">Deskripsi</label><textarea id="description" name="description" maxlength="2000" required aria-describedby="description-error">${escapeHtml(values.description)}</textarea><p class="field-error" id="description-error"></p></div></div><p class="form-message" role="alert"></p><div class="actions"><button class="button" type="submit">Simpan produk</button><a class="button secondary" href="#/products">Batal</a></div></form>`;
}

function showFormErrors(errors) {
  document.querySelectorAll('.field-error').forEach((item) => { item.textContent = ''; });
  Object.entries(errors).forEach(([field, message]) => {
    const target = document.querySelector(`#${CSS.escape(field.replace('variants.', ''))}-error`) || document.querySelector('#variants-error');
    if (target) target.textContent = message;
  });
}

async function renderForm(id) {
  let product;
  if (id) {
    layout('<section class="state loading" aria-busy="true"><h1>Memuat produk…</h1></section>');
    try { product = await productApi.get(id, { signal: cancelPreviousRequest() }); }
    catch (error) { if (error.name !== 'AbortError') { layout(errorState(error, { back: true })); bindRetry(renderRoute); } return; }
  }
  layout(`<section class="form-page"><a class="back" href="#/products">← Semua produk</a><h1>${id ? 'Ubah produk' : 'Tambah produk'}</h1>${formMarkup(product)}</section>`);
  const form = document.querySelector('#product-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const { errors, input: productInput } = validateProductInput(values);
    showFormErrors(errors);
    if (Object.keys(errors).length) return;
    const button = form.querySelector('button[type="submit"]');
    const message = form.querySelector('.form-message');
    button.disabled = true;
    button.textContent = 'Menyimpan…';
    message.textContent = '';
    try {
      const saved = id ? await productApi.update(id, productInput) : await productApi.create(productInput);
      location.hash = productPath(saved.id);
    } catch (error) {
      const apiFieldErrors = fieldErrors(error.problem);
      showFormErrors(apiFieldErrors);
      message.textContent = errorMessage(error);
      button.disabled = false;
      button.textContent = 'Simpan produk';
    }
  });
}

function confirmDelete(product) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<form method="dialog"><h2>Hapus ${escapeHtml(product.name)}?</h2><p>Produk ini akan dihapus dari katalog.</p><div class="actions"><button class="button danger" value="confirm">Ya, hapus</button><button class="button secondary" value="cancel">Batal</button></div></form>`;
  document.body.append(dialog);
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'confirm') return dialog.remove();
    const button = dialog.querySelector('.danger');
    button.disabled = true;
    button.textContent = 'Menghapus…';
    try { await productApi.remove(product.id); location.hash = '#/products'; }
    catch (error) { dialog.remove(); layout(errorState(error, { back: true })); bindRetry(renderRoute); }
  }, { once: true });
  dialog.showModal();
}

function bindRetry(callback) { document.querySelector('[data-retry]')?.addEventListener('click', callback); }

function renderRoute() {
  const current = route();
  const match = current.match(/^\/products\/([^/]+)(?:\/(edit))?$/);
  if (current === '/products') return renderList();
  if (current === '/products/new') return renderForm();
  if (match?.[2]) return renderForm(match[1]);
  if (match) return renderDetail(match[1]);
  location.hash = '#/products';
}

window.addEventListener('hashchange', renderRoute);
renderRoute();
