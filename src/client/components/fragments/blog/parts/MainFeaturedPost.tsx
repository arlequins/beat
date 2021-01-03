import React from 'react'

import Grid from '@material-ui/core/Grid'
import Link from '@material-ui/core/Link'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'

// interfaces
import { AllProps } from 'common'
import { FeaturedPost } from 'response'

const useStyles = makeStyles((theme) => ({
  mainFeaturedPost: {
    position: 'relative',
    backgroundColor: theme.palette.grey[800],
    color: theme.palette.common.white,
    marginBottom: theme.spacing(4),
    backgroundImage: 'url(https://source.unsplash.com/random)',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,.3)',
  },
  mainFeaturedPostContent: {
    position: 'relative',
    padding: theme.spacing(3),
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(6),
      paddingRight: 0,
    },
  },
}))

interface Props {
  featuredPost: FeaturedPost
}

const MainFeaturedPost: React.FC<AllProps & Props> = ({featuredPost = {}}) => {
  const classes = useStyles()

  return (
    <Paper className={classes.mainFeaturedPost} style={{ backgroundImage: `url(${featuredPost.image})` }}>
      {/* Increase the priority of the hero background image */}
      {<img style={{ display: 'none' }} src={featuredPost.image} alt={featuredPost.imageText} />}
      <div className={classes.overlay} />
      <Grid container>
        <Grid item md={6}>
          <div className={classes.mainFeaturedPostContent}>
            <Typography component="h1" variant="h3" color="inherit" gutterBottom>
              {featuredPost.title}
            </Typography>
            <Typography variant="h5" color="inherit" paragraph>
              {featuredPost.description}
            </Typography>
            { featuredPost.linkText && (
              <Link variant="subtitle1" href={`/blog/${featuredPost.id}`}>
                {featuredPost.linkText}
              </Link>
            )}
          </div>
        </Grid>
      </Grid>
    </Paper>
  )
}

export default MainFeaturedPost
