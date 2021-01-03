import { API_CLIENT_ID, API_ENDPOINT_URL } from 'client/constants'
import { ApiRequest } from 'client/services/methods'

export const requestPostList = async(payload: any) => {
  const endpoint = `${API_ENDPOINT_URL}/v1/post/list`
  const res = await ApiRequest.get(endpoint, API_CLIENT_ID, payload)
  return {
    page: res.page,
    result: res.result,
  }
}
