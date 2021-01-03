import axios from 'axios'
import { AxiosResponse } from 'axios'
import queryString from 'query-string'

const methods = ['get', 'post']

interface Request {
  [key: string]: (endpoint: string, requestBody?: any) => Promise<AxiosResponse>
}

export default methods.reduce((request: Request, method: any): any => ({
  ...request,
  [method]: async (endpoint: string, requestBody?: any) => {
    const common = {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      // 'Content-Type': 'application/json',
    }
    const query = requestBody ? queryString.stringify(requestBody) : ''
    const requestUrl = method === 'get' ? query.length > 0 ? `${endpoint}?${query}` : endpoint : endpoint

    const response: AxiosResponse = await axios(requestUrl, {
      method,
      ...({
        data: method === 'get' ? '' : query,
        headers: {
          ...common,
        },
      }),
    })

    const results: any = await response.data

    if (response.status !== 200) {
      throw new Error(results)
    }
    return results
  },
}), {} as Request)
