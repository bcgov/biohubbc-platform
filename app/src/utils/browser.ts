export const isSupportedBrowser = (): boolean => {
  const userAgent = navigator.userAgent;
  return (
    userAgent.includes('Chrome') ||
    userAgent.includes('Firefox') ||
    userAgent.includes('Safari') ||
    userAgent.includes('Edge')
  );
};
