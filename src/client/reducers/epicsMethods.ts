import { PreloadedStateEpics } from 'common'

import PostList from 'client/reducers/PostList'

export const reducersMapObjects = {
	...PostList.reducersMapObject,
}

export const preloadedStateEpics: PreloadedStateEpics = {
	...PostList.preloadedStateEpic,
}
