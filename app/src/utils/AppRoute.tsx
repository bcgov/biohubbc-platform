import React from 'react';
import { Route, RouteProps } from 'react-router-dom';

export type IAppRouteProps = RouteProps & {
  /**
   * The title for the browser window/tab.
   *
   * @type {string}
   */
  title?: string;
  /**
   * If specified, the `component` will be rendered as a child of the `layout`.
   *
   * @type {React.ComponentType<any>}
   */
  layout?: React.ComponentType<any>;
};

const AppRoute: React.FC<IAppRouteProps> = ({ component: Component, children, layout: Layout, title, ...rest }) => {
  if (title) {
    document.title = title;
  }

  return (
    <Route
      {...rest}
      render={(props) => {
        const childrenToRender = React.Children.map(children, (child: any) => {
          return React.cloneElement(child, props);
        });

        if (Layout) {
          return <Layout>{childrenToRender}</Layout>;
        }

        return childrenToRender;
      }}
    />
  );
};

export default AppRoute;
