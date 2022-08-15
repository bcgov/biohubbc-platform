import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import appTheme from 'themes/appTheme'

const AllProviders: React.FC<React.PropsWithChildren> = (props) => {
  const { children} = props
  return (
    <ThemeProvider theme={appTheme}>    
      {children}
    </ThemeProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
