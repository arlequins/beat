interface ExtendedWindow extends Window {
  __REDUX_DEVTOOLS_EXTENSION__: any;
  __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
  __INITIAL_STATE__: any;
}

export interface Error {
  status?: number;
  message?: any;
}

type TEpic = Epic<Action<string>, any>
