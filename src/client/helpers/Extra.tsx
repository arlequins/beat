const escapeRegExp = (str: string) => {
	return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')
}

export const isWindow = typeof window === 'object'

export const replaceAll = (str: string, find: string, replace: string) => {
	return str.replace(new RegExp(escapeRegExp(find), 'g'), replace)
}

export const moveToTop = () => window.scrollTo(0, 0)

export const range = (start: number, stop: number, step = 1) =>
	Array(Math.ceil((stop - start) / step))
		.fill(start)
		.map((x, y) => x + y * step)

export const snakeToCamel = (s: string) => {
	return s.replace(/(\_\w)/g, (m: string) => {
		return m[1].toUpperCase()
	})
}

export const camelToSnake = (str: string) => {
	return String(str).replace(/([A-Z])/g, (e) => '_' + e.charAt(0).toLowerCase())
}

export const setInteger = (obj: any, defaultNumber: number) => {
	let num = defaultNumber

	try {
		const parsing = Number.parseInt(obj, 10)
		if (!Number.isNaN(parsing)) {
			num = parsing
		}
	} catch (e) {}

	return num
}
