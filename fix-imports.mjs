import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

function fixFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const orig = content;
  // Fix @/ aliases to ~/
  content = content.replaceAll('from "@/', 'from "~/');
  content = content.replaceAll("from '@/", "from '~/");
  // Fix react-router-dom to react-router
  content = content.replaceAll('from "react-router-dom"', 'from "react-router"');
  content = content.replaceAll("from 'react-router-dom'", "from 'react-router'");
  if (content !== orig) {
    writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', basename(filePath));
  }
}

function walkDir(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) walkDir(full);
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) fixFile(full);
  }
}

const base = 'C:\\Users\\User\\shop-mate-ai\\.claude\\worktrees\\kind-wing\\app';
walkDir(join(base, 'components'));
walkDir(join(base, 'hooks'));
walkDir(join(base, 'lib'));
console.log('Done fixing imports');
