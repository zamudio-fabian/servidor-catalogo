'use strict'

const Schema = use('Schema')

class ArchivoParTableSchema extends Schema {

  up () {
    this.create('archivo_par', (table) => {
      table.increments()
      table.integer('archivo_hash')
      table.integer('par_ip')
      table.timestamps()
    })
  }

  down () {
    this.drop('archivo_par')
  }

}

module.exports = ArchivoParTableSchema
