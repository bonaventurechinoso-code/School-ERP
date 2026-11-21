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
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrome_cdp_assess_' + Date.now());

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
  console.log('Spawning Chrome with CDP for Assessment Acceptance Testing...');
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

  // -------------------------------------------------------------
  // 1. CRECHE DEMO ASSESSMENT ACCEPTANCE
  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log('[1/4] AUDITING CRECHE / EARLY YEARS DEMO: /demo-creche/exams');
  console.log('========================================');
  await setTenantAuth('demo-creche', 'Demo Creche', 'Creche / Nursery & Kindergarten');
  await navigateAndWait('http://localhost:3000/demo-creche/exams', 'table, select, h1, h2');
  const crecheAudit = await send('Runtime.evaluate', {
    expression: `(() => {
      const pageText = document.body.innerText;
      const selects = Array.from(document.querySelectorAll('select'));
      const classSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('Creche') || o.text.includes('Nursery') || o.text.includes('Level') || o.text.includes('JSS') || o.text.includes('Primary')));
      const classOptions = classSelect ? Array.from(classSelect.options).map(o => o.text.trim()) : [];
      const hasPrimary = classOptions.some(o => o.includes('Primary'));
      const hasSecondary = classOptions.some(o => o.includes('JSS') || o.includes('SSS'));
      const hasTertiary = classOptions.some(o => o.includes('Level') || o.includes('ND'));
      const tabs = Array.from(document.querySelectorAll('button, a')).map(el => el.textContent.trim()).filter(t => t.includes('Milestone') || t.includes('Exam') || t.includes('Roster') || t.includes('Broadsheet'));
      return {
        classOptions,
        hasPrimary,
        hasSecondary,
        hasTertiary,
        tabs,
        pageSnippet: pageText.slice(0, 400).replace(/\\s+/g, ' ')
      };
    })()`,
    returnByValue: true,
  });
  console.log('Creche Audit Results:', JSON.stringify(crecheAudit.result.value, null, 2));
  await screenshot('creche-assessment-acceptance.png');

  // -------------------------------------------------------------
  // 2. PRIMARY DEMO ASSESSMENT ACCEPTANCE
  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log('[2/4] AUDITING PRIMARY DEMO: /demo-primary/exams');
  console.log('========================================');
  await setTenantAuth('demo-primary', 'Demo Primary', 'Primary School');
  await navigateAndWait('http://localhost:3000/demo-primary/exams', 'table, select, h1, h2');
  const primaryAudit = await send('Runtime.evaluate', {
    expression: `(() => {
      const pageText = document.body.innerText;
      const selects = Array.from(document.querySelectorAll('select'));
      const classSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('Primary') || o.text.includes('Level') || o.text.includes('JSS')));
      const classOptions = classSelect ? Array.from(classSelect.options).map(o => o.text.trim()) : [];
      const hasCreche = classOptions.some(o => o.includes('Creche') || o.includes('Nursery'));
      const hasSecondary = classOptions.some(o => o.includes('JSS') || o.includes('SSS'));
      const hasTertiary = classOptions.some(o => o.includes('Level') || o.includes('ND'));
      return {
        classOptions,
        hasCreche,
        hasSecondary,
        hasTertiary,
        pageSnippet: pageText.slice(0, 400).replace(/\\s+/g, ' ')
      };
    })()`,
    returnByValue: true,
  });
  console.log('Primary Audit Results:', JSON.stringify(primaryAudit.result.value, null, 2));
  await screenshot('primary-assessment-acceptance.png');

  // -------------------------------------------------------------
  // 3. SECONDARY DEMO ASSESSMENT ACCEPTANCE
  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log('[3/4] AUDITING SECONDARY DEMO: /demo-secondary/exams');
  console.log('========================================');
  await setTenantAuth('demo-secondary', 'Demo Secondary', 'Secondary School');
  await navigateAndWait('http://localhost:3000/demo-secondary/exams', 'table, select, h1, h2');
  const secondaryAudit = await send('Runtime.evaluate', {
    expression: `(() => {
      const pageText = document.body.innerText;
      const selects = Array.from(document.querySelectorAll('select'));
      const classSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('JSS') || o.text.includes('SSS') || o.text.includes('Level') || o.text.includes('Primary')));
      const classOptions = classSelect ? Array.from(classSelect.options).map(o => o.text.trim()) : [];
      const hasCreche = classOptions.some(o => o.includes('Creche') || o.includes('Nursery'));
      const hasPrimary = classOptions.some(o => o.includes('Primary'));
      const hasTertiary = classOptions.some(o => o.includes('Level') || o.includes('ND'));
      return {
        classOptions,
        hasCreche,
        hasPrimary,
        hasTertiary,
        pageSnippet: pageText.slice(0, 400).replace(/\\s+/g, ' ')
      };
    })()`,
    returnByValue: true,
  });
  console.log('Secondary Audit Results:', JSON.stringify(secondaryAudit.result.value, null, 2));
  await screenshot('secondary-assessment-acceptance.png');

  // -------------------------------------------------------------
  // 4. TERTIARY DEMO ASSESSMENT ACCEPTANCE (UNIVERSITY)
  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log('[4/4] AUDITING TERTIARY DEMO: /demo-university/exams');
  console.log('========================================');
  await setTenantAuth('demo-university', 'Demo University', 'Higher Institution / University');
  await navigateAndWait('http://localhost:3000/demo-university/exams', 'table, select, h1, h2');
  const tertiarySchedulesAudit = await send('Runtime.evaluate', {
    expression: `(() => {
      const pageText = document.body.innerText;
      const selects = Array.from(document.querySelectorAll('select'));
      const classSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('Level') || o.text.includes('Primary') || o.text.includes('JSS')));
      const classOptions = classSelect ? Array.from(classSelect.options).map(o => o.text.trim()) : [];
      const hasCreche = classOptions.some(o => o.includes('Creche') || o.includes('Nursery'));
      const hasPrimary = classOptions.some(o => o.includes('Primary'));
      const hasSecondary = classOptions.some(o => o.includes('JSS') || o.includes('SSS'));
      
      // Check for forbidden K-12 terms
      const textLower = pageText.toLowerCase();
      const forbiddenFound = [];
      if (textLower.includes('1st term') || textLower.includes('2nd term') || textLower.includes('3rd term')) {
        forbiddenFound.push('1st/2nd/3rd Term found');
      }
      if (textLower.includes('primary 1') || textLower.includes('primary 2') || textLower.includes('primary 6')) {
        forbiddenFound.push('Primary 1-6 found');
      }
      
      const containsSemesters = textLower.includes('semester');
      const containsCourses = textLower.includes('course');
      const contains100Level = textLower.includes('100 level');

      return {
        classOptions,
        hasCreche,
        hasPrimary,
        hasSecondary,
        forbiddenFound,
        containsSemesters,
        containsCourses,
        contains100Level,
        pageSnippet: pageText.slice(0, 450).replace(/\\s+/g, ' ')
      };
    })()`,
    returnByValue: true,
  });
  console.log('Tertiary Schedules Audit Results:', JSON.stringify(tertiarySchedulesAudit.result.value, null, 2));
  await screenshot('tertiary-assessment-schedules.png');

  // Verify Tertiary Grading Tab (tab=grading)
  console.log('\n--- Auditing Tertiary Grading Broadsheet Tab: /demo-university/exams?tab=grading ---');
  await navigateAndWait('http://localhost:3000/demo-university/exams?tab=grading', 'table, select');
  const tertiaryGradingAudit = await send('Runtime.evaluate', {
    expression: `(() => {
      const pageText = document.body.innerText;
      const selects = Array.from(document.querySelectorAll('select'));
      const periodSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('Semester') || o.text.includes('Term')));
      const periodOptions = periodSelect ? Array.from(periodSelect.options).map(o => o.text.trim()) : [];
      
      const classSelect = selects.find(s => Array.from(s.options).some(o => o.text.includes('Level') || o.text.includes('Primary')));
      const classOptions = classSelect ? Array.from(classSelect.options).map(o => o.text.trim()) : [];

      const textLower = pageText.toLowerCase();
      const forbiddenFound = [];
      if (textLower.includes('1st term') || textLower.includes('2nd term') || textLower.includes('3rd term')) {
        forbiddenFound.push('1st/2nd/3rd Term found');
      }
      if (textLower.includes('primary 1')) {
        forbiddenFound.push('Primary 1 found');
      }

      return {
        periodOptions,
        classOptions,
        forbiddenFound,
        pageSnippet: pageText.slice(0, 400).replace(/\\s+/g, ' ')
      };
    })()`,
    returnByValue: true,
  });
  console.log('Tertiary Grading Broadsheet Audit:', JSON.stringify(tertiaryGradingAudit.result.value, null, 2));
  await screenshot('tertiary-assessment-broadsheet.png');

  ws.close();
  chrome.kill();
  console.log('\n========================================');
  console.log('ALL AUDITS COMPLETED SUCCESSFULLY!');
  console.log('========================================');
}

main().catch((err) => {
  console.error('Fatal assessment audit error:', err);
  process.exit(1);
});
