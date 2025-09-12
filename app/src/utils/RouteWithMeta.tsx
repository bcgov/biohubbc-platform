import React, { useEffect } from 'react';
import { Route } from 'react-router-dom';

interface RouteWithMetaProps {
  path: string;
  title: string;
  description: string;
  element: React.ReactNode;
}

const RouteWithMeta = ({ title, description, element, ...rest }: RouteWithMetaProps) => {
  useEffect(() => {
    document.title = title;
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (metaDescription) {
      metaDescription.content = description;
    }
  }, [title, description]);

  return <Route {...rest} element={element} />;
};

export default RouteWithMeta;
