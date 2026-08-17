/**
 * tools/gorsel/ui/panel.js
 * Görsel Sınıflandırıcı Tool'un core'a sunduğu UI yüzeyi — AGENTS.md Madde 4 + 4.1
 * sözleşmesi.
 */

const STYLE_ID = 'gorsel-panel-style';

// ── İkonlar — monokrom SVG, emoji/renkli glyph yok (platform standardı). ──
const ICON_FOLDER = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z'/></svg>";
const ICON_SEARCH = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><circle cx='11' cy='11' r='7'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>";
const ICON_CLIPBOARD = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><rect x='8' y='2' width='8' height='4' rx='1'/><path d='M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2'/></svg>";
const ICON_CHECK = "<svg viewBox='0 0 24 24' width='14' height='14' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><polyline points='20 6 9 17 4 12'/></svg>";
const ICON_UNDO = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M9 14 4 9l5-5'/><path d='M4 9h10a6 6 0 0 1 0 12h-1'/></svg>";
const ACCENT = '#0D9488';
const ACCENT_DARK = '#0F766E';
const ACCENT_LIGHT = '#CCFBF1';

// core'un AnalyzeRequest'i sadece {tool, istek, klasor} kabul ediyor — bu yüzden
// kullanıcının isteği + taranan görsellerin açıklama bloğu TEK bir "istek"
// string'inde bu ayırıcıyla birleştirilip gönderiliyor (Toplantı Notları'ndaki
// TALIMAT_AYIRICI deseniyle aynı yaklaşım); web.py bunu ayırıyor.
const AYIRICI = '\n---AKTAPOKUS_GORSELLER---\n';

// ── i18n — core sağladığı api.t()'nin tek doğruluk kaynağı olması amaçlanır
// (bkz. tools/gorsel/locale/tr.json ve en.json). Bu TR sözlük SADECE eski
// bir core'a (api.t henüz yok) karşı çalışırken bozulmamak için bir güvenlik
// ağı — AGENTS.md Madde 6 Kural 2: yeni bir core mekanizması eski bir tool'u
// (ya da eski bir core'a karşı çalışan bu tool'u) hiçbir zaman kırmamalı. ──
const T_FALLBACK = {
  klasor_etiket: '// Klasör', klasor_sec_btn: 'Klasör Seç', klasor_secilmedi: '(seçilmedi)',
  tara_btn: 'Görselleri Tara', bekleme_placeholder: '// Bir klasör seçip görselleri tarayın',
  istek_etiket: '// İstek — nasıl gruplansın?', istek_placeholder: 'Nasıl gruplansın?',
  istek_varsayilan: 'ağaç olan resimleri Ağaç klasörüne, deniz olan resimleri Deniz klasörüne topla',
  plan_olustur_btn: 'Plan Oluştur', taraniyor: 'Görseller taranıyor…',
  tara_baslatilamadi: 'Tarama başlatılamadı.', baglanti_hatasi: 'Bağlantı hatası',
  analiz_ediliyor_etiket: 'Analiz ediliyor', gecen_sure_dk: 'dk', gecen_sure_sn: 'sn',
  tarama_hatasi: 'Tarama hatası', bilinmeyen_hata: 'bilinmeyen hata', is_bulunamadi: 'İş bulunamadı.',
  klasorde_gorsel_yok: 'Klasörde görsel bulunamadı.',
  gorsel_analiz_edildi: '{n} görsel analiz edildi. Solda isteğinizi yazıp "Plan Oluştur"a basın.',
  istek_bos_uyari: 'Önce görselleri hangi kritere göre gruplamak istediğinizi yazın.',
  once_tara_uyari: 'Önce görselleri tarayın.', analiz_basarisiz: 'Analiz başarısız',
  onayla_tasi_btn: 'Onayla ve Taşı', iptal_btn: 'İptal',
  en_az_bir_secim: 'En az bir görsel seçmelisiniz.', tasima_basarisiz: 'Taşıma başarısız',
  gorsel_tasindi: '{n} görsel taşındı.', geri_al_btn: 'Geri Al',
  geri_al_onay: 'Taşınan görseller eski konumlarına geri taşınsın mı?',
  hiz_notu: 'Bu tarama uzun sürebilir — süre bilgisayarınızın işlemci/ekran kartı gücüne göre değişir. Ekran kartı hızlandırması olmayan bir sistemde ~350 görsel yaklaşık 4-5 saat sürebilir.',
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .gorsel-theme {
      --gs-accent: ${ACCENT}; --gs-accent-dark: ${ACCENT_DARK}; --gs-accent-light: ${ACCENT_LIGHT};
    }
    .gorsel-theme .btn-primary { background: var(--gs-accent) !important; border-color: var(--gs-accent) !important; }
    .gorsel-theme .btn-primary:hover { background: var(--gs-accent-dark) !important; }
    .gs-page { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .gs-split { display: flex; flex: 1; min-height: 0; overflow: hidden; }
    .gs-split-left {
      width: 300px; flex-shrink: 0; border-right: 1px solid var(--border);
      overflow-y: auto; display: flex; flex-direction: column;
    }
    .gs-split-right { flex: 1; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; }
    .gs-footer-bar { flex-shrink: 0; border-top: 1px solid var(--border); background: var(--surface); padding: 14px 16px; }
    .gorsel-form { padding: 16px; flex-shrink: 0; }
    .gorsel-klasor-kutu {
      font-size: 12px; color: var(--text-dim); padding: 8px 10px; border: 1px solid var(--border);
      border-radius: 6px; margin-bottom: 10px; word-break: break-all;
    }
    .gorsel-sonuc-area { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
    .gorsel-durum-kutu {
      padding: 12px 16px; background: var(--gs-accent-light); border: 1px solid var(--gs-accent);
      border-radius: 6px; font-size: 13px; color: var(--gs-accent-dark); margin-bottom: 12px;
    }
    .gorsel-hata-kutu {
      padding: 12px 16px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px;
      font-size: 13px; color: #B91C1C; margin-bottom: 12px;
    }
    .gorsel-ilerleme-bar-dis { background: var(--surface-2); border-radius: 4px; height: 6px; overflow: hidden; margin-top: 8px; }
    .gorsel-ilerleme-bar-ic { background: var(--gs-accent); height: 100%; transition: width 0.3s; }
    .gs-sure-satir { display: flex; align-items: center; gap: 7px; font-weight: 500; }
    .gs-nabiz { width: 7px; height: 7px; border-radius: 50%; background: var(--gs-accent); flex-shrink: 0; animation: gs-pulse 1.1s ease-in-out infinite; }
    @keyframes gs-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.65); } }
    .gs-step-badge {
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 16px; height: 16px; border-radius: 50%; margin-right: 6px;
      background: var(--gs-accent); color: #fff; font-size: 10px; font-weight: 600; font-family: var(--mono);
    }
    .gorsel-liste-item {
      display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--surface-2); font-size: 13px;
    }
    .gorsel-liste-item .gs-id { font-weight: 600; color: var(--gs-accent-dark); flex-shrink: 0; width: 30px; }
    .gorsel-liste-item .gs-yol { color: var(--text-dim); flex-shrink: 0; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gorsel-liste-item .gs-aciklama { color: var(--text); }
    .gorsel-plan-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--surface-2); font-size: 13px; }
    .gorsel-plan-item .gs-ok { margin-top: 2px; }
    .gorsel-plan-item .gs-detay { flex: 1; }
    .gorsel-plan-item .gs-kaynak { color: var(--text-dim); font-size: 12px; }
    .gorsel-plan-item .gs-hedef { color: var(--gs-accent-dark); font-weight: 500; }
    .gorsel-plan-footer { display: flex; gap: 8px; margin-top: 14px; }
    .gorsel-placeholder { padding: 24px; text-align: center; color: var(--text-xs); font-size: 12px; }
    .gs-hiz-notu { font-size: 11px; color: var(--text-xs); line-height: 1.5; margin-top: 8px; }
  `;
  document.head.appendChild(style);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

export function mount(container, api, toolId) {
  ensureStyles();
  container.classList.add('gorsel-theme');

  // api.t: core, mount()'tan HEMEN önce tool'un locale/{lang}.json'ını
  // çekip ekliyor (bkz. core/static/index.html toolSec()). Eski bir core
  // bunu hiç sağlamayabilir — o durumda T_FALLBACK'e (TR) düşülür.
  function t(key, vars) {
    let s = (typeof api.t === 'function') ? api.t(key) : undefined;
    // api.t bulamadığı bir key için anahtarın kendisini geri döner (bkz.
    // core/static/index.html toolSec()) — bu durumda ya da api.t hiç
    // sağlanmamışsa (eski core) yerel TR yedeğine düşülür.
    if (s === undefined || s === null || s === key) {
      s = T_FALLBACK[key] ?? key;
    }
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
    return s;
  }

  let secilenKlasor = null;
  let gorseller = [];
  let sonPlanId = null;
  let sonKlasor = null;
  let durumPollTimer = null;
  let taramaBaslangic = null;

  container.innerHTML = `
    <div class="gs-page">
      <div class="gs-split">
        <div class="gs-split-left">
          <div class="gorsel-form">
            <div class="field-block">
              <label class="field-label"><span class="gs-step-badge">1</span>${esc(t('klasor_etiket'))}</label>
              <button class="btn-secondary" id="gsKlasorSecBtn">${ICON_FOLDER} ${esc(t('klasor_sec_btn'))}</button>
              <div class="gorsel-klasor-kutu" id="gsKlasorKutu">${esc(t('klasor_secilmedi'))}</div>
            </div>
            <button class="btn-primary" id="gsTaraBtn" disabled><span class="gs-step-badge" style="background:rgba(255,255,255,.3)">2</span>${ICON_SEARCH} ${esc(t('tara_btn'))}</button>
            <div class="gs-hiz-notu">${esc(t('hiz_notu'))}</div>
          </div>
        </div>
        <div class="gs-split-right">
          <div class="gorsel-sonuc-area" id="gsSonucArea">
            <div class="gorsel-placeholder">${esc(t('bekleme_placeholder'))}</div>
          </div>
        </div>
      </div>
      <div class="gs-footer-bar">
        <div class="field-block">
          <label class="field-label"><span class="gs-step-badge">3</span>${esc(t('istek_etiket'))}</label>
          <textarea id="gsIstek" rows="2" placeholder="${esc(t('istek_placeholder'))}">${esc(t('istek_varsayilan'))}</textarea>
        </div>
        <button class="btn-primary" id="gsPlanBtn" disabled style="margin-top:10px"><span class="gs-step-badge" style="background:rgba(255,255,255,.3)">4</span>${ICON_CLIPBOARD} ${esc(t('plan_olustur_btn'))}</button>
      </div>
    </div>
  `;

  const klasorKutu = container.querySelector('#gsKlasorKutu');
  const klasorSecBtn = container.querySelector('#gsKlasorSecBtn');
  const taraBtn = container.querySelector('#gsTaraBtn');
  const planBtn = container.querySelector('#gsPlanBtn');
  const istekEl = container.querySelector('#gsIstek');
  const sonucArea = container.querySelector('#gsSonucArea');

  function sureMetni() {
    if (!taramaBaslangic) return '';
    const s = Math.max(0, Math.floor((Date.now() - taramaBaslangic) / 1000));
    const dk = Math.floor(s / 60), sn = s % 60;
    return `${dk}${t('gecen_sure_dk')} ${sn}${t('gecen_sure_sn')}`;
  }

  klasorSecBtn.onclick = async () => {
    const klasor = await api.pickFolder();
    if (!klasor) return;
    secilenKlasor = klasor;
    klasorKutu.textContent = klasor;
    taraBtn.disabled = false;
  };

  taraBtn.onclick = async () => {
    if (!secilenKlasor) return;
    gorseller = [];
    planBtn.disabled = true;
    taramaBaslangic = Date.now();
    sonucArea.innerHTML = `<div class="gorsel-durum-kutu">${esc(t('taraniyor'))}</div>`;

    let is_id;
    try {
      const r = await api.apiFetch(`/api/tools/${toolId}/tara/baslat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klasor: secilenKlasor }),
      });
      const d = await r.json();
      if (!r.ok) { sonucArea.innerHTML = `<div class="gorsel-hata-kutu">${esc(d.detail || t('tara_baslatilamadi'))}</div>`; return; }
      is_id = d.is_id;
    } catch (e) {
      sonucArea.innerHTML = `<div class="gorsel-hata-kutu">${esc(t('baglanti_hatasi'))}: ${esc(e.message)}</div>`;
      return;
    }

    if (durumPollTimer) clearInterval(durumPollTimer);
    durumPollTimer = setInterval(async () => {
      try {
        const r = await api.apiFetch(`/api/tools/${toolId}/tara/durum/${is_id}`);
        const d = await r.json();
        if (d.durum === 'isleniyor') {
          const yuzde = d.toplam ? Math.round((d.tamamlanan / d.toplam) * 100) : 0;
          sonucArea.innerHTML = `
            <div class="gorsel-durum-kutu">
              <div class="gs-sure-satir"><span class="gs-nabiz"></span>${esc(t('analiz_ediliyor_etiket'))}: ${d.tamamlanan}/${d.toplam} — ${sureMetni()}</div>
              <div class="gorsel-ilerleme-bar-dis"><div class="gorsel-ilerleme-bar-ic" style="width:${yuzde}%"></div></div>
            </div>`;
        } else if (d.durum === 'tamam') {
          clearInterval(durumPollTimer);
          taramaBaslangic = null;
          const rs = await api.apiFetch(`/api/tools/${toolId}/tara/sonuc/${is_id}`);
          const ds = await rs.json();
          gorseller = ds.gorseller || [];
          renderGorselListesi();
          planBtn.disabled = gorseller.length === 0;
        } else if (d.durum === 'hata') {
          clearInterval(durumPollTimer);
          taramaBaslangic = null;
          sonucArea.innerHTML = `<div class="gorsel-hata-kutu">${esc(t('tarama_hatasi'))}: ${esc(d.hata || t('bilinmeyen_hata'))}</div>`;
        } else if (d.durum === 'bulunamadi') {
          clearInterval(durumPollTimer);
          taramaBaslangic = null;
          sonucArea.innerHTML = `<div class="gorsel-hata-kutu">${esc(t('is_bulunamadi'))}</div>`;
        }
      } catch (e) {
        // geçici ağ hatası — bir sonraki pollde tekrar dener
      }
    }, 2000);
  };

  function renderGorselListesi() {
    if (!gorseller.length) {
      sonucArea.innerHTML = `<div class="gorsel-hata-kutu">${esc(t('klasorde_gorsel_yok'))}</div>`;
      return;
    }
    sonucArea.innerHTML = `
      <div class="gorsel-durum-kutu">${esc(t('gorsel_analiz_edildi', { n: gorseller.length }))}</div>
      ${gorseller.map(g => `
        <div class="gorsel-liste-item">
          <span class="gs-id">${esc(g.id)}</span>
          <span class="gs-yol" title="${esc(g.goreli_yol)}">${esc(g.goreli_yol)}</span>
          <span class="gs-aciklama">${esc(g.aciklama)}</span>
        </div>
      `).join('')}
    `;
  }

  function gorselBlokOlustur() {
    return gorseller.map(g => `${g.id}: ${g.goreli_yol} — ${g.aciklama}`).join('\n');
  }

  planBtn.onclick = async () => {
    const kullaniciIstegi = istekEl.value.trim();
    if (!kullaniciIstegi) { api.gosterfeedback(t('istek_bos_uyari'), 'err'); return; }
    if (!gorseller.length) { api.gosterfeedback(t('once_tara_uyari'), 'err'); return; }

    const istekMetni = `${kullaniciIstegi}${AYIRICI}${gorselBlokOlustur()}`;
    sonKlasor = secilenKlasor;

    api.spinnerGoster && api.spinnerGoster();
    let d;
    try {
      d = await api.analyze(toolId, { istek: istekMetni, klasor: secilenKlasor });
    } finally {
      api.spinnerGizle && api.spinnerGizle();
    }
    if (d.hata || d.detail) { api.gosterfeedback(`${t('analiz_basarisiz')}: ` + (d.detail || d.hata), 'err'); return; }
    if (d.bos) { api.gosterfeedback(d.aciklama || t('once_tara_uyari'), 'err'); return; }

    sonPlanId = d.plan_id;
    renderPlan(d);
  };

  function renderPlan(d) {
    sonucArea.innerHTML = `
      <div class="gorsel-durum-kutu">${esc(d.aciklama)}</div>
      <div id="gsPlanListesi">
        ${d.items.map(it => `
          <div class="gorsel-plan-item">
            <input type="checkbox" class="gs-ok" data-id="${esc(it.id)}" checked>
            <div class="gs-detay">
              <div class="gs-kaynak">${esc(it.source)}</div>
              <div>→ <span class="gs-hedef">${esc(it.destination)}</span></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="gorsel-plan-footer">
        <button class="btn-primary" id="gsUygulaBtn">${ICON_CHECK} ${esc(t('onayla_tasi_btn'))}</button>
        <button class="btn-secondary" id="gsIptalBtn">${esc(t('iptal_btn'))}</button>
      </div>
    `;
    container.querySelector('#gsIptalBtn').onclick = () => renderGorselListesi();
    container.querySelector('#gsUygulaBtn').onclick = async () => {
      const onayliIdler = [...container.querySelectorAll('.gs-ok:checked')].map(cb => cb.dataset.id);
      if (!onayliIdler.length) { api.gosterfeedback(t('en_az_bir_secim'), 'err'); return; }

      const dd = await api.execute(toolId, sonPlanId, onayliIdler);
      if (dd.hata || dd.detail) { api.gosterfeedback(`${t('tasima_basarisiz')}: ` + (dd.detail || dd.hata), 'err'); return; }

      const hataMetni = (dd.hatalar && dd.hatalar.length) ? `<div class="gorsel-hata-kutu">${dd.hatalar.map(esc).join('<br>')}</div>` : '';
      sonucArea.innerHTML = `
        <div class="gorsel-durum-kutu">${ICON_CHECK} ${esc(t('gorsel_tasindi', { n: dd.uygulanan }))}</div>
        ${hataMetni}
        <button class="btn-danger" id="gsGeriAlBtn">${ICON_UNDO} ${esc(t('geri_al_btn'))}</button>
      `;
      container.querySelector('#gsGeriAlBtn').onclick = async () => {
        if (!confirm(t('geri_al_onay'))) return;
        await api.rollback(toolId, sonKlasor, dd.session_id || api.lastSessionId());
        sonucArea.innerHTML = `<div class="gorsel-placeholder">${esc(t('bekleme_placeholder'))}</div>`;
        gorseller = [];
        planBtn.disabled = true;
      };
    };
  }
}

export function unmount(container) {
  container.classList.remove('gorsel-theme');
  container.innerHTML = '';
}
