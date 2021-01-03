import React from 'react'

import Grid from '@material-ui/core/Grid'
import Link from '@material-ui/core/Link'
import Paper from '@material-ui/core/Paper'
import { makeStyles, Theme } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'

// interfaces
import { AllProps } from 'common'
import { SideBarResultArchive, SideBarResultSocial } from 'response'

const useStyles = makeStyles((theme: Theme) => ({
  sidebarAboutBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.type === 'light' ? theme.palette.grey[200] : theme.palette.grey[800],
  },
  sidebarSection: {
    marginTop: theme.spacing(3),
  },
}))

interface Props {
  title: string
  description: string
  archives: SideBarResultArchive[]
  social: SideBarResultSocial[]
}

const Sidebar: React.FC<AllProps & Props> = ({title='', description='', archives=[], social=[]}) => {
  const classes = useStyles()

  return (
    <Grid item xs={12} md={4}>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography>{description}</Typography>
      </Paper>
      <Typography variant="h6" gutterBottom className={classes.sidebarSection}>
        Archives
      </Typography>
      {archives.map((archive: SideBarResultArchive) => (
        <Link display="block" variant="body1" href={archive.url} key={archive.title}>
          {archive.title}
        </Link>
      ))}
      <Typography variant="h6" gutterBottom className={classes.sidebarSection}>
        Social
      </Typography>
      {social.map((network: SideBarResultSocial) => (
        <Link display="block" variant="body1" href="#" key={network.name}>
          <Grid container direction="row" spacing={1} alignItems="center">
            {/* <Grid item>
              <network.icon />
            </Grid> */}
            <Grid item>{network.name}</Grid>
          </Grid>
        </Link>
      ))}
    </Grid>
  )
}

export default Sidebar
