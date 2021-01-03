import { INITIAL_STATE } from 'client/constants'
import { preloadedStateEpics, reducersMapObjects } from 'client/reducers/epicsMethods'
import { Action, ReducersMapObject, ReducersMapReducerObject, State } from 'common'

const handleActions = (cases: ReducersMapObject) => (
  (state: State | undefined, action: Action<string>) => {
    return (!state || !action || !cases[action.type]) ? state ? state : INITIAL_STATE : cases[action.type](state, action)
  }
)

export const handleActionsForStore = handleActions(reducersMapObjects)

const handleActionsForOneEpic = (targetReducerKey: string, cases: ReducersMapObject) => (
  (state: State | undefined, action: Action<string>) => {
    if (!state || !action || !cases[action.type]) {
      return state ? state : INITIAL_STATE
    }

    const curState = cases[action.type](state, action)
    return curState[targetReducerKey]
  }
)

const handleActionsByPreloadedState = (targetReducerKey: string, cases: ReducersMapObject) => {
  const targetReducerKeyList = preloadedStateEpics.hasOwnProperty(targetReducerKey) ? preloadedStateEpics[targetReducerKey] : []

  if (targetReducerKeyList.length === 0) {
    return (state: State | undefined, _action: Action<string>) => (state ? state : INITIAL_STATE)
  }

  const curObj: ReducersMapReducerObject = {
    isExist: false,
    functionList: {},
  }

  for (const key in cases) {
    if (cases.hasOwnProperty(key)) {
      const element = cases[key]
      const isExist = targetReducerKeyList.find(targetKey => targetKey === key)
      if (isExist) {
        curObj.isExist = true
        curObj.functionList[key] = (element)
      }
    }
  }

  return handleActionsForOneEpic(targetReducerKey, curObj.functionList)
}

const handelCombineReducers = (initialState: State, cases: ReducersMapObject) => {
  const objs: any = {}

  for (const key in initialState) {
    if (initialState.hasOwnProperty(key)) {
      objs[key] = handleActionsByPreloadedState(key, cases)
    }
  }

  return objs
}

export const handleActionsForCombineReducers = handelCombineReducers(INITIAL_STATE, reducersMapObjects)
