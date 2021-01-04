import * as React from 'react'
import { useDispatch } from 'react-redux'

// tslint:disable-next-line:no-import-side-effect
// import 'scss/app-top.scss'

export default React.memo(() => {
	const dispatch = useDispatch()

	return (
		<main>
			<h1>TOP PAGE</h1>
		</main>
	)
})
