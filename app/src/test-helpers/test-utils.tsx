import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, RenderHookOptions, RenderOptions } from '@testing-library/react';
import { PropsWithChildren, ReactElement } from 'react';
import appTheme from 'themes/appTheme';
import { createTestQueryClient } from './query-client';

interface AllProvidersProps {
  queryClient: QueryClient;
  wrapper?: RenderOptions['wrapper'];
}

interface QueryClientRenderOptions {
  /** Client to render against; a fresh client is created when omitted. */
  queryClient?: QueryClient;
}

/**
 * Wraps a test tree in the providers every rendered component expects, around an optional inner wrapper.
 *
 * @param {PropsWithChildren<AllProvidersProps>} props The query client, optional inner wrapper and children.
 * @returns {JSX.Element} The wrapped tree.
 */
const AllProviders = (props: PropsWithChildren<AllProvidersProps>) => {
  const { queryClient, wrapper: Wrapper, children } = props;
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={appTheme}>{Wrapper ? <Wrapper>{children}</Wrapper> : children}</ThemeProvider>
    </QueryClientProvider>
  );
};

/**
 * Renders a component inside the shared providers, with a query client of its own.
 *
 * @param {ReactElement} ui The element to render.
 * @param {RenderOptions & QueryClientRenderOptions} [options] RTL options, an optional inner `wrapper` and
 * an optional `queryClient` to seed or inspect the cache.
 * @returns The RTL render result.
 */
const customRender = (ui: ReactElement, options: RenderOptions & QueryClientRenderOptions = {}) => {
  const { queryClient = createTestQueryClient(), wrapper, ...renderOptions } = options;
  return render(ui, {
    wrapper: (props: PropsWithChildren) => (
      <AllProviders queryClient={queryClient} wrapper={wrapper}>
        {props.children}
      </AllProviders>
    ),
    ...renderOptions
  });
};

/**
 * Renders a hook inside the shared providers, with a query client of its own.
 *
 * @param {(props: Props) => Result} hook The hook under test.
 * @param {RenderHookOptions<Props> & QueryClientRenderOptions} [options] RTL options, an optional inner
 * `wrapper` and an optional `queryClient` to seed or inspect the cache.
 * @returns The RTL renderHook result.
 */
const customRenderHook = <Result, Props>(
  hook: (props: Props) => Result,
  options: RenderHookOptions<Props> & QueryClientRenderOptions = {}
) => {
  const { queryClient = createTestQueryClient(), wrapper, ...renderOptions } = options;
  return renderHook(hook, {
    wrapper: (props: PropsWithChildren) => (
      <AllProviders queryClient={queryClient} wrapper={wrapper}>
        {props.children}
      </AllProviders>
    ),
    ...renderOptions
  });
};

export * from '@testing-library/react';
export { customRender as render, customRenderHook as renderHook };
