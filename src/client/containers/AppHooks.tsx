import * as React from 'react'
import Helmet from 'react-helmet'
import { useSelector } from 'react-redux'

// libraries
import { renderRoutes, RouteConfig } from 'react-router-config'

// components
import ComponentLoading from 'client/components/fragments/common/ComponentLoading'

// interfaces
import { AllProps, State } from 'common'

const App: React.FC<AllProps> = () => {
  const { route = {} as RouteConfig } = useSelector((state: State) => state)

  return (
    <main>
      <Helmet>
        <html lang="en" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" id="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="format-detection" content="telephone=no" />
      </Helmet>

      <React.Suspense fallback={<ComponentLoading />}>
        {route && renderRoutes(route.routes)}
      </React.Suspense>

    </main>
  )
}

export default App
