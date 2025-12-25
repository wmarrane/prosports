require('dotenv').config()
const app = require('./src/app')

app.listen(3000, () => {
    console.log('API rodando na porta 3000')
})
