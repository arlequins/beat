import red from '@material-ui/core/colors/red'
import { createMuiTheme } from '@material-ui/core/styles'

// A custom theme for this app
const Theme = (mode: any) => createMuiTheme({
  palette: {
    type: mode,
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#19857b',
    },
    error: {
      main: red.A400,
    },
  },
})

export default Theme
