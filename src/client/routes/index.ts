import { lazy } from 'react'

import { TOP_URI as BLOG_ROOT } from 'client/constants/Blog'

const App = lazy(() => import(/* webpackChunkName: "page-app" */ 'client/containers/AppHooks'))
const Top = lazy(() => import(/* webpackChunkName: "page-top" */ 'client/containers/Top'))
const BlogTop = lazy(() => import(/* webpackChunkName: "page-blog-top" */ 'client/containers/BlogTop'))
const BlogDetail = lazy(() => import(/* webpackChunkName: "page-blog-detail" */ 'client/containers/BlogDetail'))
const NotFound = lazy(() => import(/* webpackChunkName: "page-not-found" */ 'client/containers/common/NotFound'))

export default [
  {
    component: App,
    routes: [
      {
        path: `${BLOG_ROOT}`,
        exact: true,
        component: BlogTop,
      },
      {
        path: `${BLOG_ROOT}section/:sectionName`,
        exact: true,
        component: BlogTop,
      },
      {
        path: `${BLOG_ROOT}p:id`,
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
