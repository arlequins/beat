import { TOP_URI as BLOG_ROOT } from 'client/constants/Blog'

import App from 'client/containers/AppHooks'
import BlogDetail from 'client/containers/BlogDetail'
import BlogTop from 'client/containers/BlogTop'
import NotFound from 'client/containers/common/NotFound'

export default {
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
}
