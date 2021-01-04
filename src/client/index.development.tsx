import * as React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { renderRoutes } from 'react-router-config'

import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'

// client
import { INITIAL_STATE } from 'client/constants'
import { isWindow } from 'client/helpers'
import routes from 'client/routes'
import { frontendCreateStore } from 'client/store/dev'

// components
import AppLoading from 'client/components/fragments/common/AppLoading'
import Theme from 'client/helpers/Theme'

// interfaces
import { State } from 'common'
import { BrowserRouter } from 'react-router-dom'
import { ExtendedWindow } from 'types/settings'

if (isWindow) {
	const win: ExtendedWindow = (window as unknown) as ExtendedWindow
	const state: State = win && win.__INITIAL_STATE__ ? win.__INITIAL_STATE__ : INITIAL_STATE
	state.route = routes

	const store = frontendCreateStore(state)

	render(
		<ThemeProvider theme={Theme(state.appConfig ? state.appConfig.mode : 'light')}>
			{/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
			<CssBaseline />
			<Provider store={store}>
				<React.Suspense fallback={<AppLoading />}>
					<BrowserRouter>{renderRoutes([routes])}</BrowserRouter>
				</React.Suspense>
			</Provider>
		</ThemeProvider>,
		document.getElementById('app')
	)
}
