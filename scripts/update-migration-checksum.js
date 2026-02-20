const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260124071929_add_agency_auth_onboarding',
  'migration.sql'
);
const content = fs.readFileSync(migrationPath, 'utf8');
const checksum = crypto.createHash('sha256').update(content).digest('hex');

const sql = `UPDATE "_prisma_migrations"
SET checksum = '${checksum}'
WHERE migration_name = '20260124071929_add_agency_auth_onboarding';
`;

const outPath = path.join(__dirname, '..', 'prisma', 'update_checksum.sql');
fs.writeFileSync(outPath, sql);
console.log('Checksum:', checksum);
console.log('Written to prisma/update_checksum.sql');
console.log('Run: npx prisma db execute --file prisma/update_checksum.sql');
