import { TileExtentMap } from 'components/map/TileExtentMap';
import { MAP_SECTION_HEIGHT } from 'constants/spatial';
import { useSubmissionUploadTileSession } from './useSubmissionUploadTileSession';

export interface ISubmissionUploadMapProps {
  submissionId: number;
  submissionUploadId: string;
}

/**
 * Map of the spatial properties of every active feature of a submission upload, for the upload review page.
 *
 * Owns what is specific to an upload: which tile session is requested, and the wording of the empty state. Everything
 * else (token transport, basemap, layers, viewport, loading/empty/error states) is {@link TileExtentMap}, so a failure
 * here is contained to this section and the rest of the review page stays usable.
 *
 * @param {ISubmissionUploadMapProps} props
 * @return {*}
 */
export const SubmissionUploadMap = (props: ISubmissionUploadMapProps) => {
  const { submissionId, submissionUploadId } = props;

  const tileSession = useSubmissionUploadTileSession(submissionId, submissionUploadId);

  return (
    <TileExtentMap
      subjectKey={`${submissionId}:${submissionUploadId}`}
      tileSession={tileSession}
      emptyMessage="This upload has no spatial properties."
      testId="submission-upload-map"
      height={MAP_SECTION_HEIGHT}
    />
  );
};
