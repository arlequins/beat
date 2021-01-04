import ReactMarkdown from 'markdown-to-jsx'
import React, { memo } from 'react'

import Link from '@material-ui/core/Link'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'

// interfaces
import { AllProps } from 'common'
import { PostDetailResult } from 'response'

const useStyles = makeStyles((theme) => ({
	listItem: {
		marginTop: theme.spacing(1),
	},
	markdown: {
		...theme.typography.body2,
		padding: theme.spacing(3, 0),
	},
}))

interface Props {
	post: PostDetailResult
}

const MarkDown: React.FC<AllProps & Props> = memo(({ post }) => {
	const classes = useStyles()

	const options = {
		overrides: {
			h1: {
				component: Typography,
				props: {
					gutterBottom: true,
					variant: 'h5',
				},
			},
			h2: { component: Typography, props: { gutterBottom: true, variant: 'h6' } },
			h3: { component: Typography, props: { gutterBottom: true, variant: 'subtitle1' } },
			h4: {
				component: Typography,
				props: { gutterBottom: true, variant: 'caption', paragraph: true },
			},
			p: { component: Typography, props: { paragraph: true } },
			a: { component: Link },
			li: {
				component: ({ ...props }) => (
					<li className={classes.listItem}>
						<Typography component="span" {...props} />
					</li>
				),
			},
		},
	}

	return (
		<ReactMarkdown options={options} className={classes.markdown}>
			{post.content}
		</ReactMarkdown>
	)
})

export default MarkDown
