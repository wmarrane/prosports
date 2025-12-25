const { Pool } = require('pg')

module.exports = new Pool({
    host: '192.168.56.108',
    user: 'prosports',
    password: 'erp0192',
    database: 'prosports',
    port: 5432
})
