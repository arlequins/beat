import Status from 'client/containers/common/Status'
import * as React from 'react'
import Helmet from 'react-helmet'

export default (): JSX.Element => (
  <Status status={404}>
    <main>
      <Helmet>
        <title>NOT FOUND</title>
      </Helmet>

      <article className="not-found">
        <h1>NOT FOUND</h1>
      </article>

    </main>
  </Status>
)
