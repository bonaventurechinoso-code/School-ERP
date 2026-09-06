const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src', 'app'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('<table')) {
     const regex = /className="([^"]*)overflow-hidden([^"]*)"(>\s*<table)/g;
     const newContent = content.replace(regex, 'className="$1overflow-x-auto$2"$3');
     
     if (content !== newContent) {
       fs.writeFileSync(file, newContent, 'utf8');
       console.log(`Updated ${file}`);
     } else if (!content.includes('overflow-x-auto')) {
       const regex2 = /(<div className="[^"]*)(">\s*<table)/g;
       const newContent2 = content.replace(regex2, (match, p1, p2) => {
           if (p1.includes('overflow-x-auto')) return match;
           return p1 + ' overflow-x-auto' + p2;
       });
       if (content !== newContent2) {
           fs.writeFileSync(file, newContent2, 'utf8');
           console.log(`Updated (added overflow-x-auto) ${file}`);
       }
     }
  }
});
