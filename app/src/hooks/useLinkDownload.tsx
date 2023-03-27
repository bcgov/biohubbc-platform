import { useRef, useEffect } from 'react'

export default function useLinkDownload() {
  const anchor = useRef<HTMLAnchorElement>(document.createElement('a'));

  useEffect(() => {
    return () => anchor.current.remove();
  }, []);

  return (url: string) => {
    anchor.current.href = url;
    anchor.current.click();
  }
}
