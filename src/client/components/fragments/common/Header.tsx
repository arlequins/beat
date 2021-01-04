import React, { Fragment } from 'react'

import Button from '@material-ui/core/Button'
import IconButton from '@material-ui/core/IconButton'
import Link from '@material-ui/core/Link'
import { makeStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import SearchIcon from '@material-ui/icons/Search'

// client
import { TOP_URI } from 'client/constants/Blog'
import { findMatchRoutes } from 'client/helpers'

// interface
import { AllProps, State } from 'common'
import { useSelector } from 'react-redux'
import { RouteConfig } from 'react-router-config'
import { Section, SectionList } from 'response'

const useStyles = makeStyles((theme) => ({
  toolbar: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  toolbarTitle: {
    flex: 1,
  },
  toolbarSecondary: {
    justifyContent: 'space-between',
    overflowX: 'auto',
  },
  toolbarLink: {
    padding: theme.spacing(1),
    flexShrink: 0,
  },
}))

interface Props {
  title: string
}

const Header: React.FC<AllProps & Props> = ({ title = '' }) => {
  const { sectionList = {
    result: [],
  } as SectionList, route = {} as RouteConfig} = useSelector((state: State) => state)
  const sections = sectionList.result
  const match = findMatchRoutes(route, location.pathname)
  const sectionName = match.params.sectionName ? match.params.sectionName : ''
  const curretSection = sectionList.result.find((section: Section) => section.name === sectionName)
  const classes = useStyles()

  return (
    <React.Fragment>
      <Toolbar className={classes.toolbar}>
        {/* <Button size="small">Subscribe</Button> */}
        <Typography
          component="h2"
          variant="h5"
          color="inherit"
          align="center"
          noWrap
          className={classes.toolbarTitle}
        >
          <Link
            variant="h5"
            color="inherit"
            align="center"
            noWrap
            href={TOP_URI}
          >
            {title}
          </Link>
        </Typography>
        <IconButton>
          <SearchIcon />
        </IconButton>
        {/* <Button variant="outlined" size="small">
          Sign up
        </Button> */}
      </Toolbar>
      <Toolbar component="nav" variant="dense" className={classes.toolbarSecondary}>
        {sections.map((section: Section, index: number) => {
          if (index > 0) {
            if (curretSection && curretSection.id === section.id) {
              return (
                <Typography color="textPrimary" key={index}>{section.title}</Typography>
              )
            } else {
              return (
                <Link
                  color="textSecondary"
                  noWrap
                  key={section.title}
                  variant="body2"
                  href={section.url}
                  className={classes.toolbarLink}
                >
                  {section.title}
                </Link>
              )
            }
          } else {
            return (<Fragment key={index}></Fragment>)
          }
        })}
      </Toolbar>
    </React.Fragment>
  )
}

export default Header
