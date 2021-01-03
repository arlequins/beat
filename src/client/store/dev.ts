import rootEpic from 'client/epics'
import createRootReducer from 'client/reducers'
import { State } from 'common'
import {
  applyMiddleware,
  compose,
  createStore,
} from 'redux'
import { createLogger } from 'redux-logger'
import { createEpicMiddleware } from 'redux-observable'
import { ExtendedWindow } from 'types/settings'

export const frontendCreateStore = (initialState: State): any => {

let enhancer: any
const epicMiddleware = createEpicMiddleware()

const hasDevtools = Boolean(
  typeof window !== 'undefined' &&
  (window as unknown as ExtendedWindow).__REDUX_DEVTOOLS_EXTENSION__ &&
  (window as unknown as ExtendedWindow).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__,
)

// tslint:disable
if (hasDevtools) {
  enhancer = (window as unknown as ExtendedWindow).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__(
    compose(applyMiddleware(epicMiddleware, createLogger()))
  )
} else {
  enhancer = compose(applyMiddleware(epicMiddleware, createLogger()))
}

  const store = createStore(
    createRootReducer(),
    initialState,
    enhancer)

  epicMiddleware.run(rootEpic)
  return store
}
