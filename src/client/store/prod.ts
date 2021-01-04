import { State } from 'common'

import { applyMiddleware, compose, createStore } from 'redux'
import { createEpicMiddleware } from 'redux-observable'

import rootEpic from 'client/epics'
import createRootReducer from 'client/reducers'

export const frontendCreateStore = (initialState: State): any => {
	const epicMiddleware = createEpicMiddleware()
	const enhancer = compose(applyMiddleware(epicMiddleware))

	const store = createStore(createRootReducer(), initialState, enhancer)

	epicMiddleware.run(rootEpic)
	return store
}

export const backendCreateStore = (initialState: State): any => {
	// const epicMiddleware = createEpicMiddleware()
	// const enhancer = compose(applyMiddleware(epicMiddleware))

	const store = createStore(createRootReducer(), initialState)

	// epicMiddleware.run(rootEpic)
	return store
}
