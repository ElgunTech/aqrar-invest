// Guided tour video of the portal, recorded from the local stack (same code as the live site).
// One continuous browser page; captions and a visible cursor are injected as an overlay.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const B = 'http://localhost:5173';
const OUT = __dirname;
const W = 1920, H = 1080;
const seed = fs.readFileSync('C:/Users/elgun/Desktop/hack agro/backend/src/main/java/az/agro/portal/config/DemoDataSeeder.java', 'utf8');
const DEMO_PW = /DEMO_PASSWORD = "([^"]*)"/.exec(seed)[1];
const icon = 'data:image/png;base64,' + fs.readFileSync('C:/Users/elgun/Desktop/hack agro/frontend/public/icons/icon-512.png').toString('base64');
const pdfPath = path.join(OUT, 'doc.pdf');
fs.writeFileSync(pdfPath, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

const OVERLAY = `
(() => {
  const css = \`
  #tour-cap{position:fixed;left:50%;bottom:44px;transform:translateX(-50%) translateY(20px);opacity:0;z-index:2147483646;
    width:min(1180px,86vw);background:rgba(10,30,20,.92);color:#fff;border-radius:16px;padding:22px 30px 24px 30px;
    font-family:Roboto,Arial,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.35);transition:opacity .45s ease,transform .45s ease;
    border-left:6px solid #e0a106;pointer-events:none}
  #tour-cap.on{opacity:1;transform:translateX(-50%) translateY(0)}
  #tour-cap .k{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#e0a106;font-weight:700;margin-bottom:6px}
  #tour-cap .t{font-size:32px;font-weight:700;line-height:1.2}
  #tour-cap .b{font-size:21px;line-height:1.45;color:#d7e6dc;margin-top:8px}
  #tour-cur{position:fixed;left:0;top:0;width:26px;height:26px;margin:-4px 0 0 -4px;z-index:2147483647;pointer-events:none;
    transition:transform .08s linear}
  #tour-cur svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))}
  #tour-cur.click::after{content:"";position:absolute;left:-14px;top:-14px;width:54px;height:54px;border-radius:50%;
    border:3px solid #e0a106;animation:tourpulse .5s ease-out}
  @keyframes tourpulse{from{transform:scale(.3);opacity:1}to{transform:scale(1.2);opacity:0}}
  .install-bar{display:none!important}
  \`;
  const add = () => {
    if (document.getElementById('tour-cap')) return;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    const c = document.createElement('div'); c.id = 'tour-cap'; c.innerHTML = '<div class="k"></div><div class="t"></div><div class="b"></div>'; document.body.appendChild(c);
    const m = document.createElement('div'); m.id = 'tour-cur';
    m.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#0b2219" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(m);
    const st = window.__tourCursor || { x: innerWidth / 2, y: innerHeight / 2 };
    m.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px)';
    addEventListener('mousemove', (e) => { window.__tourCursor = { x: e.clientX, y: e.clientY }; m.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', () => { m.classList.remove('click'); void m.offsetWidth; m.classList.add('click'); }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
  window.__cap = (k, t, b) => { add(); const c = document.getElementById('tour-cap');
    if (!t) { c.classList.remove('on'); return; }
    c.querySelector('.k').textContent = k; c.querySelector('.t').textContent = t; c.querySelector('.b').textContent = b || '';
    c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); };
})();`;

const hold = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1,
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('aqrar-lang', 'az'); localStorage.setItem('aqrar-install-dismissed', String(Date.now())); } catch {} });
  await ctx.addInitScript(OVERLAY);
  const p = await ctx.newPage();
  // High-quality capture: Chrome's own screencast (JPEG q92 at full resolution), assembled by ffmpeg afterwards.
  const FR = path.join(OUT, 'shots');
  fs.rmSync(FR, { recursive: true, force: true });
  fs.mkdirSync(FR);
  const frames = [];
  // load a real page first so the screencast starts at the emulated 1920x1080 size, not the window size
  await p.goto(B + '/offline.html');
  const cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', (f) => {
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    if (Math.round(f.metadata.deviceWidth) !== W || Math.round(f.metadata.deviceHeight) !== H) return;
    const file = path.join(FR, String(frames.length).padStart(6, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file: file.split(path.sep).join('/'), t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const cap = (k, t, b) => p.evaluate(([k, t, b]) => window.__cap && window.__cap(k, t, b), [k, t, b]);
  const glide = async (x, y, steps = 28) => { await p.mouse.move(x, y, { steps }); };
  const clickOn = async (locator, pause = 350) => {
    const el = p.locator(locator).first();
    await el.scrollIntoViewIfNeeded();
    const bb = await el.boundingBox();
    await glide(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await hold(pause);
    await el.click();
  };
  const smoothScroll = (to, ms) => p.evaluate(([to, ms]) => new Promise((res) => {
    const from = scrollY, t0 = performance.now();
    const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(f) : res(); };
    requestAnimationFrame(f);
  }), [to, ms]);
  const card = async (html, ms) => {
    await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet"></head>
      <body style="margin:0;width:${W}px;height:${H}px;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#2a8f4a,#0b2219 70%);font-family:Roboto,Arial,sans-serif;color:#fff">${html}</body></html>`);
    await hold(600); await hold(ms);
  };

  // ---------------------------------------------------------------- 0. title
  await card(`<div style="text-align:center">
    <img src="${icon}" style="width:150px;height:150px;border-radius:34px;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="font-size:84px;font-weight:700;margin-top:34px;letter-spacing:-.01em">Aqrar İnvest</div>
    <div style="font-size:32px;color:#cfe6d6;margin-top:12px">İşğaldan azad edilmiş ərazilər üçün investisiya müsabiqəsi portalı</div>
    <div style="display:inline-block;margin-top:40px;padding:12px 26px;border:2px solid #e0a106;border-radius:40px;color:#e0a106;font-size:24px;font-weight:500">Bələdçi tur · 2 dəqiqə</div>
  </div>`, 3800);

  // ---------------------------------------------------------------- 1. landing
  await p.goto(B + '/'); await hold(2500);
  await glide(W / 2, H / 2 + 100, 10);
  await cap('Giriş', 'Qarabağın torpağı yenidən əkinə hazırdır', 'Scroll-craft giriş ekranı: dağlardan minadan təmizlənmiş tarlalara qədər bir səyahət.');
  await hold(3500);
  await cap('', '');
  await smoothScroll(H * 2.2, 5000); await hold(800);
  await smoothScroll(H * 4.6, 5000); await hold(1200);

  // ---------------------------------------------------------------- 2. portal + languages
  await p.goto(B + '/portal'); await hold(1800);
  await cap('Portal', 'Dövlət portalı standartında interfeys', 'Müsabiqə elanları, əsas göstəricilər və elektron xidmətlər bir səhifədə.');
  await hold(3000);
  await cap('Üç dil', 'Azərbaycan · English · Русский', 'Xarici investor üçün interfeys bir kliklə dəyişir.');
  await clickOn('.lang-switch button:has-text("EN")'); await hold(1600);
  await clickOn('.lang-switch button:has-text("RU")'); await hold(1600);
  await clickOn('.lang-switch button:has-text("AZ")'); await hold(1000);

  // ---------------------------------------------------------------- 3. map + 3D
  await p.goto(B + '/xerite'); await hold(3500);
  await cap('Xəritə', 'ANAMA-nın rəsmi açıq məlumatı', '1019 minadan təmizlənmiş kənd təsərrüfatı sahəsi və müsabiqə sahələrinin real sərhədləri (opendata.az).');
  await glide(W * 0.62, H * 0.45); await hold(3800);
  await p.goto(B + '/xerite-3d'); await hold(7000);
  await cap('3D xəritə', 'Relyef, peyk görüntüsü və sahələr', 'Sahəni seçin: kamera ona uçur və ətrafında fırlanır.');
  await clickOn('.map3d__list button:nth-of-type(8)'); await hold(9500);

  // ---------------------------------------------------------------- 4. plot page: AI, solar, satellite
  await p.goto(B + '/sahe/1'); await hold(2200);
  await cap('Sahə', 'Bir baxışda: AI tövsiyəsi, günəş, infrastruktur', 'Uzun səhifə əvəzinə qısa xülasə və tablar.');
  await glide(900, 520); await hold(2600);
  await clickOn('.plot-tabs button:has-text("Torpaq və AI")'); await hold(800);
  await cap('Süni intellekt', 'Bu torpaqda nə əkmək sərfəlidir?', 'Kaggle-da öyrədilmiş RandomForest modeli (99.5% dəqiqlik) ONNX ilə Java-da işləyir.');
  await hold(3600);
  await clickOn('.plot-tabs button:has-text("Günəş enerjisi")'); await p.waitForSelector('.solar-criteria', { timeout: 60000 }); await hold(600);
  await cap('Günəş enerjisi', 'Sahə günəş paneli üçün uyğundurmu?', 'PVGIS (Avropa Komissiyası) məlumatı və Tarif Şurasının rəsmi tarifləri: 8.5 qəpik alış, 10.6 qəpik kənd təsərrüfatı.');
  await hold(3000);
  await clickOn('button[role=tab]:has-text("Aqrovoltaik stansiya")'); await hold(800);
  await smoothScroll(await p.evaluate(() => document.querySelector('.solar-split').getBoundingClientRect().top + scrollY - 420), 1500);
  await hold(3200);
  await p.goto(B + '/sahe/8?tab=peyk'); await p.waitForSelector('.sat-images img', { timeout: 90000 }); await hold(800);
  await smoothScroll(await p.evaluate(() => document.querySelector('.sat-banner').getBoundingClientRect().top + scrollY - 140), 1200);
  await cap('Peyk monitorinqi', 'Torpaq verildi, amma 14 aydır əkin görünmür', 'Sentinel-2 NDVI sahənin rəsmi sərhədi üzrə: yazdakı təbii ot əkin sayılmır, yay aylarına baxılır. Real məlumat.');
  await glide(700, 640); await hold(5200);

  // ---------------------------------------------------------------- 5. investor applies
  const stamp = Date.now().toString().slice(-5);
  const fin = ('TUR' + stamp.slice(-4)).toUpperCase();
  const pw = 'T' + crypto.randomBytes(6).toString('hex') + '7';
  await p.goto(B + '/giris?tab=register'); await hold(1200);
  await cap('İnvestor', 'Qeydiyyat: myGov və ya e-poçt ilə', 'Qeydiyyatdan sonra «Aqrar İnvestə xoş gəldiniz!» məktubu göndərilir.');
  await p.fill('#fullName', ''); await p.type('#fullName', 'Rəşad Məmmədov', { delay: 45 });
  await p.fill('#email', `investor${stamp}@example.az`); await p.fill('#phone', '+994 50 555 21 43'); await p.fill('#fin', fin);
  await p.fill('#password', pw); await hold(600);
  await clickOn('form button.btn--lg'); await p.waitForURL((u) => !u.pathname.startsWith('/giris')); await hold(1200);
  const plots = await (await p.request.get(B + '/api/v1/public/plots')).json();
  const plot = plots.find((x) => x.code === 'QR-AGD-002') || plots.find((x) => x.openCompetition);
  await p.goto(`${B}/muraciet?plot=${plot.id}&competition=${plot.openCompetition.id}`); await hold(1500);
  await cap('Elektron müraciət', '5 addımda müraciət', 'Sahə → müraciətçi → investisiya planı → sənədlər → təsdiq. Fayl formatı serverdə yoxlanılır.');
  await clickOn('button:has-text("Davam et")'); await hold(700);
  await p.fill('#tax', fin); await p.fill('#name', 'Rəşad Məmmədov'); await p.fill('#ph', '+994 50 555 21 43'); await p.fill('#em', `investor${stamp}@example.az`);
  await hold(900); await clickOn('button:has-text("Davam et")'); await hold(600);
  await p.fill('#inv', String(plot.minInvestment + 150000)); await p.fill('#jobs', '24'); await p.fill('#mon', '36'); await p.fill('#exp', '7'); await p.fill('#ret', '10');
  await p.fill('#bp', 'Damcı suvarma ilə qarğıdalı və noxud əkini, taxıl anbarı və yerli emal. İşçilərin bir hissəsi Böyük Qayıdış çərçivəsində Ağdama qayıdan sakinlərdəndir. Maliyyə: öz vəsaiti 40% və bank krediti.');
  await hold(1200); await clickOn('button:has-text("Davam et")'); await hold(500);
  const fi = p.locator('input[type=file]'); await fi.nth(0).setInputFiles(pdfPath); await fi.nth(1).setInputFiles(pdfPath);
  await hold(1000); await clickOn('button:has-text("Davam et")'); await hold(700);
  await clickOn('input[type=checkbox]'); await hold(400);
  const resp = p.waitForResponse((r) => r.url().includes('/api/v1/me/applications') && r.request().method() === 'POST');
  await clickOn('button:has-text("Müraciəti göndər")');
  const app = await (await resp).json();
  await hold(2200);
  await p.goto(`${B}/kabinet/${app.id}/qebz`); await p.waitForSelector('.receipt img'); await hold(600);
  await cap('QR qəbz', `Müraciət ${app.applicationNumber} qəbul edildi`, 'Qəbzdəki QR kod ictimai yoxlama səhifəsini açır. Müraciət eyni anda EKTİS-ə ötürülür.');
  await hold(4200);
  await p.request.post(B + '/api/v1/auth/logout');

  // ---------------------------------------------------------------- 6. blind evaluation
  await p.request.post(B + '/api/v1/auth/login', { data: { email: 'evaluator@demo.az', password: DEMO_PW } });
  await p.request.post(`${B}/api/v1/admin/applications/${app.id}/status`, { data: { status: 'UNDER_REVIEW', comment: '' } });
  await p.goto(B + '/admin'); await hold(1200); await clickOn('[role=tab]:has-text("Müraciətlər")'); await hold(1500);
  const row = p.locator(`text=${app.applicationNumber}`).first();
  await row.scrollIntoViewIfNeeded(); const rb = await row.boundingBox(); await glide(rb.x + 40, rb.y + rb.height / 2); await hold(300); await row.click();
  await p.waitForSelector('.blind-note'); await hold(500);
  await cap('Kor qiymətləndirmə', 'Komissiya üzvü müraciətçinin kim olduğunu görmür', 'Ad, FİN, əlaqə və şəxsiyyət sənədləri öz balını verənə qədər gizlidir. Bal yalnız layihəyə görə verilir.');
  // point at the anonymous name in the drawer header
  const anon = p.locator('b:has-text("Müraciətçi A-")').first();
  const ab = await anon.boundingBox().catch(() => null);
  if (ab) await glide(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await hold(5200);
  await p.request.post(`${B}/api/v1/admin/applications/${app.id}/score`, { data: { feasibility: 8, financing: 8, socialImpact: 9, technology: 8, comment: 'Real biznes plan', noConflict: true } });
  await p.reload(); await hold(1200); await p.locator('[role=tab]:has-text("Müraciətlər")').first().click(); await hold(1200);
  const row2 = p.locator(`text=${app.applicationNumber}`).first(); await row2.click(); await hold(1500);
  await cap('Kor qiymətləndirmə', 'Bal verildi: ad indi açılır', 'Hər bal və status dəyişikliyi eyni anda dəyişdirilə bilməyən jurnala möhürlənir.');
  await hold(3600);
  await p.request.post(B + '/api/v1/auth/logout');

  // ---------------------------------------------------------------- 7. decision
  await p.request.post(B + '/api/v1/auth/login', { data: { email: 'admin@demo.az', password: DEMO_PW } });
  await p.request.post(`${B}/api/v1/admin/applications/${app.id}/score`, { data: { feasibility: 9, financing: 8, socialImpact: 9, technology: 8, comment: 'Uyğundur', noConflict: true } });
  await p.request.post(`${B}/api/v1/admin/applications/${app.id}/status`, { data: { status: 'APPROVED', comment: 'Ən yüksək investisiya və iş yeri göstəriciləri; 10 iş yeri qayıdan sakinlər üçün.' } });
  await p.goto(`${B}/admin/qerar/${app.id}`); await p.waitForSelector('.decision__verdict'); await hold(600);
  await cap('Qərar', 'Müsabiqənin nəticəsi haqqında QƏRAR', 'Ən azı 2 komissiya balı tələb olunur. Sənəd QR kodlu, elektron imzalıdır; PDF kimi yüklənir. Qaliblə öhdəliklərin monitorinq planı avtomatik yaranır.');
  await hold(2500);
  await smoothScroll(700, 2600); await hold(2000);

  // ---------------------------------------------------------------- 8. ledger and tamper demo
  await p.goto(`${B}/yoxla/${app.applicationNumber}`); await p.waitForSelector('.ledger--ok'); await hold(500);
  await smoothScroll(await p.evaluate(() => document.querySelector('.ledger').getBoundingClientRect().top + scrollY - 120), 1200);
  await cap('Dəyişdirilə bilməyən jurnal', 'Qərarlar möhürləndikdən sonra dəyişdirilməyib', 'Hər qeyd SHA-256 ilə əvvəlki qeydə bağlanır. Bu yoxlama hər kəs üçün açıqdır.');
  await glide(560, 300); await hold(4200);
  await p.request.post(`${B}/api/v1/admin/ledger/tamper/${app.applicationNumber}`);
  await cap('Saxtakarlıq simulyasiyası', 'Kimsə bazada qərarı gizlicə dəyişir…', 'Məsələn, verilənlər bazasının inzibatçısı tarixçəni birbaşa redaktə edir.');
  await hold(2600);
  await p.reload(); await p.waitForSelector('.ledger--bad'); await hold(400);
  await smoothScroll(await p.evaluate(() => document.querySelector('.ledger').getBoundingClientRect().top + scrollY - 120), 600);
  await cap('Saxtakarlıq simulyasiyası', '…və portal bunu dərhal göstərir', 'Möhürlənmiş qeyd ilə bazadakı qeyd uyğun gəlmir: dəyişiklik gizlədilə bilmir.');
  await hold(4800);
  await p.request.post(`${B}/api/v1/admin/ledger/tamper/${app.applicationNumber}`);

  // ---------------------------------------------------------------- 9. open data
  await p.goto(B + '/seffafliq'); await hold(1500);
  await cap('Açıq məlumat', 'Open Contracting Data Standard (OCDS 1.1)', 'Müsabiqələr və qaliblər beynəlxalq standartda; rəsmi JSON sxeminə uyğunluğu yoxlanılıb. Fiziki şəxslərin adları açıqlanmır.');
  const ob = await p.locator('.ocds-box').boundingBox(); await glide(ob.x + ob.width - 160, ob.y + ob.height / 2); await hold(4800);
  await smoothScroll(900, 2500); await hold(1500);
  await p.request.post(B + '/api/v1/auth/logout');

  // ---------------------------------------------------------------- 10. outro
  const qr = await QRCode.toDataURL('https://aqrar-invest.vercel.app', { errorCorrectionLevel: 'H', margin: 1, width: 520, color: { dark: '#0b2219', light: '#ffffff' } });
  await card(`<div style="display:flex;gap:90px;align-items:center">
    <div>
      <img src="${icon}" style="width:110px;height:110px;border-radius:26px">
      <div style="font-size:72px;font-weight:700;margin-top:26px">Aqrar İnvest</div>
      <div style="font-size:28px;color:#cfe6d6;margin-top:10px;max-width:760px;line-height:1.4">EKTİS və myGov ilə inteqrasiyaya hazır, rəsmi açıq məlumatlara əsaslanan investisiya müsabiqəsi portalı</div>
      <div style="font-size:40px;font-weight:700;color:#e0a106;margin-top:36px">aqrar-invest.vercel.app</div>
    </div>
    <div style="background:#fff;padding:26px;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.4)"><img src="${qr}" style="width:420px;height:420px;display:block"></div>
  </div>`, 5000);

  await cdp.send('Page.stopScreencast');
  // The screencast only emits a frame when the page changes, so every frame lasts until the next one.
  const end = frames[frames.length - 1].t + 1.5;
  const lines = [];
  frames.forEach((f, i) => {
    const d = (i + 1 < frames.length ? frames[i + 1].t : end) - f.t;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, d).toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(path.join(OUT, 'frames.txt'), lines.join('\n') + '\n');
  console.log('FRAMES', frames.length, 'SECONDS', (end - frames[0].t).toFixed(1));
  await ctx.close();
  await browser.close();
})();
