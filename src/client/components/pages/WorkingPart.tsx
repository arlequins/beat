import * as React from 'react'
import { memo } from 'react'
import Helmet from 'react-helmet'

export default memo(
  () => {
    return (
      <main>

      <Helmet>
        <title>WORKING PAGE</title>
      </Helmet>

        <article>
          <h1>WORKING PAGE</h1>
        </article>

      </main>
    )
  }
)
