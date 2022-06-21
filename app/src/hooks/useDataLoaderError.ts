import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { DialogContext } from 'contexts/dialogContext';
import { useContext, useEffect } from 'react';
import { DataLoader } from './useDataLoader';

/**
 * Hook that renders an error dialog if the `dataLoader` throws an error.
 *
 * @export
 * @template T
 * @template R
 * @param {DataLoader<T, R>} dataLoader A `DataLoader`.
 * @param {(dataLoader: DataLoader<T, R>) => Partial<IErrorDialogProps>} getErrorDialogProps A function that receives
 * the dataLoader and returns an `IErrorDialogProps` object, which will be passed to the rendered error dialog.
 */
export default function useDataLoaderError<T = unknown, R = unknown>(
  dataLoader: DataLoader<T, R>,
  getErrorDialogProps: (dataLoader: DataLoader<T, R>) => Partial<IErrorDialogProps>
) {
  const dialogContext = useContext(DialogContext);

  useEffect(() => {
    if (!dataLoader.error || dialogContext.errorDialogProps.open) {
      return;
    }

    dialogContext.setErrorDialog({
      open: true,
      onOk: () => dialogContext.setErrorDialog({ open: false }),
      onClose: () => dialogContext.setErrorDialog({ open: false }),
      ...getErrorDialogProps(dataLoader)
    });
  }, [dataLoader.error, dialogContext, dataLoader, getErrorDialogProps]);
}
