import React from 'react'

import Divider from '@material-ui/core/Divider'
import Grid from '@material-ui/core/Grid'
import Typography from '@material-ui/core/Typography'

// components
import Markdown from 'client/components/fragments/blog/parts/Markdown'

// interfaces
import { AllProps } from 'common'
import { PostDetailResult } from 'response'

interface Props {
	posts: PostDetailResult[]
	sectionTitle?: string
}

const Detail: React.FC<AllProps & Props> = ({ posts = [], sectionTitle = '' }) => {
	return (
		<Grid item xs={12} md={8}>
			{sectionTitle && (
				<Typography variant="h6" gutterBottom>
					{sectionTitle}
				</Typography>
			)}
			<Divider />
			{posts.map((post: PostDetailResult, index: number) =>
				post.type === 'markdown' ? (
					<Markdown key={index} post={post} />
				) : (
					<Typography key={index} component="div">
						{post.content}
					</Typography>
				)
			)}
		</Grid>
	)
}

export default Detail
