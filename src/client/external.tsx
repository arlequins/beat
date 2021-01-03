import * as React from 'react'
import { Provider } from 'react-redux'
import { renderRoutes } from 'react-router-config'
import { StaticRouter } from 'react-router-dom'

import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'

// client
import { INITIAL_STATE } from 'client/constants'
import routes from 'client/routes'
import { frontendCreateStore } from 'client/store/prod'

// components
import AppLoading from 'client/components/fragments/common/AppLoading'
import Theme from 'client/helpers/Theme'

// interface
import { State } from 'common'
import { ExtendedWindow } from 'types/settings'

interface StaticRouterContext {
  status?: number
  url?: string
  action?: 'PUSH' | 'REPLACE'
  location?: object
  [key: string]: any
}

const win: ExtendedWindow = window as unknown as ExtendedWindow
const state: State = win && win.__INITIAL_STATE__ ? win.__INITIAL_STATE__ : INITIAL_STATE
state.route = routes.length > 0 ? routes[0] : {}

const store = frontendCreateStore(state)

const context: StaticRouterContext = {}

const ServerSideRendering = async (req: any, _res: any) => {
  const url = req.url

  return (
    <ThemeProvider theme={Theme}>
      {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
      <CssBaseline />
      <Provider store={store}>
        <StaticRouter location={url} context={context}>
          <React.Suspense fallback={<AppLoading />}>
            {renderRoutes(routes)}
          </React.Suspense>
        </StaticRouter>
      </Provider>
    </ThemeProvider>
  )
}

export default ServerSideRendering
