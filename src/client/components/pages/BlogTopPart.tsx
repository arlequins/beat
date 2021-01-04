import React from 'react'
import { useSelector } from 'react-redux'

import Grid from '@material-ui/core/Grid'
import { makeStyles } from '@material-ui/core/styles'
import FacebookIcon from '@material-ui/icons/Facebook'
import GitHubIcon from '@material-ui/icons/GitHub'
import TwitterIcon from '@material-ui/icons/Twitter'

// components
// import Sidebar from './Sidebar'
import Detail from 'client/components/fragments/blog/Detail'
import FeaturedPost from 'client/components/fragments/blog/parts/FeaturedPost'
import Sidebar from 'client/components/fragments/blog/Sidebar'
import ErrorPart from 'client/components/pages/ErrorPart'
// import MainFeaturedPost from 'client/components/fragments/blog/parts/MainFeaturedPost'

// client
import { TOP_URI } from 'client/constants/Blog'
import { findMatchRoutes } from 'client/helpers'

// interfaces
import { AllProps, State } from 'common'
import { RouteConfig } from 'react-router-config'
import { FeaturedPost as FeaturedPostInterface, Section, SideBar as FetchedSideBar } from 'response'

const useStyles = makeStyles((theme) => ({
	mainGrid: {
		marginTop: theme.spacing(3),
	},
}))

const BlogTopPart: React.FC<AllProps> = () => {
	const {
		postList = {
			result: {
				posts: [],
				featuredPosts: [],
			},
		},
		sectionList = {
			result: [] as Section[],
		},
		route = {} as RouteConfig,
		sideBar = {} as FetchedSideBar,
	} = useSelector((state: State) => state)
	const classes = useStyles()

	const match = findMatchRoutes(route, location.pathname)
	const sectionName = match.params.sectionName ? match.params.sectionName : ''
	const curretSection = sectionList.result.find((section: Section) => section.name === sectionName)
	const isNotTopPage = !curretSection && location.pathname !== TOP_URI

	// const mainFeaturedPost = postList.result.featuredPosts.find((featuredPost: FeaturedPost) => featuredPost.type === 1)
	const featuredPosts = postList.result.featuredPosts.filter(
		(featuredPost: FeaturedPostInterface) => featuredPost.type !== 1
	)
	const posts = postList.result.posts

	const sideBarResult = sideBar.result

	if (isNotTopPage) {
		return <ErrorPart />
	}

	return (
		<main>
			{/* { mainFeaturedPost && <MainFeaturedPost featuredPost={mainFeaturedPost} /> } */}
			<Grid container spacing={4}>
				{featuredPosts.map((post: FeaturedPostInterface) => (
					<FeaturedPost key={post.title} featuredPost={post} />
				))}
			</Grid>
			<Grid container spacing={5} className={classes.mainGrid}>
				<Detail sectionTitle={curretSection ? curretSection.title : ''} posts={posts} />
				<Sidebar
					title={sideBarResult.title}
					description={sideBarResult.description}
					archives={sideBarResult.archives}
					social={sideBarResult.social}
				/>
			</Grid>
		</main>
	)
}

export default BlogTopPart
