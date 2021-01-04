import * as React from 'react'
import ReactDOMServer from 'react-dom/server'
import { Provider } from 'react-redux'
import { renderRoutes } from 'react-router-config'
import { StaticRouter } from 'react-router-dom'

import CssBaseline from '@material-ui/core/CssBaseline'
import { ServerStyleSheets, ThemeProvider } from '@material-ui/core/styles'

// client
import { INITIAL_STATE } from 'client/constants'
import routes from 'client/routes'
import { backendCreateStore } from 'client/store/prod'

// components
import Theme from 'client/helpers/Theme'

// interface
import { State } from 'common'

interface StaticRouterContext {
	status?: number
	url?: string
	action?: 'PUSH' | 'REPLACE'
	location?: object
	[key: string]: any
}

export const initialState = INITIAL_STATE

export const ServerSideRendering = async (req: any, initial: State) => {
  const sheets = new ServerStyleSheets()
  const context: StaticRouterContext = {}

	const url = req.url

  const state: State = initial
  state.route = routes.length > 0 ? routes[0] : {}
  const store = backendCreateStore(state)

  // Render the component to a string.
  const html = ReactDOMServer.renderToString(
    sheets.collect(
      <ThemeProvider theme={Theme(state.appConfig ? state.appConfig.mode : 'light')}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        <Provider store={store}>
          <StaticRouter location={url} context={context}>
            {renderRoutes(routes)}
          </StaticRouter>
        </Provider>
      </ThemeProvider>,
    ),
  )

  // Grab the CSS from our sheets.
  const css = sheets.toString()

	return {
    html: html,
    css: css,
    state: state,
    context: context,
    url: url,
  }
}
