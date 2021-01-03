import { handleActionsForCombineReducers } from 'client/reducers/epics'
import { combineReducers } from 'redux'

const createRootReducer = () => combineReducers({
  ...handleActionsForCombineReducers,
})

export default createRootReducer
