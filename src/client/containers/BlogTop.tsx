import React from 'react'
import { useSelector } from 'react-redux'

import Container from '@material-ui/core/Container'
import CssBaseline from '@material-ui/core/CssBaseline'

// components
import Footer from 'client/components/fragments/common/Footer'
import Header from 'client/components/fragments/common/Header'
import BlogTopPart from 'client/components/pages/BlogTopPart'

// client
import { LANGUAGE_PACK } from 'client/constants/Lang'

// common sass
// tslint:disable:no-import-side-effect
import 'scss/top.scss'

// interface
import { State } from 'common'
import { AllProps, AppConfig } from 'common'

const BlogTop: React.FC<AllProps> = () => {
	const {
		appConfig = {
			lang: 'EN',
		} as AppConfig,
	} = useSelector((state: State) => state)
	const info = LANGUAGE_PACK(appConfig.lang).info

	return (
		<React.Fragment>
			<CssBaseline />
			<Container maxWidth="lg">
				<Header title={info.headerTitle} />
				<BlogTopPart />
			</Container>
			<Footer title={info.footerTitle} />
		</React.Fragment>
	)
}

export default BlogTop
