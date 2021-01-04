declare module 'response' {

  interface RequestPayload {
    timeout?: number
  }

  interface ReqPostListPayload extends RequestPayload {
  }

  interface FeaturedPost {
    title: string
    description: string
    image: string
    imageText: string
    linkText?: string
    date?: string
    type: number
    id: string
  }

  interface PostList {
    result: PostListResult
    stamp?: Date
  }

  interface PostListResult {
    posts: PostDetailResult[]
    featuredPosts: FeaturedPost[]
  }

  interface ReqPostDetailPayload extends RequestPayload {
  }

  interface PostDetail {
    result: PostDetailResult
    stamp?: Date
  }

  interface PostDetailResult {
    content: string
    title: string
    sectionId: number
    id: string
    type: string
    description: string
    keywords: string[]
    image: string
  }

  interface ReqSectionListPayload extends RequestPayload {
  }

  interface Section {
    title: string
    url: string
    id: number
    name: string
  }

  interface SectionList {
    result: Section[]
    stamp?: Date
  }

  interface ReqSideBarPayload extends RequestPayload {
  }

  interface SideBar {
    result: SideBarResult
    stamp?: Date
  }

  interface SideBarResult {
    title: string
    description: string
    archives: SideBarResultArchive[]
    social: SideBarResultSocial[]
  }

  interface SideBarResultArchive {
    title: string
    url: string
  }
  interface SideBarResultSocial {
    name: string
    icon: any
  }
}
