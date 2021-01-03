import * as React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import * as renderer from 'react-test-renderer'

// client
import { INITIAL_STATE } from 'client/constants'
import routes from 'client/routes'
import { frontendCreateStore } from 'client/store/dev'

// components
import App from 'client/containers/AppHooks'

// interfaces
import { ExtendedWindow } from 'types/settings'

const win: ExtendedWindow = window as unknown as ExtendedWindow
const state = win && win.__INITIAL_STATE__ ? win.__INITIAL_STATE__ : INITIAL_STATE
state.route = routes.length > 0 ? routes[0] : {}

const store = frontendCreateStore(state)

describe('App', () => {
  test('snapshot renders', () => {
    const component = renderer.create(
    <MemoryRouter>
      <Provider store={store}>
        <App />
      </Provider>
    </MemoryRouter>)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
