import { PreloadedStateEpics, State } from 'common'

import {
  PostListSuccessAction,
  POST_LIST_SUCCESS,
} from 'client/actions'

export default {
  reducersMapObject: {
    [POST_LIST_SUCCESS]: (state: State, { postList }: PostListSuccessAction) => {
      return {
        ...state,
        postList: postList.result.length > 0 ? postList : {
          result: [],
          stamp: new Date(),
        },
      }
    },
  },
  preloadedStateEpic: {
    postList: [POST_LIST_SUCCESS],
  } as PreloadedStateEpics,
}
