import { lazy, useEffect } from 'react'
import React from 'react'
import Helmet from 'react-helmet'

// common sass
// tslint:disable:no-import-side-effect
import 'scss/top.scss'

// components
import ComponentLoading from 'client/components/fragments/common/ComponentLoading'
const TopPart = lazy(() => import(/* webpackChunkName: "venus-parts-toppart" */ 'client/components/pages/TopPart'))

// interface
import { AllProps } from 'common'

const Top: React.FC<AllProps> = () => {
  useEffect(() => {
  }, [])

  return (
    <>
      <Helmet>
        <title>TOP</title>
        <meta name="description" content={'DESC'} />
        <meta name="keywords" content={'KEYWORDS,KEYWORDS2'} />
      </Helmet>

      <React.Suspense fallback={<ComponentLoading />}>
        <TopPart />
      </React.Suspense>

    </>
  )
}

export default Top
