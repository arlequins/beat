import { PreloadedStateEpics, State } from 'common'

import {
  PostListSuccessAction,
  POST_LIST_SUCCESS,
} from 'client/actions'
import { FeaturedPost, PostDetailResult } from 'response'

export default {
  reducersMapObject: {
    [POST_LIST_SUCCESS]: (state: State, { postList }: PostListSuccessAction) => {
      return {
        ...state,
        postList: postList.result.posts.length > 0 ? postList : {
          result: {
            posts: [] as PostDetailResult[],
            featuredPosts: [] as FeaturedPost[],
          },
          stamp: new Date(),
        },
      }
    },
  },
  preloadedStateEpic: {
    postList: [POST_LIST_SUCCESS],
  } as PreloadedStateEpics,
}
