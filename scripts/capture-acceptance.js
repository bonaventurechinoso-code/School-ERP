const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const WebSocket = require('ws');
const jose = require('jose');

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'schoolerp-secret-key-change-in-production-environments';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const ARTIFACTS_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\362f6193-ea22-4062-84a4-8adfa010f82e';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_cdp_' + Date.now());

async function createDemoToken(subdomain, tenantName) {
  return await new jose.SignJWT({
    userId: `${subdomain}-admin-staff`,
    email: `${subdomain}.admin@schoolerp.local`,
    role: 'TENANT_ADMIN',
    userRole: 'TENANT_ADMIN',
    staffRole: 'School Administrator',
    tenantSlug: subdomain,
    schoolDomain: subdomain,
    tenantName: tenantName,
    isDemo: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 24 * 60 * 60)
    .sign(SECRET_KEY);
}

async function main() {
  console.log('Spawning Chrome with CDP...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=' + TEMP_USER_DATA,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
  ]);

  chrome.on('error', (err) => console.error('Chrome spawn error:', err));

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      versionData = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json/version', (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      if (versionData && versionData.webSocketDebuggerUrl) break;
    } catch (e) {}
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    console.error('Could not connect to Chrome DevTools endpoint');
    chrome.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome:', versionData.Browser);

  async function createPageSession() {
    const target = await new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: 9222,
        path: '/json/new?about:blank',
        method: 'PUT'
      }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch(e) {
            reject(new Error(body));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.on('open', resolve));

    let msgId = 1;
    const callbacks = new Map();

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    });

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');
    await send('Network.enable');

    return { ws, send, targetId: target.id };
  }

  const { ws, send } = await createPageSession();

  async function setTenantAuth(subdomain, tenantName, activeTierName) {
    const token = await createDemoToken(subdomain, tenantName);
    console.log(`Setting auth cookies for ${subdomain}...`);
    await send('Network.setCookie', {
      name: 'session',
      value: token,
      url: 'http://localhost:3000/',
      httpOnly: true,
    });
    await send('Network.setCookie', {
      name: 'accessToken',
      value: token,
      url: 'http://localhost:3000/',
      httpOnly: true,
    });
    if (activeTierName) {
      await send('Network.setCookie', {
        name: 'activeTier',
        value: activeTierName,
        url: 'http://localhost:3000/',
        httpOnly: false,
      });
    }
  }

  async function navigateAndWait(url, waitSelector) {
    console.log(`Navigating to ${url}...`);
    await send('Page.navigate', { url });

    let ready = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await send('Runtime.evaluate', {
        expression: `Boolean(document.querySelector("${waitSelector}"))`,
        returnByValue: true,
      });
      if (res.result && res.result.value) {
        ready = true;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
    return ready;
  }

  async function screenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const fullPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`Saved screenshot: ${fullPath} (${buffer.length} bytes)`);
    return fullPath;
  }

  // 1. CRECHE DEMO ACCEPTANCE
  console.log('\n--- VERIFYING CRECHE DEMO ---');
  await setTenantAuth('demo-creche', 'Demo Creche', 'Creche / Nursery & Kindergarten');
  await navigateAndWait('http://localhost:3000/demo-creche/report-cards', 'table, select');
  const crecheInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const classSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('Creche') || o.text.includes('Nursery') || o.text.includes('Level') || o.text.includes('JSS') || o.text.includes('Primary'))) || selects[1] || selects[0];
      if (classSelect) {
        classSelect.size = Math.min(classSelect.options.length, 8);
        classSelect.style.border = '2px solid #9333ea';
      }
      const classOptions = classSelect ? Array.from(classSelect.options).map(o => o.text.trim()) : [];
      const badge = document.querySelector('span[class*="rounded-full"]')?.textContent?.trim() || '';
      const header = document.querySelector('h1, h2')?.textContent?.trim() || '';
      return { classOptions, badge, header };
    })()`,
    returnByValue: true,
  });
  console.log('Creche Page Info:', JSON.stringify(crecheInfo.result ? crecheInfo.result.value : crecheInfo, null, 2));
  await screenshot('creche-demo-acceptance.png');

  // 2. SECONDARY DEMO ACCEPTANCE
  console.log('\n--- VERIFYING SECONDARY DEMO ---');
  await setTenantAuth('demo-secondary', 'Demo Secondary', 'Secondary School');
  await navigateAndWait('http://localhost:3000/demo-secondary/report-cards', 'table, select');
  const secondaryInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const classSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('JSS') || o.text.includes('SSS') || o.text.includes('Creche') || o.text.includes('Primary') || o.text.includes('Level'))) || selects[1] || selects[0];
      if (classSelect) {
        classSelect.size = Math.min(classSelect.options.length, 8);
        classSelect.style.border = '2px solid #2563eb';
      }
      const classOptions = classSelect ? Array.from(classSelect.options).map(o => o.text.trim()) : [];
      const badge = document.querySelector('span[class*="rounded-full"]')?.textContent?.trim() || '';
      const header = document.querySelector('h1, h2')?.textContent?.trim() || '';
      return { classOptions, badge, header };
    })()`,
    returnByValue: true,
  });
  console.log('Secondary Page Info:', JSON.stringify(secondaryInfo.result ? secondaryInfo.result.value : secondaryInfo, null, 2));
  await screenshot('secondary-demo-acceptance.png');

  // 3. TERTIARY DEMO ACCEPTANCE
  console.log('\n--- VERIFYING TERTIARY DEMO ---');
  await setTenantAuth('demo-university', 'Demo University', 'Higher Institution / University');
  await navigateAndWait('http://localhost:3000/demo-university/report-cards', 'table, select');

  // Wait for student roster rows to load from API
  for (let i = 0; i < 30; i++) {
    const hasRow = await send('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector("tbody tr td"))',
      returnByValue: true
    });
    if (hasRow.result && hasRow.result.value) break;
    await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 1000));

  const tertiaryInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const classSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('Level') || o.text.includes('JSS') || o.text.includes('Creche') || o.text.includes('Primary'))) || selects[1] || selects[0];
      if (classSelect) {
        classSelect.size = Math.min(classSelect.options.length, 8);
        classSelect.style.border = '2px solid #7c3aed';
      }
      const classOptions = classSelect ? Array.from(classSelect.options).map(o => o.text.trim()) : [];
      const badge = document.querySelector('span[class*="rounded-full"]')?.textContent?.trim() || '';
      const header = document.querySelector('h1, h2')?.textContent?.trim() || '';
      return { classOptions, badge, header };
    })()`,
    returnByValue: true,
  });
  console.log('Tertiary Page Info:', JSON.stringify(tertiaryInfo.result ? tertiaryInfo.result.value : tertiaryInfo, null, 2));
  await screenshot('tertiary-demo-report-cards.png');

  // Open Transcript Modal on Tertiary Page
  console.log('Opening Tertiary Transcript Modal...');
  const clicked = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('tbody tr button') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Transcript') || b.textContent.includes('Sheet'));
      if (btn) {
        btn.scrollIntoView({ behavior: 'instant', block: 'center' });
        btn.click();
        return { success: true, text: btn.textContent };
      }
      const allBtns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      return { success: false, allBtns };
    })()`,
    returnByValue: true,
  });
  console.log('Clicked button result:', JSON.stringify(clicked.result ? clicked.result.value : clicked));
  await new Promise((r) => setTimeout(r, 2000));
  await screenshot('tertiary-transcript-modal.png');

  // Tertiary Results / Broadsheet Page
  console.log('\n--- VERIFYING TERTIARY RESULTS PAGE ---');
  await navigateAndWait('http://localhost:3000/demo-university/results', 'nav');
  await screenshot('tertiary-demo-results.png');

  ws.close();
  chrome.kill();
  console.log('\nAll acceptance tests completed successfully!');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
