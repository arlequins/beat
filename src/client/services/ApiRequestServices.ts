import { env } from 'client/constants/Env'
import { ApiRequest } from 'client/services/methods'

export const requestPostList = async(payload: any) => {
  const endpoint = `${env.API_ENDPOINT_URL}/v1/post/list`
  const res = await ApiRequest.get(endpoint, env.API_CLIENT_ID, payload)
  return {
    page: res.page,
    result: res.result,
  }
}
