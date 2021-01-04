import * as Environment from 'client/constants/environment.json'
import { EnvVariables } from 'common'

const importantEnv = {
	NODE_ENV: process.env.NODE_ENV ? process.env.NODE_ENV : 'development',
	VERSION: process.env.VERSION ? process.env.VERSION : '1.0.0',
}

export const env: EnvVariables = {
	...Environment[importantEnv.NODE_ENV],
	...importantEnv,
}

export const CDN_URL = `${env.CDN_URI}/assets/${env.VERSION}`
export const STATIC_URL = `${env.CDN_URI}/static`
export const DEFAULT_LANG = env.DEFAULT_LANG.toUpperCase()
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'
