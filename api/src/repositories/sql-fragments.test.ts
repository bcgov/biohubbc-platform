import { expect } from 'chai';
import { describe, it } from 'mocha';
import { isAccessibleToUser, isEffectivelySecured, isSubmissionFeatureActive } from './sql-fragments';

describe('sql-fragments', () => {
  describe('isSubmissionFeatureActive', () => {
    it('requires an effective record that has not ended', () => {
      const sql = isSubmissionFeatureActive('sf');

      expect(sql).to.include('sf.record_effective_date <= now()');
      expect(sql).to.include('(sf.record_end_date IS NULL OR now() < sf.record_end_date)');
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

      // Step 3: Verify the security join is on the closure target id and gated by effective date
      expect(sql).to.include('sfs.submission_feature_id = c.target_submission_feature_id');
      expect(sql).to.include('record_effective_date <= now()');
      expect(sql).to.include('record_end_date is null or now() <');

      // Step 4: Verify it does NOT fall back to the recursive parent walk
      expect(sql).to.not.include('with recursive');
      expect(sql).to.not.include('ancestor_chain');
    });

    it('contains zero bound placeholders', () => {
      // Verifies: the closure fragment is fully self-contained SQL with no `?` to bind

      // Step 1: Build the fragment
      const sql = isEffectivelySecured('wf.submission_feature_id');

      // Step 2: Count `?` placeholders — must be none
      expect((sql.match(/\?/g) || []).length).to.equal(0);
    });
  });

  describe('isAccessibleToUser', () => {
    it('requires active team records for scope grants', () => {
      const sql = isAccessibleToUser('wf.submission_feature_id').toLowerCase();

      expect(sql).to.include('join team t on t.team_id = tss.team_id');
      expect(sql).to.include('and t.record_end_date is null');
    });

    it('revalidates cached anchors before treating them as grants', () => {
      const sql = isAccessibleToUser('wf.submission_feature_id').toLowerCase();

      expect(sql).to.include('closure_ready');
      expect(sql).to.include('submission_feature_security');
      expect(sql).to.include('urn_submission_id');
      expect(sql).to.include('urn_feature_type');
      expect(sql).to.include('urn_feature_id');
      expect(sql).to.include('anchor_sf.record_effective_date <= now()');
    });

    it('probes the closure ancestry for a scope anchor instead of a recursive parent walk', () => {
      // Verifies: the rewritten access check resolves ancestry via the precomputed closure
      // (is_ancestor = true) and joins security_scope_anchor on the closure target id — no
      // recursive CTE.

      // Step 1: Build the fragment and lowercase for token matching
      const sql = isAccessibleToUser('wf.submission_feature_id').toLowerCase();

      // Step 2: Verify it reads the closure ancestry
      expect(sql).to.include('submission_feature_closure');
      expect(sql).to.include('is_ancestor');

      // Step 3: Verify the scope anchor is joined on the closure target id
      expect(sql).to.include(
        'security_scope_anchor ssa on ssa.anchor_submission_feature_id = c.target_submission_feature_id'
      );

      // Step 4: Verify it does NOT use the recursive parent walk
      expect(sql).to.not.include('with recursive');
      expect(sql).to.not.include('ancestor_chain');
    });

    it('contains exactly one bound placeholder for systemUserId', () => {
      // Verifies: only the team_member.system_user_id comparison is parameterized — exactly one `?`

      // Step 1: Build the fragment
      const sql = isAccessibleToUser('wf.submission_feature_id');

      // Step 2: Count `?` placeholders — must be exactly one (the system user id)
      expect((sql.match(/\?/g) || []).length).to.equal(1);
    });
  });
});
