import { useFormikContext } from 'formik';
import { useRef } from 'react';
import { TicketCommentForm } from '../../../comment/TicketCommentForm';
import { ITicketCommentEditFormProps, ITicketCommentEditFormValues } from './TicketCommentEditForm.interface';

/**
 * Formik adapter for the shared ticket comment editor body.
 *
 * @param {ITicketCommentEditFormProps} props
 * @return {*}
 */
export const TicketCommentEditForm = (props: ITicketCommentEditFormProps) => {
  const { artifacts, isSaving, isUploadingAttachment, onUploadAttachment } = props;
  const { values, setFieldValue } = useFormikContext<ITicketCommentEditFormValues>();
  const commentRef = useRef(values.comment);
  commentRef.current = values.comment;

  /**
   * Append attachment markdown returned by the upload flow to the current Formik comment field.
   *
   * @param {string} markdownLink Markdown image or link syntax for the uploaded ticket artifact.
   * @returns {void}
   */
  const appendMarkdownLink = (markdownLink: string) => {
    const previousComment = commentRef.current;
    const separator = previousComment && !/\s$/.test(previousComment) ? ' ' : '';
    const nextComment = `${previousComment}${separator}${markdownLink}`;
    commentRef.current = nextComment;
    setFieldValue('comment', nextComment);
  };

  return (
    <TicketCommentForm
      comment={values.comment}
      artifacts={artifacts}
      setComment={(comment) => setFieldValue('comment', comment)}
      isUploadingAttachment={isUploadingAttachment}
      disabled={isSaving}
      onUploadAttachment={(file) => onUploadAttachment(file, appendMarkdownLink)}
    />
  );
};
