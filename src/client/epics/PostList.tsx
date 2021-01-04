import { Action, State } from 'common'
import { ActionsObservable, combineEpics, Epic } from 'redux-observable'
import { PostList } from 'response'
import { TEpic } from 'types/settings'

import { defer, from, Observable, of, range, ReplaySubject, Subject } from 'rxjs'
import { catchError, filter, map, mergeMap, switchMap } from 'rxjs/operators'

import {
	errorPostList,
	PostListFailureAction,
	PostListRequestAction,
	POST_LIST_REQUEST,
	setPostList,
} from 'client/actions/PostList'

import { requestPostList } from 'client/services'

export const addPostListEpic: TEpic = (
	action$: ActionsObservable<Action<typeof POST_LIST_REQUEST>>
) =>
	action$.ofType(POST_LIST_REQUEST).pipe(
		mergeMap((action: PostListRequestAction) =>
			defer(() => requestPostList(action.payload)).pipe(
				map((postList: PostList) => setPostList(postList)),
				catchError((error: any): Observable<PostListFailureAction> => of(errorPostList(error)))
			)
		)
	)
