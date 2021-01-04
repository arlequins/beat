// tslint:disable:no-empty-interface
import { Action } from 'common'
import { PostList, ReqPostListPayload } from 'response'

export const POST_LIST_REQUEST = 'POST_LIST_REQUEST'
export const POST_LIST_SUCCESS = 'POST_LIST_SUCCESS'
export const POST_LIST_FAILURE = 'POST_LIST_FAILURE'

export interface PostListRequestAction extends Action<typeof POST_LIST_REQUEST> {
	payload: ReqPostListPayload
}
export interface PostListSuccessAction extends Action<typeof POST_LIST_SUCCESS> {
	postList: PostList
}
export interface PostListFailureAction extends Action<typeof POST_LIST_FAILURE> {
	error: any
}

export const addPostList = (payload: ReqPostListPayload): PostListRequestAction => ({
	type: POST_LIST_REQUEST,
	payload,
})

export const setPostList = (postList: PostList): PostListSuccessAction => {
	return { type: POST_LIST_SUCCESS, postList }
}

export const errorPostList = (error: any): PostListFailureAction => {
	return { type: POST_LIST_FAILURE, error }
}
