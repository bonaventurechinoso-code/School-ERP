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

  // Case 1: params only
  // { params }: { params: { ... } }
  const regex1 = /{\s*params\s*}\s*:\s*{\s*params\s*:\s*{([\s\S]*?)}\s*}/g;
  if (regex1.test(content)) {
    content = content.replace(regex1, '{ params }: { params: Promise<{$1}> }');
    changed = true;
  }

  // Case 2: params and searchParams
  // { params, searchParams }: { params: { ... }, searchParams: { ... } }
  const regex2 = /{\s*params,\s*searchParams\s*}\s*:\s*{\s*params\s*:\s*{([\s\S]*?)},\s*searchParams\s*:\s*{([\s\S]*?)}\s*}/g;
  if (regex2.test(content)) {
    content = content.replace(regex2, '{ params, searchParams }: { params: Promise<{$1}>, searchParams: Promise<{$2}> }');
    changed = true;
  }

  if (changed) {
    // Inject `const { schoolDomain } = await params;` if the file uses params.schoolDomain
    // Find the function body start `{` which is usually after the params signature
    // Actually simpler: just replace `params.schoolDomain` with `(await params).schoolDomain` globally in that file
    
    // Note: To avoid syntax issues if it's not an async context, all these components should be async.
    // Ensure the function is async
    content = content.replace(/export default function/g, 'export default async function');
    
    content = content.replace(/params\.schoolDomain/g, '(await params).schoolDomain');
    content = content.replace(/params\.studentId/g, '(await params).studentId');
    content = content.replace(/params\.id/g, '(await params).id');
    
    // For searchParams
    content = content.replace(/searchParams\.tab/g, '(await searchParams).tab');

    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
});
