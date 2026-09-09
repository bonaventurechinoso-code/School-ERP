const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('c:/Users/DELL/Desktop/SchoolERP/src/app');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Revert `(await params).` to `params.` globally
  if (content.includes('(await params).')) {
    content = content.replace(/\(await params\)\./g, 'params.');
    changed = true;
  }
  if (content.includes('(await searchParams).')) {
    content = content.replace(/\(await searchParams\)\./g, 'searchParams.');
    changed = true;
  }

  // 1. Rename { params } to { params: paramsPromise } in signature
  const sigRegex = /export default async function\s+(\w+)\s*\(\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*Promise<([^>]+)>\s*\}\)\s*\{/g;
  if (sigRegex.test(content)) {
    content = content.replace(sigRegex, 'export default async function $1({ params: paramsPromise }: { params: Promise<$2> }) {\n  const params = await paramsPromise;');
    changed = true;
  }
  
  const sigRegex2 = /export default async function\s+(\w+)\s*\(\{\s*params,\s*searchParams\s*\}\s*:\s*\{\s*params\s*:\s*Promise<([^>]+)>,\s*searchParams\s*:\s*Promise<([^>]+)>\s*\}\)\s*\{/g;
  if (sigRegex2.test(content)) {
    content = content.replace(sigRegex2, 'export default async function $1({ params: paramsPromise, searchParams: searchParamsPromise }: { params: Promise<$2>, searchParams: Promise<$3> }) {\n  const params = await paramsPromise;\n  const searchParams = await searchParamsPromise;');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
});
