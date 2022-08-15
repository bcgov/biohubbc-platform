import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from '@mui/styles'
import Keycloak from 'keycloak-js'
import appTheme from 'themes/appTheme'
import { ReactKeycloakProvider } from '@react-keycloak/web'

const AllProviders: React.FC<React.PropsWithChildren> = (props) => {
  const { children} = props
  return (
    <ReactKeycloakProvider authClient={new Keycloak()}>
      <ThemeProvider theme={appTheme}>    
        {children}
      </ThemeProvider>
    </ReactKeycloakProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
