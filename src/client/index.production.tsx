import * as React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { renderRoutes } from 'react-router-config'

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

const win: ExtendedWindow = window as unknown as ExtendedWindow
const state: State = win && win.__INITIAL_STATE__ ? win.__INITIAL_STATE__ : INITIAL_STATE
state.route = routes.length > 0 ? routes[0] : {}

const store = frontendCreateStore(state)

render(
  <ThemeProvider theme={Theme(state.appConfig ? state.appConfig.mode : 'light')}>
    {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
    <CssBaseline />
    <Provider store={store}>
      <React.Suspense fallback={<AppLoading />}>
        {renderRoutes(routes)}
      </React.Suspense>
    </Provider>
  </ThemeProvider>,
  document.getElementById('app')
)

if ('serviceWorker' in navigator && Worker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/service-worker.js`).then((reg: any) => {
      reg.onupdatefound = () => {
        const installingWorker = reg.installing
        installingWorker.onstatechange = () => {
          switch (installingWorker.state) {
            case 'installed':
              if (navigator.serviceWorker.controller) {
                // tslint:disable-next-line:no-console
                console.log('New or updated content is available.')
              } else {
                // tslint:disable-next-line:no-console
                console.log('Content is now available offline!')
              }
              break

            case 'redundant':
              // tslint:disable-next-line:no-console
              console.error('The installing service worker became redundant.')
              break
          }
        }
      }
    }).catch((e) => {
      // tslint:disable-next-line:no-console
      console.error('Error during service worker registration:', e)
    })
  })
}
