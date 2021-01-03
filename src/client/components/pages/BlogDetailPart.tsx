import React from 'react'

import Grid from '@material-ui/core/Grid'
import { makeStyles } from '@material-ui/core/styles'

// components
import Detail from 'client/components/fragments/blog/Detail'
import Sidebar from 'client/components/fragments/blog/Sidebar'

// interfaces
import { AllProps, State } from 'common'
import { useSelector } from 'react-redux'
import { PostDetailResult, Section, SideBar as FetchedSideBar } from 'response'

const useStyles = makeStyles((theme) => ({
  mainGrid: {
    marginTop: theme.spacing(3),
  },
}))

interface Props {
  post: PostDetailResult
}

const BlogDetailPart: React.FC<AllProps & Props> = ({post}) => {
  const { sectionList = {
    result: [] as Section[],
  }, sideBar = {} as FetchedSideBar } = useSelector((state: State) => state)
  const classes = useStyles()
  const curretSection = sectionList.result.find((section: Section) => section.id === post.sectionId)

  const sideBarResult = sideBar.result

  return (
    <main>
      <Grid container spacing={5} className={classes.mainGrid}>
        <Detail sectionTitle={curretSection ? curretSection.title : ''} posts={[post]} />
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

export default BlogDetailPart
