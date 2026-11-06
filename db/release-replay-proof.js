const { createHash } = require('node:crypto');
const { restoreConstraintCast } = require('./schema-snapshot');
const sha = value => createHash('sha256').update(value).digest('hex');
function schemaDigest(snapshot) {
  const canonical = Object.fromEntries(Object.entries(snapshot).filter(([key]) => !['grants','schemaGrants'].includes(key)).map(([key,value]) =>
    [key, key === 'constraints' ? value.map(row => ({ ...row, definition: { ...row.definition, definition: restoreConstraintCast(row.definition.definition) } })) : value]));
  return sha(JSON.stringify(canonical));
}
function endpointDigest(value) {
  const url = new URL(value);
  return sha(url.hostname.replace(/-pooler\./, '.') + url.pathname);
}
function verifyReplayProof(proof, { production, development, prodUrl, devUrl, pending, hashes, now = Date.now() }) {
  if (!proof || proof.format !== 1 || proof.kind !== 'schema-only-migration-replay' || proof.verified !== true || proof.cleanupComplete !== true) return false;
  const timestamp = Date.parse(proof.verifiedAt);
  if (!Number.isFinite(timestamp) || timestamp > now + 60_000 || now - timestamp > 48 * 60 * 60 * 1000) return false;
  if (proof.productionEndpoint !== endpointDigest(prodUrl) || proof.developmentEndpoint !== endpointDigest(devUrl)) return false;
  if (proof.productionSchema !== schemaDigest(production) || proof.developmentSchema !== schemaDigest(development) || proof.replayedSchema !== schemaDigest(development)) return false;
  if (JSON.stringify(proof.pending) !== JSON.stringify(pending) || !pending.length) return false;
  return JSON.stringify(proof.migrationHashes) === JSON.stringify(hashes);
}
module.exports = { schemaDigest, endpointDigest, verifyReplayProof };
