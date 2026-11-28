import { TileExtentMap } from 'components/map/TileExtentMap';
import { SUBMISSION_FEATURE_MAP_SECTION_HEIGHT } from 'constants/spatial';
import { CreateSubmissionFeatureTileSession, useSubmissionFeatureTileSession } from './useSubmissionFeatureTileSession';

export interface ISubmissionFeatureMapProps {
  submissionFeatureId: number;
  /** Requests the feature's tile session from the endpoint that serves the page. */
  createTileSession: CreateSubmissionFeatureTileSession;
}

/**
 * Map of a submission feature's spatial properties.
 *
 * Owns what is specific to a submission feature: which tile session is requested, and the wording of the empty state.
 * Everything else (token transport, basemap, layers, viewport, loading/empty/error states) is {@link TileExtentMap}.
 *
 * @param {ISubmissionFeatureMapProps} props
 * @return {*}
 */
export const SubmissionFeatureMap = (props: ISubmissionFeatureMapProps) => {
  const { submissionFeatureId, createTileSession } = props;

  const tileSession = useSubmissionFeatureTileSession(submissionFeatureId, createTileSession);

  return (
    <TileExtentMap
      subjectKey={String(submissionFeatureId)}
      tileSession={tileSession}
      emptyMessage="This feature has no spatial properties."
      testId="submission-feature-map"
      height={SUBMISSION_FEATURE_MAP_SECTION_HEIGHT}
    />
  );
};
