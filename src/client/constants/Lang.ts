import { DEFAULT_LANG } from 'client/constants'

const LANGUAGE_PACKS: any = {
  EN: {
    info: {
      headerTitle: 'BEAT',
      footerTitle: 'Beat Project',
    },
  },
  JA: {
    info: {
      headerTitle: 'BEAT',
      footerTitle: 'Beat Project',
    },
  },
  KO: {
    info: {
      headerTitle: 'BEAT',
      footerTitle: 'Beat Project',
    },
  },
}

export const LANGUAGE_PACK: any = (lang: string) => {
  return LANGUAGE_PACKS[lang] ? {
    ...LANGUAGE_PACKS[lang],
    isExist: true,
  } : {
    ...LANGUAGE_PACKS[DEFAULT_LANG],
    isExist: false,
  }
}
