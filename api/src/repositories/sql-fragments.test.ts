import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  buildSubmissionFeatureTerminalSubquery,
  callerGrantedFeatureIds,
  codePropertyValueJson,
  featureReferencePropertyValueJson,
  isAccessibleToUser,
  isEffectivelySecured,
  isSubmissionFeatureCurrent,
  isSubmissionFeaturePublished,
  taxonPropertyValueJson
} from './sql-fragments';

describe('sql-fragments', () => {
  describe('isSubmissionFeaturePublished', () => {
    it('requires only an effective record', () => {
      const sql = isSubmissionFeaturePublished('sf');

      expect(sql).to.equal('sf.record_effective_date <= now()');
    });
  });

  describe('isSubmissionFeatureCurrent', () => {
    it('requires a published terminal feature that has not ended', () => {
      const sql = isSubmissionFeatureCurrent('sf');

      expect(sql).to.include('sf.record_effective_date <= now()');
      expect(sql).to.include('(sf.record_end_date IS NULL OR now() < sf.record_end_date)');
      expect(sql).to.include('sf.successor_submission_feature_id IS NULL');
    });
  });

  describe('buildSubmissionFeatureTerminalSubquery', () => {
    it('follows same-submission successors and returns only a current terminal id', () => {
      const sql = buildSubmissionFeatureTerminalSubquery('sf.submission_feature_id').toLowerCase();

      expect(sql).to.include('with recursive successor_chain');
      expect(sql).to.match(/successor_chain[\s\S]*\bunion\b(?!\s+all)/);
      expect(sql).to.include('successor.successor_submission_feature_id');
      expect(sql).to.include('successor.submission_id = chain.submission_id');
      expect(sql).to.include('union');
      expect(sql).to.not.include('union all');
      expect(sql).to.not.include('path');
      expect(sql).to.include('chain.successor_submission_feature_id is null');
      expect(sql).to.include('as terminal_submission_feature_id');
    });

    it('contains zero bound placeholders', () => {
      const sql = buildSubmissionFeatureTerminalSubquery('sf.submission_feature_id');

      expect(sql.match(/\?/g) || []).to.be.empty;
    });
  });

  describe('isEffectivelySecured', () => {
    it('reads the precomputed closure ancestry instead of a recursive parent walk', () => {
      // Verifies: the closure-based fragment probes submission_feature_closure on the
      // ancestry subset (is_ancestor = true), joins security on the target id, and gates
      // on the effective date — without any recursive CTE.

      // Step 1: Build the fragment for a feature id expression and lowercase for token matching
      const sql = isEffectivelySecured('wf.submission_feature_id').toLowerCase();

      // Step 2: Verify it reads the closure ancestry (source side keyed to the candidate feature)
      expect(sql).to.include('submission_feature_closure');
      expect(sql).to.include('is_ancestor');
      expect(sql).to.include('c.source_submission_feature_id =');

      // Step 3: Verify the security join is on the closure target id and its own lifecycle is enforcing
      expect(sql).to.include('sfs.submission_feature_id = c.target_submission_feature_id');
      expect(sql).to.include('sfs.record_effective_date <= now()');
      expect(sql).to.include('(sfs.record_end_date is null or now() < sfs.record_end_date)');
      expect(sql).to.not.include('submission_feature sf_sec');
      expect(sql).to.not.include('sf_sec.record_effective_date');
      expect(sql).to.not.include('sf_sec.record_end_date');

      // Step 4: Verify it does NOT fall back to the recursive parent walk
      expect(sql).to.not.include('with recursive');
      expect(sql).to.not.include('ancestor_chain');
    });

    it('contains zero bound placeholders', () => {
      // Verifies: the closure fragment is fully self-contained SQL with no `?` to bind

      // Step 1: Build the fragment
      const sql = isEffectivelySecured('wf.submission_feature_id');

      // Step 2: Count `?` placeholders — must be none
      expect(sql.match(/\?/g) || []).to.have.lengthOf(0);
    });
  });

  describe('callerGrantedFeatureIds', () => {
    it('unions the bitmaps of the scopes held by the caller through active team records', () => {
      const sql = callerGrantedFeatureIds().toLowerCase();

      expect(sql).to.include('select rb_or_agg(caller_scope.feature_ids)');
      expect(sql).to.include('from security_scope caller_scope');
      expect(sql).to.include('join team_security_scope caller_tss on caller_tss.team_id = caller_tm.team_id');
      expect(sql).to.include('caller_team.record_end_date is null');
      expect(sql).to.include('caller_tm.record_end_date is null');
    });

    it('reads each scope once however many of the caller teams hold it', () => {
      const sql = callerGrantedFeatureIds().toLowerCase();

      expect(sql).to.match(/where caller_scope\.security_scope_id in \(\s*select caller_tss\.security_scope_id/);
    });

    it('references no outer row, so the union is not rebuilt per candidate', () => {
      const sql = callerGrantedFeatureIds();
      const qualifiers = new Set(sql.match(/\b[a-z_]+(?=\.)/g));

      expect([...qualifiers].sort()).to.eql(['caller_scope', 'caller_team', 'caller_tm', 'caller_tss']);
    });

    it('contains exactly one bound placeholder for systemUserId', () => {
      const sql = callerGrantedFeatureIds();

      expect(sql.match(/\?/g) || []).to.have.lengthOf(1);
      expect(sql).to.include('caller_tm.system_user_id = ?');
    });
  });

  describe('isAccessibleToUser', () => {
    it('requires active team and membership records for scope grants', () => {
      const sql = isAccessibleToUser('wf.submission_feature_id').toLowerCase();

      expect(sql).to.include('join team caller_team');
      expect(sql).to.include('caller_team.record_end_date is null');
      expect(sql).to.include('caller_tm.record_end_date is null');
    });

    it('grants a secured feature by testing its id against the caller bitmap union', () => {
      const sql = isAccessibleToUser('wf.submission_feature_id').toLowerCase();

      expect(sql).to.include('rb_or_agg(caller_scope.feature_ids)');
      expect(sql).to.match(/coalesce\(rb_contains\(\([\s\S]*\), wf\.submission_feature_id\), false\)/);
      expect(sql).to.not.include('security_scope_anchor');
      expect(sql).to.not.include('urn_submission_id');
      expect(sql).to.not.include('with recursive');
    });

    it('requires the candidate closure self-loop for a bitmap grant', () => {
      const sql = isAccessibleToUser('wf.submission_feature_id').toLowerCase();

      expect(sql).to.include('granted_ready.source_submission_feature_id = wf.submission_feature_id');
      expect(sql).to.include('granted_ready.target_submission_feature_id = wf.submission_feature_id');
    });

    it('keeps the candidate feature expression bound to the caller when the caller aliases its row caller_scope', () => {
      const sql = isAccessibleToUser('caller_scope.submission_feature_id');

      // The candidate is tested outside the union subquery, where the fragment's own caller_scope is not visible.
      expect(sql).to.match(/\)\s*\), caller_scope\.submission_feature_id\), false\)/);
      expect(sql).to.include('granted_ready.source_submission_feature_id = caller_scope.submission_feature_id');
      expect(callerGrantedFeatureIds()).to.not.include('submission_feature_id');
    });

    it('contains exactly one bound placeholder for systemUserId', () => {
      // Verifies: only the team_member.system_user_id comparison is parameterized — exactly one `?`

      // Step 1: Build the fragment
      const sql = isAccessibleToUser('wf.submission_feature_id');

      // Step 2: Count `?` placeholders — must be exactly one (the system user id)
      expect(sql.match(/\?/g) || []).to.have.lengthOf(1);
    });
  });

  describe('taxonPropertyValueJson', () => {
    it('builds the taxon value object from the aliased taxon row', () => {
      const sql = taxonPropertyValueJson('t');

      expect(sql).to.include('jsonb_build_object(');
      expect(sql).to.include("'taxon_id', t.taxon_id");
      expect(sql).to.include("'tsn', t.itis_tsn");
      expect(sql).to.include("'rank', t.rank");
    });

    it('labels with the scientific name', () => {
      const sql = taxonPropertyValueJson('tx');

      expect(sql).to.include("'label', tx.itis_scientific_name");
      expect(sql).to.not.include('COALESCE(');
    });

    it('contains zero bound placeholders', () => {
      const sql = taxonPropertyValueJson('t');

      expect(sql.match(/\?/g) || []).to.have.lengthOf(0);
    });
  });

  describe('codePropertyValueJson', () => {
    it('builds the code value object from the aliased code and codeset rows', () => {
      const sql = codePropertyValueJson('ccc', 'cs');

      expect(sql).to.include('jsonb_build_object(');
      expect(sql).to.include("'codeset_key', cs.key");
      expect(sql).to.include("'codeset_label', cs.label");
      expect(sql).to.include("'code_key', ccc.key");
      expect(sql).to.include("'code_label', ccc.label");
    });

    it('labels with the code label', () => {
      const sql = codePropertyValueJson('code', 'codeset');

      expect(sql).to.include("'label', code.label");
    });

    it('contains zero bound placeholders', () => {
      const sql = codePropertyValueJson('ccc', 'cs');

      expect(sql.match(/\?/g) || []).to.have.lengthOf(0);
    });
  });

  describe('featureReferencePropertyValueJson', () => {
    it('builds the feature reference value object from the aliased referenced feature row', () => {
      const sql = featureReferencePropertyValueJson('referenced_sf');

      expect(sql).to.include('jsonb_build_object(');
      expect(sql).to.include("'urn', referenced_sf.urn");
      expect(sql).to.include("'label', referenced_sf.urn");
    });

    it('contains zero bound placeholders', () => {
      const sql = featureReferencePropertyValueJson('referenced_sf');

      expect(sql.match(/\?/g) || []).to.have.lengthOf(0);
    });
  });
});
