// Optional historical oracle; the normal suite has no Git-history dependency.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const ts = require('typescript');
const baseline = require('./baseline.json');
const root = path.resolve(__dirname, '../../../..');
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const normalize = (sql) =>
  sql
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
// Load the pre-refactor definition from the recorded Git commit, never a mutable runtime module.
function historicalModule(file) {
  const source = execFileSync('git', ['show', `${baseline.sourceCommit}:${file}`], { cwd: root, encoding: 'utf8' });
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const historicalRequire = (request) => {
    assert(request.startsWith('./'), 'baseline must only import migration-local definitions');
    return historicalModule(path.posix.join(path.posix.dirname(file), `${request}.ts`));
  };
  new Function('require', 'module', 'exports', javascript)(historicalRequire, module, module.exports);
  return module.exports;
}

module.exports = function comparisonSql() {
  const original = historicalModule('database/src/migrations/20260717000000_bcgw_materialised_views/views.ts').VIEW_SQL;
  for (const view of baseline.views) {
    const old = original.find((v) => v.name === view.name);
    assert.equal(
      createHash('sha256')
        .update(normalize(old.sql.split(' AS\n')[1].replace(/;$/, '')))
        .digest('hex'),
      view.querySha256,
      `${view.name}: behavioral oracle changed`
    );
    assert.deepEqual(old.comments, view.comments);
  }
  let comparisonSql = '';
  for (const old of original) {
    comparisonSql += old.sql.replace(`bcgw.${old.name}_new`, `baseline.${old.name}`) + '\n';
    for (const [column, comment] of Object.entries(old.comments)) {
      comparisonSql += `COMMENT ON COLUMN baseline.${old.name}.${column} IS ${literal(comment)};\n`;
    }
    const columns = Object.keys(old.comments).map((column) => column.toLowerCase());
    const legacyColumns = columns
      .map((column) =>
        ['feature_id', 'submission_id', 'submission_name'].includes(column) ? column : `${column}::text AS ${column}`
      )
      .join(', ');
    // Legacy multirow exports have a different cardinality contract; assert those cases separately.
    const eligible = `feature_id NOT IN (302,317,320,399) AND feature_id IN (
      SELECT feature_id FROM baseline.${old.name} GROUP BY feature_id HAVING count(*) = 1)`;
    comparisonSql += `DO $$ BEGIN ASSERT NOT EXISTS (
      (SELECT ${legacyColumns} FROM baseline.${old.name} WHERE ${eligible}
        EXCEPT ALL SELECT * FROM bcgw.${old.name} WHERE ${eligible})
      UNION ALL
      (SELECT * FROM bcgw.${old.name} WHERE ${eligible}
        EXCEPT ALL SELECT ${legacyColumns} FROM baseline.${old.name} WHERE ${eligible})
    ), '${old.name}: single-valued legacy comparison'; END $$;\n`;
  }
  return comparisonSql;
};
