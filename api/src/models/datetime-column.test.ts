import { expect } from 'chai';
import { describe, it } from 'mocha';

import { assertNoDatetimeColumnCollisions } from './datetime-column';

describe('datetime-column', () => {
  describe('assertNoDatetimeColumnCollisions', () => {
    it('should not throw for a clean property list', () => {
      const properties = [
        { feature_property_name: 'name', feature_property_type_name: 'string' },
        { feature_property_name: 'observation', feature_property_type_name: 'datetime' },
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];

      expect(() => assertNoDatetimeColumnCollisions(properties)).to.not.throw();
    });

    it('should not throw for a datetime property whose name itself ends in _date', () => {
      // A datetime property named `start_date` expands to `start_date_date` /
      // `start_date_time`. Neither matches `start_date` itself, so there's no
      // self-collision. Live data has `start_date` and `end_date` — must not flag.
      const properties = [
        { feature_property_name: 'start_date', feature_property_type_name: 'datetime' },
        { feature_property_name: 'end_date', feature_property_type_name: 'datetime' }
      ];

      expect(() => assertNoDatetimeColumnCollisions(properties)).to.not.throw();
    });

    it('should throw when a datetime expansion collides with a sibling _date property', () => {
      const properties = [
        { feature_property_name: 'observation', feature_property_type_name: 'datetime' },
        { feature_property_name: 'observation_date', feature_property_type_name: 'string' }
      ];

      expect(() => assertNoDatetimeColumnCollisions(properties))
        .to.throw(Error)
        .with.property('message')
        .that.matches(/observation/)
        .and.matches(/observation_date/);
    });

    it('should throw when a datetime expansion collides with a sibling _time property', () => {
      const properties = [
        { feature_property_name: 'observation', feature_property_type_name: 'datetime' },
        { feature_property_name: 'observation_time', feature_property_type_name: 'number' }
      ];

      expect(() => assertNoDatetimeColumnCollisions(properties)).to.throw(/observation_time/);
    });

    it('should throw when two datetime properties collide via expansion', () => {
      // datetime `obs` → expands to `obs_date` / `obs_time`. datetime `obs_date`
      // is a real property whose name matches the first's expansion. Last-write-
      // wins in the SQL UNION would corrupt both.
      const properties = [
        { feature_property_name: 'obs', feature_property_type_name: 'datetime' },
        { feature_property_name: 'obs_date', feature_property_type_name: 'datetime' }
      ];

      expect(() => assertNoDatetimeColumnCollisions(properties)).to.throw(/obs_date/);
    });

    it('should not throw for an empty property list', () => {
      expect(() => assertNoDatetimeColumnCollisions([])).to.not.throw();
    });

    it('should not throw for a list with only non-datetime properties', () => {
      // Even with `_date` / `_time` suffixed names, no expansion happens without
      // a datetime property — so no collision is possible.
      const properties = [
        { feature_property_name: 'sample_date', feature_property_type_name: 'string' },
        { feature_property_name: 'sample_time', feature_property_type_name: 'string' }
      ];

      expect(() => assertNoDatetimeColumnCollisions(properties)).to.not.throw();
    });
  });
});
