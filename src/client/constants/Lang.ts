import { DEFAULT_LANG } from 'client/constants/Env'
import { LanguagePack } from 'common'

const LANGUAGE_PACKS: any = {
  EN: {
    info: {
      headerTitle: 'BEAT',
      footerTitle: 'Beat Project',
    },
    head: {
      title: 'BEAT',
      desc: 'BEAT DESC',
      keywords: ['beat', 'an'],
    },
  },
  JA: {
    info: {
      headerTitle: 'BEAT',
      footerTitle: 'Beat Project',
    },
    head: {
      title: 'BEAT',
      desc: 'BEAT DESC',
      keywords: ['beat', 'an'],
    },
  },
  KO: {
    info: {
      headerTitle: 'BEAT',
      footerTitle: 'Beat Project',
    },
    head: {
      title: 'BEAT',
      desc: 'BEAT DESC',
      keywords: ['beat', 'an'],
    },
  },
}

export const LANGUAGE_PACK = (lang: string): LanguagePack => {
  return LANGUAGE_PACKS[lang] ? {
    ...LANGUAGE_PACKS[lang],
    isExist: true,
  } : {
    ...LANGUAGE_PACKS[DEFAULT_LANG],
    isExist: false,
  }
}
