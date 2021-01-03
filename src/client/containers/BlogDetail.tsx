import React from 'react'
import { useSelector } from 'react-redux'

import Container from '@material-ui/core/Container'
import CssBaseline from '@material-ui/core/CssBaseline'

// components
import Footer from 'client/components/fragments/common/Footer'
import Header from 'client/components/fragments/common/Header'
import BlogDetailPart from 'client/components/pages/BlogDetailPart'

// client
import { LANGUAGE_PACK } from 'client/constants/Lang'
import { findMatchRoutes } from 'client/helpers'

// interface
import { AllProps, AppConfig, State } from 'common'
import { RouteConfig } from 'react-router-config'
import { PostDetail } from 'response'

const BlogDetail: React.FC<AllProps> = () => {
  const { postDetail = {
    result: {
      content: '',
      title: '',
    },
  } as PostDetail, appConfig = {
    lang: 'EN',
  } as AppConfig, route = {} as RouteConfig } = useSelector((state: State) => state)
  const info = LANGUAGE_PACK(appConfig.lang).info

  const match = findMatchRoutes(route, location.pathname)
  const id = match.params.id
  // tslint:disable-next-line:no-console
  console.log('# id:', id)

  const post = postDetail.result

  return (
    <React.Fragment>
      <CssBaseline />
      <Container maxWidth="lg">
        <Header title={info.headerTitle} />
        <BlogDetailPart post={post} />

      </Container>
      <Footer title={info.footerTitle} description={post.title} />
    </React.Fragment>
  )
}

export default BlogDetail
