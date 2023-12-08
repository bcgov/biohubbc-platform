const useDownloadJSON = () => {
  /**
   * hook to handle downloading raw data as JSON
   * Note: currently this does not zip the file. Can be modified if needed.
   *
   * @param {any} data - to download
   * @param {string} fileName - name of file excluding file extension ie: file1
   */
  const download = (data: any, fileName: string) => {
    const blob = new Blob([JSON.stringify(data, undefined, 2)], { type: 'application/json' });

    const link = document.createElement('a');

    link.download = `${fileName}.json`;

    link.href = URL.createObjectURL(blob);

    link.click();

    URL.revokeObjectURL(link.href);
  };
  return download;
};

export default useDownloadJSON;
