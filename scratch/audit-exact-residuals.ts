import fs from 'fs';
import path from 'path';

const targetDirs = [
  'src/server/actions',
  'src/server/services',
  'src/app/api',
  'src/server/auth',
  'src/server/tenant',
  'src/app/(dashboard)',
];

const patterns = [
  'PermissionService.hasPermission',
  'PermissionService.requirePermission',
  'verifyBranchBoundary',
  'role ===',
  'role !==',
  'membership.role ===',
  'membership.role !==',
  'isBusinessOwner',
  'isOwner',
  'isSuperAdmin',
];

interface Finding {
  file: string;
  line: number;
  pattern: string;
  content: string;
  category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  reason: string;
}

const findings: Finding[] = [];

function classify(file: string, pattern: string, content: string): { category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'; reason: string } {
  if (file.includes('/super-admin') || content.includes('isSuperAdmin')) {
    return { category: 'F', reason: 'Platform Super Admin boundary' };
  }
  if (file.includes('permission.service.ts')) {
    return { category: 'G', reason: 'Legacy PermissionService facade implementation' };
  }
  if (file.includes('policy-engine.ts') || file.includes('authorization-context.ts') || file.includes('scope-target-validator.ts')) {
    return { category: 'A', reason: 'RBAC V2 Policy Engine core architecture' };
  }
  if (file.includes('account.service.ts') || file.includes('resolver.ts') || file.includes('/(dashboard)/')) {
    return { category: 'D', reason: 'UI / UX navigation or workspace route mapping' };
  }
  if (file.includes('role-governance.service.ts') || file.includes('scope-grant.service.ts')) {
    return { category: 'B', reason: 'Domain business governance invariant (role/permission hierarchy enforcement)' };
  }
  if (file.includes('report.service.ts') || file.includes('waiter.service.ts')) {
    return { category: 'B', reason: 'Domain data scope filtering or owner fallback' };
  }
  return { category: 'C', reason: 'Unclassified residual' };
}

function scanDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((lineText, idx) => {
        for (const p of patterns) {
          if (lineText.includes(p)) {
            const relFile = fullPath.replace(/\\/g, '/');
            const { category, reason } = classify(relFile, p, lineText);
            findings.push({
              file: relFile,
              line: idx + 1,
              pattern: p,
              content: lineText.trim(),
              category,
              reason,
            });
          }
        }
      });
    }
  }
}

for (const d of targetDirs) {
  scanDir(d);
}

const countsByPattern: Record<string, number> = {};
for (const p of patterns) {
  countsByPattern[p] = 0;
}

const countsByCategory: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };

for (const f of findings) {
  countsByPattern[f.pattern] = (countsByPattern[f.pattern] || 0) + 1;
  countsByCategory[f.category] = (countsByCategory[f.category] || 0) + 1;
}

console.log('====================================================');
console.log(`TOTAL RESIDUAL FINDINGS MATCHED: ${findings.length}`);
console.log('====================================================\n');

console.log('--- COUNTS BY PATTERN ---');
console.table(countsByPattern);

console.log('\n--- COUNTS BY CATEGORY ---');
console.table(countsByCategory);

const classC = findings.filter((f) => f.category === 'C');
console.log(`\nCLASS C (AUTHORIZATION RESIDUALS - TARGET 0): ${classC.length}`);

fs.writeFileSync(
  'c:/Users/x/.antigravity/wsnexa/scratch/audit-classified-results.json',
  JSON.stringify({ total: findings.length, countsByPattern, countsByCategory, findings }, null, 2)
);
