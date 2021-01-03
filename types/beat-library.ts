declare module 'beat-library' {
  interface Pager {
    totalCount: number
    totalPage: number
    startPage: number
    endPage?: number
    itemsPerPage: number
    currentPage: number
    valid: number
    pagingNum: number
  }
}
