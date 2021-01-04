import React from 'react'

import Card from '@material-ui/core/Card'
import CardActionArea from '@material-ui/core/CardActionArea'
import CardContent from '@material-ui/core/CardContent'
import CardMedia from '@material-ui/core/CardMedia'
import Grid from '@material-ui/core/Grid'
import Hidden from '@material-ui/core/Hidden'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'

// interfaces
import { AllProps } from 'common'
import { FeaturedPost as FeaturedPostInterface } from 'response'

const useStyles = makeStyles({
  card: {
    display: 'flex',
  },
  cardDetails: {
    flex: 1,
  },
  cardMedia: {
    width: 160,
  },
})

interface Props {
  featuredPost: FeaturedPostInterface
}

const FeaturedPost: React.FC<AllProps & Props> = ({featuredPost = {}}) => {
  const classes = useStyles()

  return (
    <Grid item xs={12} md={6}>
      <CardActionArea component="a" href={`/p${featuredPost.id}`}>
        <Card className={classes.card}>
          <div className={classes.cardDetails}>
            <CardContent>
              <Typography component="h2" variant="h5">
                {featuredPost.title}
              </Typography>
              { featuredPost.date && <Typography variant="subtitle1" color="textSecondary">
                {featuredPost.date}
              </Typography> }
              <Typography variant="subtitle1" paragraph>
                {featuredPost.description}
              </Typography>
              <Typography variant="subtitle1" color="primary">
                Continue reading...
              </Typography>
            </CardContent>
          </div>
          <Hidden xsDown>
            <CardMedia className={classes.cardMedia} image={featuredPost.image} title={featuredPost.imageText} />
          </Hidden>
        </Card>
      </CardActionArea>
    </Grid>
  )
}

export default FeaturedPost
