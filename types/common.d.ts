declare module 'common' {
  import { PostList, SectionList, PostDetail } from 'response'
  import { Reducer } from 'redux'
  import { RouteConfig } from 'react-router-config'

  type TEpic = Epic<Action<string>, State>

  type AllProps = Readonly<State>

  interface Action<T extends string> {
    type: T
  }

  interface Dict<T> {
    [key: string]: T
  }

  interface ReducersMapObject {
    [key: string]: Reducer<State>
  }

  interface ReducersMapObject {
    [key: string]: Reducer<State>
  }

  interface ReducersMapReducerObject {
    isExist: boolean
    functionList: ReducersMapObject
  }

  interface PreloadedStateEpics {
    [key: string]: string[]

    postList?: string[]
  }

  interface PreloadedState {
    postList?: PostList
  }

  interface AppConfig {
    mode: string
    lang: string
  }

  interface State extends PreloadedState {
    [key: string]: any

    route?: RouteConfig
    status?: number

    postList?: PostList
    postDetail?: PostDetail
    sectionList?: SectionList
    sideBar?: SideBar

    appConfig?: AppConfig
  }
}
