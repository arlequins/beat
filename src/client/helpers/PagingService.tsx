import { Pager } from 'beat-library'

class Paging {
  public pagingInitialSetting (totalCount: number, itemsPerPage: number, initPage: number): Pager {
    const pager: Pager = {
      totalCount: this.setDefaultCount(totalCount),
      totalPage: Math.ceil(totalCount / itemsPerPage),
      startPage: 0,
      itemsPerPage: itemsPerPage,
      currentPage: initPage,
      valid: 1,
      pagingNum: 0,
    }

    pager.pagingNum = pager.currentPage + 1
    pager.endPage = Math.ceil(pager.pagingNum * 0.1) * 10
    pager.startPage = pager.endPage - 10

    if (pager.endPage > pager.totalPage) {
      pager.endPage = pager.totalPage
    }

    return pager
  }

  public getPager (type: string, pager: Pager, num: number): Pager {
    switch (type) {
      case 'firstPage':
        if (pager.currentPage > 0) {
          pager = this.firstPage(pager)
        }
        break
      case 'prevPages':
        if (pager.startPage + 1 > 10) {
          pager = this.prevPages(pager)
        }
        break
      case 'nextPages':
        if (pager.startPage + 10 < pager.totalPage) {
          pager = this.nextPages(pager)
        }
        break
      case 'lastPage':
        if (pager.currentPage < pager.totalPage - 1) {
          pager = this.lastPage(pager)
        }
        break
      case 'setPage':
        pager.currentPage = num
        break
    }

    pager.valid = 1
    return pager
  }

  public range (start: number, end: number): number[] {
    // tslint:disable
    let ret = []
    if (!end) {
      end = start
      start = 0
    }
    for (let i = start; i < end; i++) {
      ret.push(i)
    }
    return ret
  }
  private firstPage (pager: Pager): Pager {
    pager.currentPage = 0
    pager.startPage = 0
    pager.endPage = this.setEndPageInitNum(pager.totalPage)

    return pager
  }

  private prevPages (pager: Pager): Pager {
    pager.currentPage = pager.currentPage - 10 < 1 ? 0 : pager.startPage - 1
    pager.pagingNum = pager.currentPage + 1
    pager.endPage = Math.ceil(pager.pagingNum * 0.1) * 10
    pager.startPage = pager.endPage - 10

    return pager
  }

  private nextPages (pager: Pager): Pager {
    pager.currentPage = pager.startPage + 10
    pager.pagingNum = pager.currentPage + 1
    pager.endPage = Math.ceil(pager.pagingNum * 0.1) * 10
    pager.startPage = pager.endPage - 10
    pager.endPage = this.setEndPageNum(pager.endPage, pager.totalPage)
    return pager
  }

  private lastPage (pager: Pager): Pager {
    pager.currentPage = pager.totalPage - 1
    pager.endPage = pager.totalPage
    pager.startPage = Math.ceil((pager.currentPage - 10) * 0.1) * 10

    return pager
  }

  private setEndPageInitNum (totalCount: number): number {
    let count = 0

    if (!isNaN(totalCount)) {
      if (totalCount > 10) {
        count = 10
      } else {
        count = totalCount
      }
    }
    return count
  }

  private setEndPageNum (totalCount: number, totalPage: number): number {
    let count = 0
    const lastPagesStart = Math.ceil(totalPage * 0.1) * 10 - 10

    if (totalPage > totalCount) {
      count = totalCount
    } else if (totalCount < lastPagesStart) {
      count = totalCount
    } else {
      count = totalPage
    }
    return count
  }

  private setDefaultCount (totalCount: number): number {
    let count = 0

    if (!isNaN(totalCount)) {
      count = totalCount
    }
    return count
  }
}

export const PagingService = new Paging()
