import { lazy } from 'react'

const App = lazy(() => import(/* webpackChunkName: "page-app" */ 'client/containers/AppHooks'))
const Top = lazy(() => import(/* webpackChunkName: "page-top" */ 'client/containers/Top'))
const BlogTop = lazy(() => import(/* webpackChunkName: "page-blog" */ 'client/containers/BlogTop'))
const BlogDetail = lazy(() => import(/* webpackChunkName: "page-blog" */ 'client/containers/BlogDetail'))
const NotFound = lazy(() => import(/* webpackChunkName: "page-working" */ 'client/containers/common/NotFound'))

export default [
  {
    component: App,
    routes: [
      {
        path: `/`,
        exact: true,
        component: Top,
      },
      {
        path: `/blog`,
        exact: true,
        component: BlogTop,
      },
      {
        path: `/blog/section/:sectionName`,
        exact: true,
        component: BlogTop,
      },
      {
        path: `/blog/p:id`,
        exact: true,
        component: BlogDetail,
      },
      {
        path: `/404`,
        exact: true,
        component: NotFound,
      },
      {
        path: '*',
        component: NotFound,
      },
    ],
  },
]
