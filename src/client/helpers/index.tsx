import { matchRoutes, RouteConfig } from 'react-router-config'

export * from 'client/helpers/PagingService'
export * from 'client/helpers/Extra'

export const findMatchRoutes = (route: RouteConfig, pathname: string) => {
	const routes = route.routes ? route.routes : []
	const branch = matchRoutes(routes, pathname)
	const match =
		branch.length > 0 && branch[0].match
			? branch[0].match
			: {
					isExact: false,
					params: {} as any,
					path: '',
					url: '',
			  }
	return match
}
