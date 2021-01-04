import { State } from 'common'
import { RouteConfig } from 'react-router-config'
import { FeaturedPost, PostDetailResult, Section, SideBarResult } from 'response'

import { CDN_URL } from 'client/constants/Env'
import post1 from 'client/constants/temp/blog-post.1.md'
import post2 from 'client/constants/temp/blog-post.2.md'
import post3 from 'client/constants/temp/blog-post.3.md'

const sections = [
  { title: 'All', url: `/blog`, name: 'all', id: 0 },
  { title: 'Frontend', url: `/blog/section/frontend`, name: 'frontend', id: 1 },
  { title: 'Backend', url: `/blog/section/backend`, name: 'backend', id: 2 },
  { title: 'AWS', url: `/blog/section/aws`, name: 'aws', id: 3 },
]

const featuredPosts = [
  {
    title: 'Title of a longer featured blog post',
    date: 'Nov 12',
    description:
      'Multiple lines of text that form the lede, informing new readers quickly and efficiently about what\'s most interesting in this post\'s contents.',
    image: `${CDN_URL}/images/post/000001_1.jpg`,
    imageText: 'main image description',
    linkText: 'Continue reading…',
    type: 1,
    id: '000001',
    section: 1,
  },
  {
    title: 'Featured post',
    date: 'Nov 12',
    description:
      'This is a wider card with supporting text below as a natural lead-in to additional content.',
    image: `${CDN_URL}/images/post/000001_1.jpg`,
    imageText: 'Image Text',
    linkText: 'Continue reading…',
    type: 0,
    id: '000002',
    section: 2,
  },
  {
    title: 'Post title',
    date: 'Nov 11',
    description:
      'This is a wider card with supporting text below as a natural lead-in to additional content.',
      image: `${CDN_URL}/images/post/000002_1.jpg`,
    // image: 'https://source.unsplash.com/random',
    imageText: 'Image Text',
    linkText: 'Continue reading…',
    type: 0,
    id: '000003',
    section: 3,
  },
]

const post = {
  content: post1,
  title: 'HELLO TITLE',
  id: '000003',
  sectionId: 1,
  type: 'markdown',
  description: 'This is a wider card with supporting text below as a natural lead-in to additional content.',
  keywords: ['wider', 'card', 'additional content.'],
  image: `${CDN_URL}/images/post/000001_1.jpg`,
}

const posts = [post, {
  content: post2,
  title: 'HELLO TITLE - 2',
  id: '000004',
  sectionId: 2,
  type: 'markdown',
  description: 'This is a wider card with supporting text below as a natural lead-in to additional content.',
  keywords: ['wider', 'card', 'additional content.'],
  image: `${CDN_URL}/images/post/000001_1.jpg`,
}, {
  content: post3,
  title: 'HELLO TITLE - 3',
  id: '000005',
  sectionId: 2,
  type: 'html',
  description: 'This is a wider card with supporting text below as a natural lead-in to additional content.',
  keywords: ['wider', 'card', 'additional content.'],
  image: `${CDN_URL}/images/post/000001_1.jpg`,
}]

const socialList = [
  // { name: 'GitHub', icon: GitHubIcon },
  // { name: 'Twitter', icon: TwitterIcon },
  // { name: 'Facebook', icon: FacebookIcon },
  { name: 'GitHub' },
  { name: 'Twitter' },
  { name: 'Facebook' },
]

const sidebar = {
  title: 'About',
  description:
    'Etiam porta sem malesuada magna mollis euismod. Cras mattis consectetur purus sit amet fermentum. Aenean lacinia bibendum nulla sed consectetur.',
  archives: [
    { title: 'March 2020', url: '#' },
    { title: 'February 2020', url: '#' },
    { title: 'January 2020', url: '#' },
    { title: 'November 1999', url: '#' },
    { title: 'October 1999', url: '#' },
    { title: 'September 1999', url: '#' },
    { title: 'August 1999', url: '#' },
    { title: 'July 1999', url: '#' },
    { title: 'June 1999', url: '#' },
    { title: 'May 1999', url: '#' },
    { title: 'April 1999', url: '#' },
  ],
  social: socialList,
}

export const INITIAL_STATE: State = {
  postList: {
    result: {
      posts: posts as PostDetailResult[],
      featuredPosts: featuredPosts as FeaturedPost[],
    },
    stamp: new Date(),
  } as any,
  postDetail: {
    result: post as PostDetailResult,
    stamp: new Date(),
  } as any,
  sectionList: {
    result: sections as Section[],
    stamp: new Date(),
  },
  sideBar: {
    result: sidebar as SideBarResult,
    stamp: new Date(),
  },

  route: {} as RouteConfig,
  status: 200,

  appConfig: {
    mode: 'dark',
    lang: 'EN',
  },
}
