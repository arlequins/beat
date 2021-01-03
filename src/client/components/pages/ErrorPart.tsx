import * as React from 'react'
import { memo } from 'react'
import Helmet from 'react-helmet'

export default memo(
  () => {
    return (
      <main>

      <Helmet>
        <title>ERROR PAGE</title>
      </Helmet>

        <article>
          <h1>ERROR PAGE</h1>
        </article>

      </main>
    )
  }
)
