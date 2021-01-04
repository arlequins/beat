import { combineEpics } from 'redux-observable'

// import epics
import { addPostListEpic } from 'client/epics/PostList'

export default combineEpics(addPostListEpic)
